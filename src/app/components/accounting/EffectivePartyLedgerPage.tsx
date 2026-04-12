'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft, Search, Calendar, Download, ChevronDown, ChevronRight,
  FileText, Eye, EyeOff, Filter, History, Layers, BookOpen,
  User, Building2, TrendingUp, TrendingDown, X, AlertCircle,
  RefreshCw, Clock, ArrowRightLeft, Hash, ExternalLink,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { CalendarDateRangePicker } from '@/app/components/ui/CalendarDateRangePicker';
import { format, startOfYear, endOfYear, subYears } from 'date-fns';
import {
  loadEffectivePartyLedger,
  type EffectiveLedgerRow,
  type EffectiveLedgerResult,
} from '@/app/services/effectivePartyLedgerService';
import { contactService } from '@/app/services/contactService';

interface EffectivePartyLedgerPageProps {
  contactId?: string;
  contactName?: string;
  contactType?: 'customer' | 'supplier';
  onClose: () => void;
}

type LedgerMode = 'effective' | 'audit';
type TypeFilter = 'all' | 'sales' | 'purchases' | 'payments' | 'opening' | 'returns' | 'reversals';

interface ContactOption {
  id: string;
  name: string;
  type: string;
}

export const EffectivePartyLedgerPage: React.FC<EffectivePartyLedgerPageProps> = ({
  contactId: initialContactId,
  contactName: initialContactName,
  contactType: initialContactType,
  onClose,
}) => {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();

  const [mode, setMode] = useState<LedgerMode>('effective');
  const [contactId, setContactId] = useState(initialContactId || '');
  const [contactName, setContactName] = useState(initialContactName || '');
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>(initialContactType || 'customer');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EffectiveLedgerResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showReversals, setShowReversals] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startOfYear(subYears(new Date(), 1)),
    to: endOfYear(new Date()),
  });

  const prevInitialContactId = useRef<string | undefined>(initialContactId);

  /** Sync when opened from Contacts / deep link; clear selection when navigation drops params (e.g. sidebar browse). */
  useEffect(() => {
    if (initialContactId) {
      setContactId(initialContactId);
      if (initialContactName) setContactName(initialContactName);
      if (initialContactType) setPartyType(initialContactType);
    } else if (prevInitialContactId.current && !initialContactId) {
      setContactId('');
      setContactName('');
    }
    prevInitialContactId.current = initialContactId;
  }, [initialContactId, initialContactName, initialContactType]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      try {
        const all = await contactService.getContacts(companyId);
        setContacts(
          (all || [])
            .filter((c: any) => ['customer', 'supplier', 'both'].includes(c.type))
            .map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
            .sort((a: ContactOption, b: ContactOption) => a.name.localeCompare(b.name))
        );
      } catch { /* ignore */ }
    };
    load();
  }, [companyId]);

  const loadData = useCallback(async () => {
    if (!companyId || !contactId) return;
    setLoading(true);
    try {
      const r = await loadEffectivePartyLedger({
        companyId,
        contactId,
        partyType,
        fromDate: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '2020-01-01',
        toDate: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '2099-12-31',
        branchId,
      });
      setResult(r);
    } catch (err) {
      console.error('[EffectivePartyLedger] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId, partyType, dateRange, branchId]);

  useEffect(() => {
    if (contactId) loadData();
  }, [contactId, loadData]);

  useEffect(() => {
    const handler = () => { if (contactId) loadData(); };
    window.addEventListener('accountingEntriesChanged', handler);
    window.addEventListener('ledgerUpdated', handler);
    window.addEventListener('paymentAdded', handler);
    window.addEventListener('purchaseReturnsChanged', handler);
    return () => {
      window.removeEventListener('accountingEntriesChanged', handler);
      window.removeEventListener('ledgerUpdated', handler);
      window.removeEventListener('paymentAdded', handler);
      window.removeEventListener('purchaseReturnsChanged', handler);
    };
  }, [contactId, loadData]);

  const filteredRows = useMemo(() => {
    if (!result) return [];
    let rows = result.rows;

    if (mode === 'effective') {
      rows = rows.filter(r => {
        if (r.status === 'voided' && !showReversals) return false;
        return true;
      });
    }

    if (typeFilter !== 'all') {
      rows = rows.filter(r => {
        if (typeFilter === 'sales') return r.type === 'sale';
        if (typeFilter === 'purchases') return r.type === 'purchase';
        if (typeFilter === 'payments') return r.type === 'payment' || r.type === 'receipt';
        if (typeFilter === 'opening') return r.type === 'opening';
        if (typeFilter === 'returns') return r.type === 'return';
        if (typeFilter === 'reversals') return r.type === 'reversal';
        return true;
      });
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.referenceNo.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.typeLabel.toLowerCase().includes(q) ||
        (r.effectiveAccountName || '').toLowerCase().includes(q)
      );
    }

    return rows;
  }, [result, mode, typeFilter, searchTerm, showReversals]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectContact = (c: ContactOption) => {
    setContactId(c.id);
    setContactName(c.name);
    setPartyType(c.type === 'supplier' ? 'supplier' : 'customer');
    setContactSearchOpen(false);
    setContactSearch('');
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c => c.name.toLowerCase().includes(q));
  }, [contacts, contactSearch]);

  const summary = result?.summary;

  return (
    <div className="h-full flex flex-col bg-[#0f1729]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#111827] border-b border-gray-800">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
              <ArrowLeft size={20} />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">Party Ledger</h1>
                {contactName && (
                  <Badge variant="outline" className="text-sm border-gray-600 text-gray-300">
                    {contactName}
                  </Badge>
                )}
                {partyType && (
                  <Badge className={cn(
                    'text-xs',
                    partyType === 'customer' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  )}>
                    {partyType === 'customer' ? 'Customer' : 'Supplier'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === 'effective'
                  ? 'Showing latest effective result for each transaction'
                  : 'Showing full accounting history with all mutations'}
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 rounded-lg p-1 flex gap-1 border border-gray-700">
              <button
                onClick={() => setMode('effective')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
                  mode === 'effective'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <Layers size={14} />
                Simple
              </button>
              <button
                onClick={() => setMode('audit')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
                  mode === 'audit'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <BookOpen size={14} />
                Audit
              </button>
            </div>
            <Button variant="ghost" size="icon" onClick={loadData} className="text-gray-400 hover:text-white" title="Refresh">
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-gray-800/50 flex flex-wrap items-center gap-3 bg-[#111827]/80">
        {/* Party Selector */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setContactSearchOpen(!contactSearchOpen)}
            className="border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 min-w-[160px] justify-between"
          >
            <span className="flex items-center gap-1.5 truncate">
              <User size={14} />
              {contactName || 'Select party...'}
            </span>
            <ChevronDown size={14} />
          </Button>
          {contactSearchOpen && (
            <div className="absolute top-full mt-1 left-0 z-30 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-hidden">
              <div className="p-2 border-b border-gray-800">
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-sm"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto max-h-60">
                {filteredContacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectContact(c)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-gray-800 flex items-center justify-between',
                      c.id === contactId ? 'bg-gray-800 text-white' : 'text-gray-300'
                    )}
                  >
                    <span>{c.name}</span>
                    <Badge variant="outline" className={cn(
                      'text-[10px] ml-2',
                      c.type === 'customer' ? 'border-green-500/40 text-green-500' :
                      c.type === 'supplier' ? 'border-blue-500/40 text-blue-500' :
                      'border-purple-500/40 text-purple-500'
                    )}>
                      {c.type}
                    </Badge>
                  </button>
                ))}
                {filteredContacts.length === 0 && (
                  <p className="px-3 py-4 text-sm text-gray-500 text-center">No contacts found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date Range */}
        <CalendarDateRangePicker
          dateRange={dateRange}
          onDateRangeChange={(r: any) => setDateRange(r)}
        />

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TypeFilter)}
          className="bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Types</option>
          <option value="sales">Sales</option>
          <option value="purchases">Purchases</option>
          <option value="payments">Payments</option>
          <option value="opening">Opening</option>
          <option value="returns">Returns</option>
          <option value="reversals">Reversals</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input
            placeholder="Search reference, description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 bg-gray-900 border-gray-700 text-sm h-8"
          />
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer hover:text-gray-300">
            <input
              type="checkbox"
              checked={showReversals}
              onChange={e => setShowReversals(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            Voided
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer hover:text-gray-300">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={e => setShowHistory(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            Show History
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && contactId && (
        <div className="px-6 py-3 border-b border-gray-800/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Opening Balance"
              value={summary.openingBalance}
              formatCurrency={formatCurrency}
              icon={<BookOpen size={16} />}
              color="gray"
            />
            {partyType === 'customer' ? (
              <>
                <SummaryCard label="Total Sales" value={summary.totalSales} formatCurrency={formatCurrency} icon={<TrendingUp size={16} />} color="blue" />
                <SummaryCard label="Total Received" value={summary.totalReceived} formatCurrency={formatCurrency} icon={<TrendingDown size={16} />} color="green" />
                <SummaryCard label="Current Receivable" value={summary.closingBalance} formatCurrency={formatCurrency} icon={<FileText size={16} />} color="amber" highlight />
              </>
            ) : (
              <>
                <SummaryCard label="Total Purchases" value={summary.totalPurchases} formatCurrency={formatCurrency} icon={<TrendingUp size={16} />} color="blue" />
                <SummaryCard label="Total Paid" value={summary.totalPaid} formatCurrency={formatCurrency} icon={<TrendingDown size={16} />} color="green" />
                <SummaryCard label="Current Payable" value={summary.closingBalance} formatCurrency={formatCurrency} icon={<FileText size={16} />} color="amber" highlight />
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1 overflow-auto px-6 py-3">
        {!contactId ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <User size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a party to view their ledger</p>
            <p className="text-sm mt-1">Choose a customer or supplier from the dropdown above</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-gray-500">Loading ledger...</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText size={48} className="mb-4 opacity-30" />
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-800">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium w-8"></th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium w-28">Date</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium w-32">Reference</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium w-28">Type</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Description</th>
                  {mode === 'effective' && (
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium w-36">Account</th>
                  )}
                  <th className="text-right px-3 py-2.5 text-gray-400 font-medium w-28">Debit</th>
                  <th className="text-right px-3 py-2.5 text-gray-400 font-medium w-28">Credit</th>
                  <th className="text-right px-3 py-2.5 text-gray-400 font-medium w-32">Balance</th>
                  <th className="text-center px-3 py-2.5 text-gray-400 font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <React.Fragment key={row.id + '-' + idx}>
                    <tr
                      className={cn(
                        'border-b border-gray-800/40 transition-colors',
                        row.type === 'opening' ? 'bg-gray-900/60' : 'hover:bg-gray-800/40',
                        row.status === 'voided' && 'opacity-50',
                        expandedRows.has(row.id) && 'bg-indigo-900/10',
                      )}
                    >
                      <td className="px-3 py-2.5">
                        {row.mutationCount > 0 && (
                          <button
                            onClick={() => toggleRow(row.id)}
                            className="text-gray-500 hover:text-white transition-colors"
                          >
                            {expandedRows.has(row.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-300 tabular-nums">{row.date}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-indigo-400 font-mono text-xs">{row.referenceNo}</span>
                        {row.mutationCount > 0 && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] border-amber-500/40 text-amber-400 px-1 py-0">
                            {row.mutationCount} edit{row.mutationCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <TypeBadge type={row.type} label={row.typeLabel} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-300 text-xs truncate max-w-[240px]" title={row.description}>
                        {row.description}
                      </td>
                      {mode === 'effective' && (
                        <td className="px-3 py-2.5 text-gray-400 text-xs">
                          {row.effectiveAccountName && (
                            <span className="flex items-center gap-1">
                              <Building2 size={12} className="text-gray-600" />
                              <span>{row.effectiveAccountCode ? `${row.effectiveAccountCode} – ` : ''}{row.effectiveAccountName}</span>
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {row.debit > 0 ? (
                          <span className="text-green-400">{formatCurrency(row.debit)}</span>
                        ) : (
                          <span className="text-gray-700">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {row.credit > 0 ? (
                          <span className="text-red-400">{formatCurrency(row.credit)}</span>
                        ) : (
                          <span className="text-gray-700">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                        <span className={row.runningBalance >= 0 ? 'text-white' : 'text-red-400'}>
                          {formatCurrency(Math.abs(row.runningBalance))}
                        </span>
                        {row.runningBalance < 0 && <span className="text-red-400 text-[10px] ml-0.5">Cr</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge status={row.status} isCollapsed={row.isCollapsed} />
                      </td>
                    </tr>

                    {/* Expanded mutation history */}
                    {expandedRows.has(row.id) && row.mutations.length > 0 && (
                      <tr>
                        <td colSpan={mode === 'effective' ? 10 : 9} className="px-0 py-0">
                          <MutationHistoryPanel
                            row={row}
                            formatCurrency={formatCurrency}
                            showHistory={showHistory}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-900/60 border-t-2 border-gray-700">
                  <td colSpan={mode === 'effective' ? 6 : 5} className="px-3 py-3 text-right text-sm font-semibold text-gray-300">
                    Closing Balance:
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-green-400">
                    {summary ? formatCurrency(summary.totalDebit) : '–'}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-red-400">
                    {summary ? formatCurrency(summary.totalCredit) : '–'}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-extrabold text-lg text-white">
                    {summary ? formatCurrency(Math.abs(summary.closingBalance)) : '–'}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

function SummaryCard({ label, value, formatCurrency, icon, color, highlight }: {
  label: string;
  value: number;
  formatCurrency: (v: number) => string;
  icon: React.ReactNode;
  color: 'gray' | 'blue' | 'green' | 'amber';
  highlight?: boolean;
}) {
  const colorMap = {
    gray: 'border-gray-700/50 bg-gray-900/40',
    blue: 'border-blue-500/20 bg-blue-500/5',
    green: 'border-green-500/20 bg-green-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
  };
  const textMap = {
    gray: 'text-gray-300',
    blue: 'text-blue-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
  };
  return (
    <div className={cn(
      'rounded-lg border px-4 py-3',
      colorMap[color],
      highlight && 'ring-1 ring-amber-500/30'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className={cn('opacity-60', textMap[color])}>{icon}</span>
        <span className="text-[11px] uppercase font-medium text-gray-500 tracking-wide">{label}</span>
      </div>
      <p className={cn('text-lg font-bold tabular-nums', textMap[color])}>
        {formatCurrency(Math.abs(value))}
      </p>
    </div>
  );
}

function TypeBadge({ type, label }: { type: string; label: string }) {
  const styles: Record<string, string> = {
    sale: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    purchase: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    payment: 'bg-green-500/15 text-green-400 border-green-500/30',
    receipt: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    opening: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    return: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    reversal: 'bg-red-500/15 text-red-400 border-red-500/30',
    expense: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    adjustment: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    journal: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium px-1.5 py-0.5', styles[type] || styles.journal)}>
      {label}
    </Badge>
  );
}

function StatusBadge({ status, isCollapsed }: { status: string; isCollapsed: boolean }) {
  if (status === 'voided') {
    return <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 bg-red-500/10">Voided</Badge>;
  }
  if (status === 'cancelled') {
    return <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-400 bg-orange-500/10">Cancelled</Badge>;
  }
  if (isCollapsed) {
    return <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400 bg-indigo-500/10">Effective</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-500">Active</Badge>;
}

function MutationHistoryPanel({ row, formatCurrency, showHistory }: {
  row: EffectiveLedgerRow;
  formatCurrency: (v: number) => string;
  showHistory: boolean;
}) {
  return (
    <div className="bg-gray-900/80 border-t border-b border-indigo-500/20 px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <History size={14} className="text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Edit History</span>
        <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">
          {row.mutationCount} change{row.mutationCount > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Effective result highlight */}
      <div className="mb-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Final Amount</span>
            <p className="text-white font-bold tabular-nums">{formatCurrency(row.effectiveAmount)}</p>
          </div>
          {row.effectiveAccountName && (
            <div>
              <span className="text-gray-500 text-xs">Final Account</span>
              <p className="text-white font-medium">{row.effectiveAccountCode ? `${row.effectiveAccountCode} – ` : ''}{row.effectiveAccountName}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500 text-xs">Payment ID</span>
            <p className="text-gray-400 font-mono text-xs">{row.paymentId?.slice(0, 12) || '–'}...</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {row.mutations.map((m, i) => (
          <div key={i} className="flex items-start gap-3 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 tabular-nums">{new Date(m.timestamp).toLocaleString()}</span>
                <Badge variant="outline" className={cn(
                  'text-[9px] px-1 py-0',
                  m.type === 'amount_edit' ? 'border-amber-500/40 text-amber-400' :
                  m.type === 'account_change' ? 'border-cyan-500/40 text-cyan-400' :
                  'border-gray-600 text-gray-400'
                )}>
                  {m.type === 'amount_edit' ? 'Amount Edit' :
                   m.type === 'account_change' ? 'Account Change' :
                   m.type}
                </Badge>
              </div>
              <div className="mt-0.5 text-gray-400">
                {m.type === 'amount_edit' && m.oldAmount != null && m.newAmount != null && (
                  <span>
                    {formatCurrency(m.oldAmount)} <ArrowRightLeft size={10} className="inline mx-1 text-amber-500" /> {formatCurrency(m.newAmount)}
                  </span>
                )}
                {m.type === 'account_change' && m.oldAccountName && m.newAccountName && (
                  <span>
                    {m.oldAccountName} <ArrowRightLeft size={10} className="inline mx-1 text-cyan-500" /> {m.newAccountName}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EffectivePartyLedgerPage;
