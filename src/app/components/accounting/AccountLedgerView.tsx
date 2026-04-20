'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, Search, Edit, FileSearch } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { CalendarDateRangePicker } from '@/app/components/ui/CalendarDateRangePicker';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { exportToExcel } from '@/app/utils/exportUtils';

interface AccountLedgerViewProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  accountCode?: string;
  accountType?: string;
  /** When opening from Trial Balance drill-down, pass report period so the ledger opens with that range */
  initialDateRange?: { from: string; to: string };
}

/** Source badge colours */
const SOURCE_COLORS: Record<string, string> = {
  Sales: 'bg-blue-900/60 text-blue-300',
  Purchase: 'bg-purple-900/60 text-purple-300',
  Payment: 'bg-green-900/60 text-green-300',
  Rental: 'bg-cyan-900/60 text-cyan-300',
  Studio: 'bg-violet-900/60 text-violet-300',
  Reversal: 'bg-amber-900/60 text-amber-300',
  Accounting: 'bg-gray-800 text-gray-400',
};

function sourceBadge(src: string) {
  return SOURCE_COLORS[src] || SOURCE_COLORS.Accounting;
}

export const AccountLedgerView: React.FC<AccountLedgerViewProps> = ({
  isOpen,
  onClose,
  accountId,
  accountName,
  accountCode,
  accountType,
  initialDateRange,
}) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [ledgerEntries, setLedgerEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => ({
    from: initialDateRange?.from ? new Date(initialDateRange.from) : undefined,
    to: initialDateRange?.to ? new Date(initialDateRange.to) : undefined,
  }));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && initialDateRange?.from && initialDateRange?.to) {
      setDateRange({ from: new Date(initialDateRange.from), to: new Date(initialDateRange.to) });
    }
  }, [isOpen, initialDateRange?.from, initialDateRange?.to]);

  useEffect(() => {
    if (isOpen && accountId && companyId) {
      loadLedger();
    }
  }, [isOpen, accountId, companyId, dateRange]);

  const loadLedger = async () => {
    if (!accountId || !companyId) return;
    setLoading(true);
    try {
      const startDate = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
      const endDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;
      const entries = await accountingService.getAccountLedger(accountId, companyId, startDate, endDate);
      setLedgerEntries(entries);
    } catch (error: any) {
      console.error('[ACCOUNT LEDGER] Error loading ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return ledgerEntries;
    const q = searchTerm.toLowerCase();
    return ledgerEntries.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.reference_number.toLowerCase().includes(q) ||
        (e.counter_account || '').toLowerCase().includes(q) ||
        (e.source_module || '').toLowerCase().includes(q)
    );
  }, [ledgerEntries, searchTerm]);

  /** Opening balance = balance just before the first filtered entry in the range */
  const openingBalance = useMemo(() => {
    if (!filteredEntries.length) return 0;
    const first = filteredEntries[0];
    return first.running_balance - (first.debit - first.credit);
  }, [filteredEntries]);

  const totalDebit = useMemo(() => filteredEntries.reduce((s, e) => s + e.debit, 0), [filteredEntries]);
  const totalCredit = useMemo(() => filteredEntries.reduce((s, e) => s + e.credit, 0), [filteredEntries]);
  const closingBalance = filteredEntries.length > 0
    ? filteredEntries[filteredEntries.length - 1].running_balance
    : openingBalance;

  const handleExport = () => {
    exportToExcel(
      {
        title: `Account Ledger — ${accountCode ? accountCode + ' ' : ''}${accountName}`,
        headers: ['Date', 'Reference No', 'Description', 'Counter Account', 'Debit', 'Credit', 'Running Balance', 'Source'],
        rows: [
          ['Opening Balance', '', '', '', '', '', formatCurrency(openingBalance), ''],
          ...filteredEntries.map((e) => [
            format(new Date(e.date), 'dd MMM yyyy'),
            e.reference_number,
            e.description,
            e.counter_account || '—',
            e.debit ? formatCurrency(e.debit) : '',
            e.credit ? formatCurrency(e.credit) : '',
            formatCurrency(e.running_balance),
            e.source_module,
          ]),
          ['', '', 'Totals', '', formatCurrency(totalDebit), formatCurrency(totalCredit), formatCurrency(closingBalance), ''],
        ],
      },
      `Ledger_${accountCode || accountName}_${format(new Date(), 'yyyyMMdd')}`
    );
  };

  const openJournalDetail = (referenceNumber: string, autoEdit = false) => {
    window.dispatchEvent(
      new CustomEvent('openTransactionDetail', {
        detail: { referenceNumber, autoLaunchUnifiedEdit: autoEdit },
      })
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/*
        Shared ui/dialog.tsx applies sm:max-w-[800px] on DialogContent — a bare max-w-[…] does NOT
        override that at sm+ breakpoints, so the ledger stayed 800px wide. Repeat sm:max-w here so
        tailwind-merge replaces it (target ~1100–1200px on desktop, still fits narrow viewports).
      */}
      <DialogContent
        className={cn(
          'flex flex-col !gap-0 !p-0 overflow-hidden',
          'w-full max-w-[min(calc(100vw-2rem),1200px)] sm:max-w-[min(calc(100vw-2rem),1200px)]',
          'h-[92vh] max-h-[92vh]',
          'bg-gray-900 border-gray-800 text-white'
        )}
      >
        {/* ── Header ── */}
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-gray-800">
          <DialogTitle asChild>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white leading-tight">Account Ledger</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-sm text-gray-300">
                    {accountCode && <span className="font-mono text-gray-400">{accountCode} — </span>}
                    <span className="font-semibold">{accountName}</span>
                  </span>
                  {accountType && (
                    <Badge className="bg-blue-600/80 text-white text-xs px-2">{accountType}</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X size={20} />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* ── Summary strip ── */}
        <div className="shrink-0 px-6 py-3 bg-gray-800/60 border-b border-gray-800 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Opening Balance</p>
            <p className={cn('text-base font-bold mt-0.5 tabular-nums', openingBalance >= 0 ? 'text-green-400' : 'text-red-400')}>
              {formatCurrency(openingBalance)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Closing Balance</p>
            <p className={cn('text-base font-bold mt-0.5 tabular-nums', closingBalance >= 0 ? 'text-green-400' : 'text-red-400')}>
              {formatCurrency(closingBalance)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Total Debit</p>
            <p className="text-base font-bold mt-0.5 text-green-400 tabular-nums">{formatCurrency(totalDebit)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Total Credit</p>
            <p className="text-base font-bold mt-0.5 text-red-400 tabular-nums">{formatCurrency(totalCredit)}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Date Range</p>
            <p className="text-sm text-gray-300 mt-0.5">
              {dateRange.from && dateRange.to
                ? `${format(dateRange.from, 'dd MMM yyyy')} — ${format(dateRange.to, 'dd MMM yyyy')}`
                : dateRange.from
                ? `From ${format(dateRange.from, 'dd MMM yyyy')}`
                : 'All Time'}
            </p>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="shrink-0 px-6 py-3 border-b border-gray-800 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <Input
              placeholder="Search description, reference, counter account…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-gray-800 border-gray-700 text-white text-sm placeholder:text-gray-600"
            />
          </div>
          <CalendarDateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
          >
            <Download size={14} className="mr-1.5" />
            Export Excel
          </Button>
        </div>

        {/* ── Table (min width so all columns stay on one row on ≥~1200px dialog; smaller = horizontal scroll) ── */}
        <div className="flex-1 min-h-0 min-w-0 overflow-auto overscroll-x-contain">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <span className="animate-pulse">Loading ledger…</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No entries found for this period.
            </div>
          ) : (
            <table className="w-full min-w-[1100px] text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700">
                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left whitespace-nowrap w-[110px]">Date</th>
                  <th className="px-4 py-2.5 text-left whitespace-nowrap w-[130px]">Reference No</th>
                  <th className="px-4 py-2.5 text-left min-w-[180px]">Description</th>
                  <th className="px-4 py-2.5 text-left min-w-[140px]">Counter Account</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap w-[120px]">Debit</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap w-[120px]">Credit</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap w-[130px]">Running Bal.</th>
                  <th className="px-4 py-2.5 text-center whitespace-nowrap w-[90px]">Source</th>
                  <th className="px-4 py-2.5 text-center whitespace-nowrap w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance pseudo-row */}
                <tr className="bg-gray-800/40 border-b border-gray-800">
                  <td className="px-4 py-2 text-xs text-gray-500" colSpan={6}>Opening Balance</td>
                  <td className={cn('px-4 py-2 text-right text-xs font-semibold tabular-nums', openingBalance >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {formatCurrency(openingBalance)}
                  </td>
                  <td colSpan={2} />
                </tr>

                {filteredEntries.map((entry, index) => (
                  <tr
                    key={`${entry.journal_entry_id}-${index}`}
                    className={cn(
                      'border-b border-gray-800/60 transition-colors',
                      entry.ledger_kind === 'reversal'
                        ? 'bg-amber-500/5 hover:bg-amber-500/10'
                        : 'hover:bg-gray-800/40'
                    )}
                  >
                    {/* Date */}
                    <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                      {format(new Date(entry.date), 'dd MMM yyyy')}
                    </td>

                    {/* Reference No — clickable, opens transaction detail */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-blue-400 hover:text-blue-300 hover:underline text-xs font-medium"
                        onClick={() => openJournalDetail(entry.entry_no || entry.reference_number, false)}
                      >
                        {entry.reference_number}
                      </button>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-2.5 text-gray-300 text-xs leading-snug">
                      {entry.description}
                      {entry.branch_name && (
                        <span className="ml-1.5 text-[10px] text-gray-600">· {entry.branch_name}</span>
                      )}
                    </td>

                    {/* Counter Account */}
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {entry.counter_account || '—'}
                    </td>

                    {/* Debit */}
                    <td className={cn('px-4 py-2.5 text-right tabular-nums text-xs', entry.debit > 0 ? 'text-green-400' : 'text-gray-600')}>
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                    </td>

                    {/* Credit */}
                    <td className={cn('px-4 py-2.5 text-right tabular-nums text-xs', entry.credit > 0 ? 'text-red-400' : 'text-gray-600')}>
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                    </td>

                    {/* Running Balance */}
                    <td className={cn('px-4 py-2.5 text-right tabular-nums text-xs font-semibold', entry.running_balance >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {formatCurrency(entry.running_balance)}
                    </td>

                    {/* Source badge */}
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium', sourceBadge(entry.source_module))}>
                        {entry.source_module}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-blue-400"
                          title="View journal entry"
                          onClick={() => openJournalDetail(entry.entry_no || entry.reference_number, false)}
                        >
                          <FileSearch size={13} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-sky-400"
                          title="Edit journal entry"
                          onClick={() => openJournalDetail(entry.journal_entry_id, true)}
                        >
                          <Edit size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Sticky totals footer */}
              <tfoot className="sticky bottom-0 z-10 bg-gray-800 border-t-2 border-gray-700">
                <tr className="text-xs font-bold text-white">
                  <td className="px-4 py-2.5 text-right text-gray-400" colSpan={4}>
                    Totals ({filteredEntries.length} entries)
                  </td>
                  <td className="px-4 py-2.5 text-right text-green-400 tabular-nums">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-red-400 tabular-nums">
                    {formatCurrency(totalCredit)}
                  </td>
                  <td className={cn('px-4 py-2.5 text-right tabular-nums', closingBalance >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {formatCurrency(closingBalance)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
