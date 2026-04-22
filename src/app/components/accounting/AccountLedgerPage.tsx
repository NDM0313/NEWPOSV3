'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DocumentPreviewButton } from '@/app/components/shared/DocumentPreviewButton';
import { 
  X, Download, Calendar, Search, FileText, Printer, FileSpreadsheet,
  ArrowLeft, Building2, Edit
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { branchService, Branch } from '@/app/services/branchService';
import { CalendarDateRangePicker } from '@/app/components/ui/CalendarDateRangePicker';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { TransactionDetailModal } from './TransactionDetailModal';
import { DateTimeDisplay } from '@/app/components/ui/DateTimeDisplay';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import {
  classifyAccountFlowBadge,
  accountFlowBadgeLabel,
  accountFlowBadgeClass,
  deriveFromToForLedgerLine,
  netEconomicMeaning,
  presentationKindForLine,
} from '@/app/lib/accountFlowPresentation';
import { presentationLabel } from '@/app/lib/journalLinePresentation';

interface AccountLedgerPageProps {
  accountId: string;
  accountName: string;
  accountCode?: string;
  accountType?: string;
  onClose: () => void;
}

export const AccountLedgerPage: React.FC<AccountLedgerPageProps> = ({
  accountId,
  accountName,
  accountCode,
  accountType,
  onClose,
}) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const [ledgerEntries, setLedgerEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(contextBranchId);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [ledgerDetailAutoEdit, setLedgerDetailAutoEdit] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  /** Audit = all rows equal weight; Effective = dim PF-14 helper rows (running balance unchanged). */
  const [ledgerViewAudit, setLedgerViewAudit] = useState(true);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        setBranches(branchesData);
      } catch (error) {
        console.error('[ACCOUNT LEDGER] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);

  // Load ledger
  useEffect(() => {
    if (accountId && companyId) {
      loadLedger();
    }
  }, [accountId, companyId, selectedBranchId, dateRange]);

  const loadLedger = async () => {
    if (!accountId || !companyId) return;

    setLoading(true);
    try {
      const startDate = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
      const endDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

      const entries = await accountingService.getAccountLedger(
        accountId,
        companyId,
        startDate,
        endDate,
        selectedBranchId,
        searchTerm.trim() || undefined
      );

      setLedgerEntries(entries);

      // Opening balance = balance before the chronologically first entry (API returns date ASC)
      if (entries.length > 0) {
        const chronological = [...entries].sort((a, b) => {
          const d = (a.date || '').localeCompare(b.date || '');
          if (d !== 0) return d;
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return ta - tb;
        });
        const first = chronological[0];
        const firstChange = (first.debit || 0) - (first.credit || 0);
        setOpeningBalance(first.running_balance - firstChange);
      } else {
        setOpeningBalance(0);
      }
    } catch (error: any) {
      console.error('[ACCOUNT LEDGER] Error loading ledger:', error);
      toast.error('Failed to load account ledger');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    let list = ledgerEntries;
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      list = list.filter(entry => {
        if (entry.reference_number?.toLowerCase().includes(search)) return true;
        if (entry.description?.toLowerCase().includes(search)) return true;
        const amountStr = ((entry.debit || 0) + (entry.credit || 0)).toString();
        if (amountStr.includes(search)) return true;
        if (entry.source_module?.toLowerCase().includes(search)) return true;
        return false;
      });
    }
    // Sort A to Z: date ascending, then created_at ascending (oldest first)
    return [...list].sort((a, b) => {
      const dateA = (a.date || '').toString();
      const dateB = (b.date || '').toString();
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });
  }, [ledgerEntries, searchTerm]);

  const totals = useMemo(() => {
    const totalDebit = filteredEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = filteredEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    // With A→Z sort, last row is newest; its running_balance is closing
    const closingBalance = filteredEntries.length > 0
      ? filteredEntries[filteredEntries.length - 1].running_balance
      : openingBalance;
    
    return {
      totalDebit,
      totalCredit,
      closingBalance,
    };
  }, [filteredEntries, openingBalance]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const handleExportPDF = () => {
    toast.info('PDF export feature coming soon');
  };

  const handleExportExcel = () => {
    toast.info('Excel export feature coming soon');
  };

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const openLedgerTransactionDetail = (referenceNumber: string, autoLaunchUnifiedEdit?: boolean) => {
    setLedgerDetailAutoEdit(!!autoLaunchUnifiedEdit);
    setSelectedReference(referenceNumber);
  };

  return (
    <div ref={printRef} className="fixed inset-0 z-50 bg-[#0B0F17] text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Account Ledger</h1>
            <div className="flex items-center gap-3 mt-1">
              {accountCode && <span className="text-sm font-mono text-gray-400">{accountCode}</span>}
              <span className="text-lg font-semibold text-gray-200">{accountName}</span>
              {accountType && (
                <Badge className="bg-blue-600 text-white text-xs">
                  {accountType}
                </Badge>
              )}
              {selectedBranch && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Building2 size={14} />
                  <span>{selectedBranch.code ? `${selectedBranch.code} | ${selectedBranch.name}` : selectedBranch.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Opening/Closing Balance */}
      <div className="bg-gray-950 border-b border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-400 uppercase">Opening Balance</p>
              <p className={cn(
                "text-lg font-semibold mt-1",
                openingBalance >= 0 ? "text-green-400" : "text-red-400"
              )}>
                Rs {openingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Closing Balance</p>
              <p className={cn(
                "text-lg font-semibold mt-1",
                totals.closingBalance >= 0 ? "text-green-400" : "text-red-400"
              )}>
                Rs {totals.closingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase">Date Range</p>
            <p className="text-sm text-gray-300 mt-1">
              {dateRange.from && dateRange.to
                ? `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`
                : dateRange.from
                ? `From ${format(dateRange.from, 'dd MMM yyyy')}`
                : 'All Time'}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 flex-1">
          {/* Global Search - WIDE and PROMINENT */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search by reference (JE-0047), description, customer, invoice, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-2.5 bg-gray-800 border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Compact Branch Filter */}
          <div className="flex items-center gap-2 min-w-[180px]">
            <Building2 size={16} className="text-gray-400" />
            <select
              value={selectedBranchId || 'all'}
              onChange={(e) => {
                const newBranchId = e.target.value === 'all' ? undefined : e.target.value;
                setSelectedBranchId(newBranchId);
                // Trigger reload when branch changes
                if (accountId && companyId) {
                  loadLedger();
                }
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 flex-1"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.code ? `${branch.code} | ${branch.name}` : branch.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Compact Date Range */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <CalendarDateRangePicker
              dateRange={dateRange}
              onDateRangeChange={(range) => {
                setDateRange(range);
                // Auto-reload on date change
                if (accountId && companyId) {
                  setTimeout(() => loadLedger(), 100);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2 border-l border-gray-800 pl-4">
            <Switch id="ledger-audit-mode" checked={ledgerViewAudit} onCheckedChange={setLedgerViewAudit} />
            <Label htmlFor="ledger-audit-mode" className="text-xs text-gray-400 cursor-pointer whitespace-nowrap">
              Audit (full weight)
            </Label>
          </div>
          {!ledgerViewAudit && (
            <p className="text-xs text-amber-200/85 max-w-xl">
              Effective: PF-14 transfer / amount-delta rows are dimmed — running balance for this account stays the real GL total.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 no-print">
          <DocumentPreviewButton
            contentRef={printRef}
            documentType="ledger"
            reference={accountCode || 'account'}
            label="Preview"
            size="sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Printer size={14} className="mr-2" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Download size={14} className="mr-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <FileSpreadsheet size={14} className="mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 overflow-auto bg-gray-950">
        {!companyId ? (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">Loading company…</p>
            <p className="text-sm text-gray-500 mt-1">Ledger will load when company context is ready.</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">No ledger entries</p>
            <p className="text-sm text-gray-500 mt-1">Transactions for this account will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 sticky top-0 border-b border-gray-800">
                <tr className="text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left min-w-[7rem]">Presentation</th>
                  <th className="px-4 py-3 text-left min-w-[10rem]">Account flow</th>
                  <th className="px-4 py-3 text-left min-w-[8rem]">Economic meaning</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Party / offset</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Running Balance</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-blue-500/10 border-b border-gray-800 font-semibold">
                  <td className="px-4 py-3 text-gray-300">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-white">Opening Balance</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-bold",
                    openingBalance >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    Rs {openingBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                </tr>

                {filteredEntries.map((entry, index) => {
                  // Use branch from entry if available, otherwise find from branches
                  const branch = entry.branch_name 
                    ? { name: entry.branch_name, code: null }
                    : branches.find(b => b.id === entry.branch_id);
                  const pres = presentationKindForLine(entry);
                  const flow = deriveFromToForLedgerLine(entry);
                  const meaning = netEconomicMeaning(entry, pres);
                  const badgeKind = classifyAccountFlowBadge(entry, pres);
                  const dimPf14 =
                    !ledgerViewAudit && (pres === 'liquidity_transfer' || pres === 'amount_delta');

                  return (
                    <tr
                      key={`${entry.journal_entry_id}-${index}`}
                      className={cn(
                        'border-b border-gray-800 hover:bg-gray-800/50 transition-colors',
                        entry.ledger_kind === 'reversal' && 'bg-amber-500/5 border-amber-900/40',
                        dimPf14 && 'opacity-55'
                      )}
                    >
                      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <DateTimeDisplay date={entry.date} dateOnly className="text-gray-300" />
                          {entry.created_at ? (
                            <span className="text-[10px] text-gray-600">
                              Posted {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm')}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            openLedgerTransactionDetail(entry.entry_no || entry.reference_number, false)
                          }
                          className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                        >
                          {entry.reference_number}
                        </button>
                        {entry.economic_event_id ? (
                          <div className="text-[10px] text-gray-600 font-sans mt-0.5" title="economic_event_id">
                            EE: {String(entry.economic_event_id).slice(0, 8)}…
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        <span
                          className={cn(
                            'inline-block rounded px-2 py-0.5 border',
                            accountFlowBadgeClass(badgeKind)
                          )}
                        >
                          {presentationLabel(pres)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300 max-w-[14rem] leading-snug">
                        <span className="text-gray-500">From </span>
                        <span className="text-gray-200">{flow.from}</span>
                        <span className="text-gray-600 mx-1">→</span>
                        <span className="text-sky-300/90">{flow.to}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-400 max-w-[12rem] leading-snug" title={meaning}>
                        {meaning}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-gray-700 text-gray-300 text-xs">
                          {entry.source_module || 'Accounting'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{entry.description}</td>
                      <td className="px-4 py-3 text-sm text-blue-400/90">
                        {entry.counter_account || '-'}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right tabular-nums",
                        entry.debit > 0 ? "text-green-400 font-semibold" : "text-gray-500"
                      )}>
                        {entry.debit > 0 ? (
                          <span>Rs {entry.debit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right tabular-nums",
                        entry.credit > 0 ? "text-red-400 font-semibold" : "text-gray-500"
                      )}>
                        {entry.credit > 0 ? (
                          <span>Rs {entry.credit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                        entry.running_balance >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        Rs {entry.running_balance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {entry.branch_name || (branch ? (branch.code ? `${branch.code} | ${branch.name}` : branch.name) : '-')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-sky-400 hover:text-sky-300"
                          onClick={() => openLedgerTransactionDetail(entry.journal_entry_id, true)}
                        >
                          <Edit size={14} className="mr-1" />
                          {entry.payment_id ? 'Edit payment' : 'Edit'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {/* Closing Balance Row */}
                <tr className="bg-gray-900 font-bold border-t-2 border-blue-500/30">
                  <td colSpan={8} className="px-4 py-3 text-right text-white uppercase text-sm">
                    Closing Balance:
                  </td>
                  <td className="px-4 py-3 text-right text-green-400 text-lg">
                    Rs {totals.totalDebit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right text-red-400 text-lg">
                    Rs {totals.totalCredit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right text-2xl",
                    totals.closingBalance >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    Rs {Math.abs(totals.closingBalance).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedReference && (
        <TransactionDetailModal
          isOpen={!!selectedReference}
          onClose={() => {
            setSelectedReference(null);
            setLedgerDetailAutoEdit(false);
          }}
          referenceNumber={selectedReference}
          autoLaunchUnifiedEdit={ledgerDetailAutoEdit}
          onAutoLaunchUnifiedEditConsumed={() => setLedgerDetailAutoEdit(false)}
        />
      )}
    </div>
  );
};
