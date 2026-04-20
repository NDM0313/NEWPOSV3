import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { ReportActions } from './ReportActions';
import { DateRangePicker } from '../ui/DateRangePicker';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { Button } from '../ui/button';
import { Loader2, BookOpen, ChevronDown, ChevronUp, ChevronsUpDown, Pencil } from 'lucide-react';
import { cn } from '../ui/utils';
import { exportToPDF, exportToExcel } from '@/app/utils/exportUtils';
import { allowsDayBookUnifiedEdit } from '@/app/lib/journalEntryEditPolicy';
import {
  journalEntryPresentationFromHeader,
  presentationLabel,
  type JournalLinePresentationKind,
} from '@/app/lib/journalLinePresentation';
import { netEconomicMeaning } from '@/app/lib/accountFlowPresentation';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';

export interface DayBookEntry {
  id: string;
  /** journal_entries.id — use for unified edit / UUID lookup */
  journalEntryId: string;
  /** Raw journal_entries.reference_type (edit policy). */
  referenceTypeRaw: string;
  /** Phase 4: PF-14 / reversal classification for Effective vs Audit copy. */
  presentationKind: JournalLinePresentationKind;
  /** When set, row is settlement — editable from unified payment flow. */
  paymentId: string | null;
  /** Business / entry_date (primary for lists) */
  entryDate: Date;
  /** For audit: journal created_at */
  createdAt: Date;
  /** Display: date + time string (for export) */
  dateTime: string;
  time: string;
  voucher: string;
  account: string;
  description: string;
  debit: number;
  credit: number;
  type: 'Sale' | 'Purchase' | 'Expense' | 'Transfer' | 'Payment' | 'Journal' | 'Rental';
  /** Counterparty side label(s) for this line (other JE lines). */
  fromAccount: string;
  toAccount: string;
  economicMeaning: string;
  /** True when a non-void correction_reversal JE references this journal header — same lock as Journal Entries. */
  hasActiveCorrectionReversal?: boolean;
}

function refTypeToDisplayType(ref: string): DayBookEntry['type'] {
  const m: Record<string, DayBookEntry['type']> = {
    sale: 'Sale',
    sale_adjustment: 'Sale', // PF-14: delta adjustments for edited sales; show as Sale
    payment_adjustment: 'Payment', // PF-14.1: payment amount edit delta; show as Payment
    purchase: 'Purchase',
    payment: 'Payment',
    expense: 'Expense',
    journal: 'Journal',
    rental: 'Rental',
    transfer: 'Transfer',
  };
  return m[ref?.toLowerCase() ?? ''] ?? 'Journal';
}

export interface DayBookReportProps {
  /** When provided, voucher number is clickable and opens transaction detail (e.g. in Accounting module). */
  onVoucherClick?: (voucher: string) => void;
  /** Opens the same unified transaction detail + editor flow using journal entry UUID. */
  onEditJournalEntry?: (journalEntryId: string) => void;
  /** When provided, use global filter date range instead of local picker (aligns with TopHeader). */
  globalStartDate?: string | null;
  globalEndDate?: string | null;
}

/** Same rule as `accountingService.getAccountLedger`: when a branch is selected, include that branch plus company-wide JEs (`branch_id` null). */
function journalEntriesBranchOrFilter(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  const bid = String(branchId).trim();
  const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bid);
  if (!uuidOk) return null;
  return `branch_id.is.null,branch_id.eq.${bid}`;
}

export const DayBookReport = ({ onVoucherClick, onEditJournalEntry, globalStartDate, globalEndDate }: DayBookReportProps) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { formatDateTime } = useFormatDate();
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: today,
    to: today,
  });
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  /** Phase 4: Audit = every line; Effective = same lines, transfer/delta rows visually de-emphasized + badges. */
  const [auditMode, setAuditMode] = useState(true);

  // Table sort: default by date+time descending (newest first)
  type DayBookSortKey =
    | 'date'
    | 'voucher'
    | 'presentation'
    | 'flow'
    | 'economic'
    | 'account'
    | 'description'
    | 'debit'
    | 'credit'
    | 'type';
  const [sortKey, setSortKey] = useState<DayBookSortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const branchOrFilter = useMemo(
    () => journalEntriesBranchOrFilter(contextBranchId),
    [contextBranchId]
  );
  const branchScopeLabel =
    !contextBranchId || contextBranchId === 'all' ? 'All branches' : 'Selected branch + company-wide JEs';

  const useGlobalRange = Boolean(globalStartDate && globalEndDate);
  const dateFrom = useGlobalRange
    ? (globalStartDate ?? '').slice(0, 10)
    : (dateRange.from ? dateRange.from.toISOString().split('T')[0] : '');
  const dateTo = useGlobalRange
    ? (globalEndDate ?? '').slice(0, 10)
    : (dateRange.to ? dateRange.to.toISOString().split('T')[0] : dateFrom);

  useEffect(() => {
    if (!companyId || !dateFrom || !dateTo) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase
        .from('journal_entries')
        .select(`
          id, entry_no, entry_date, description, reference_type, created_at, payment_id, action_fingerprint, economic_event_id,
          lines:journal_entry_lines(id, debit, credit, description, account:accounts(name, code))
        `)
        .eq('company_id', companyId)
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo);
      if (branchOrFilter) {
        q = q.or(branchOrFilter);
      }
      const { data, error } = await q
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(500);

      if (cancelled) return;
      setLoading(false);
      if (error) {
        setEntries([]);
        return;
      }

      const jeIds = (data || []).map((j: { id?: string }) => String(j.id || '').trim()).filter(Boolean);
      const reversedOriginalIds = new Set<string>();
      for (let i = 0; i < jeIds.length; i += 150) {
        const chunk = jeIds.slice(i, i + 150);
        const { data: revParents } = await supabase
          .from('journal_entries')
          .select('reference_id')
          .eq('company_id', companyId)
          .eq('reference_type', 'correction_reversal')
          .in('reference_id', chunk)
          .or('is_void.is.null,is_void.eq.false');
        for (const r of revParents || []) {
          const rid = (r as { reference_id?: string }).reference_id;
          if (rid) reversedOriginalIds.add(String(rid));
        }
      }

      if (cancelled) return;

      const list: DayBookEntry[] = [];
      for (const je of data || []) {
        const lines =
          (je.lines as Array<{
            id?: string;
            debit?: number;
            credit?: number;
            description?: string;
            account?: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
          }>) ?? [];
        const createdAt = je.created_at ? new Date(je.created_at as string) : new Date();
        const entryDate = je.entry_date
          ? new Date(String(je.entry_date).slice(0, 10) + 'T12:00:00')
          : createdAt;
        const dateTimeStr = formatDateTime(createdAt);
        const timeStr = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const voucher = String(je.entry_no ?? `JE-${String(je.id ?? '').slice(0, 8)}`);
        // PF-14.3B: Make clear in Day Book that these are edit adjustments for the same document, not new sales
        const refType = String(je.reference_type ?? '');
        const fp = String((je as { action_fingerprint?: string }).action_fingerprint || '');
        const presentationKind = journalEntryPresentationFromHeader(refType, fp);
        const payId = je.payment_id != null && String(je.payment_id).trim() ? String(je.payment_id) : null;
        const descSuffix = refType === 'sale_adjustment' ? ' (sale edit)' : refType === 'payment_adjustment' ? ' (payment edit)' : '';
        const desc = String(je.description ?? '') + descSuffix;
        const type = refTypeToDisplayType(refType);

        type Fmt = { lineId: string; debit: number; credit: number; accountStr: string; lineDesc: string };
        const formatted: Fmt[] = [];
        let lineIdx = 0;
        for (const line of lines) {
          const debit = Number(line.debit ?? 0);
          const credit = Number(line.credit ?? 0);
          if (debit === 0 && credit === 0) continue;
          const acc = line.account;
          const accObj = Array.isArray(acc) ? (acc[0] as { name?: string; code?: string }) : (acc as { name?: string; code?: string } | null);
          const accountName = accObj?.name;
          const code = accObj?.code != null && String(accObj.code).trim() !== '' ? String(accObj.code).trim() : '';
          const accountNameStr = accountName
            ? code
              ? `${accountName} (${code})`
              : accountName
            : 'Unknown Account';
          const lineId = line.id != null ? String(line.id) : `i${lineIdx}`;
          lineIdx += 1;
          formatted.push({
            lineId,
            debit,
            credit,
            accountStr: accountNameStr,
            lineDesc: String(line.description ?? desc),
          });
        }

        for (const row of formatted) {
          const others = formatted.filter((x) => x.lineId !== row.lineId);
          const counterLabel = others.map((o) => o.accountStr).join(' · ') || '—';
          let fromAccount = '—';
          let toAccount = '—';
          if (row.debit > 0) {
            fromAccount = counterLabel;
            toAccount = row.accountStr;
          } else if (row.credit > 0) {
            fromAccount = row.accountStr;
            toAccount = counterLabel;
          }
          const meaning = netEconomicMeaning(
            {
              debit: row.debit,
              credit: row.credit,
              account_name: row.accountStr,
              counter_account: counterLabel,
              description: row.lineDesc,
              je_reference_type: refType,
              je_action_fingerprint: fp,
              source_module: type === 'Payment' ? 'Payment' : undefined,
            },
            presentationKind
          );
          list.push({
            id: `${je.id}-${row.lineId}`,
            journalEntryId: String(je.id),
            referenceTypeRaw: refType,
            presentationKind,
            paymentId: payId,
            entryDate,
            createdAt,
            dateTime: dateTimeStr,
            time: timeStr,
            voucher,
            account: row.accountStr,
            description: row.lineDesc,
            debit: row.debit,
            credit: row.credit,
            type,
            fromAccount,
            toAccount,
            economicMeaning: meaning,
            hasActiveCorrectionReversal: Boolean(je.id && reversedOriginalIds.has(String(je.id))),
          });
        }
      }
      setEntries(list);
    })();
    return () => { cancelled = true; };
  }, [companyId, dateFrom, dateTo, branchOrFilter]);

  const getSortValue = (e: DayBookEntry, key: DayBookSortKey): string | number => {
    switch (key) {
      case 'date':
        return e.entryDate.getTime();
      case 'voucher':
        return (e.voucher ?? '').toLowerCase();
      case 'presentation':
        return presentationLabel(e.presentationKind).toLowerCase();
      case 'flow':
        return `${e.fromAccount} ${e.toAccount}`.toLowerCase();
      case 'economic':
        return (e.economicMeaning ?? '').toLowerCase();
      case 'account':
        return (e.account ?? '').toLowerCase();
      case 'description':
        return (e.description ?? '').toLowerCase();
      case 'debit':
        return e.debit;
      case 'credit':
        return e.credit;
      case 'type':
        return (e.type ?? '').toLowerCase();
      default:
        return '';
    }
  };

  const sortedEntries = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * dir;
    });
  }, [entries, sortKey, sortDir]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const difference = totalDebit - totalCredit;
  const ROUNDING_TOLERANCE = 0.02;
  const isBalanced = Math.abs(difference) < ROUNDING_TOLERANCE;

  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedEntries.slice(start, start + PAGE_SIZE);
  }, [sortedEntries, currentPage, PAGE_SIZE]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(1);
  }, [currentPage, totalPages]);
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, sortKey, sortDir, branchOrFilter]);

  // Analyse: which vouchers are unbalanced (sum of debit - sum of credit per voucher)
  const byVoucher = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    const cur = byVoucher.get(e.voucher) ?? { debit: 0, credit: 0 };
    cur.debit += e.debit;
    cur.credit += e.credit;
    byVoucher.set(e.voucher, cur);
  }
  const unbalancedVouchers = [...byVoucher.entries()]
    .filter(([, v]) => Math.abs(v.debit - v.credit) >= ROUNDING_TOLERANCE)
    .map(([voucher]) => voucher);

  // Display-only adjustment: one row so totals show balanced (standard practice for rounding)
  const adjustmentDebit = difference < -ROUNDING_TOLERANCE ? Math.abs(difference) : 0;
  const adjustmentCredit = difference > ROUNDING_TOLERANCE ? difference : 0;
  const displayTotalDebit = totalDebit + adjustmentDebit;
  const displayTotalCredit = totalCredit + adjustmentCredit;

  const exportData = {
    headers: [
      'Txn date',
      'Posted',
      'Voucher #',
      'Presentation',
      'From account',
      'To account',
      'Economic meaning',
      'Account (line)',
      'Description',
      'Debit (₨)',
      'Credit (₨)',
      'Type',
    ],
    rows: sortedEntries.map((e) => [
      e.entryDate.toISOString().slice(0, 10),
      e.dateTime,
      e.voucher,
      presentationLabel(e.presentationKind),
      e.fromAccount,
      e.toAccount,
      e.economicMeaning,
      e.account,
      e.description,
      e.debit,
      e.credit,
      e.type,
    ]),
    // Day Book = journal lines (canonical GL), not Roznamcha (payments cash book). Title must not imply Roznamcha.
    title: `Journal Day Book ${dateFrom} to ${dateTo} – ${branchScopeLabel}`,
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportActions
        title="Journal Day Book"
        onPrint={() => window.print()}
        onPdf={() => exportToPDF(exportData, 'DayBook')}
        onExcel={() => exportToExcel(exportData, 'DayBook')}
        onWhatsapp={() => {}}
      />

      {!useGlobalRange && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Date Range:</span>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Select range"
            />
          </div>
        </div>
      )}
      {useGlobalRange && (
        <p className="text-sm text-gray-400">Using global date range from top bar</p>
      )}
      <div className="flex flex-wrap items-center gap-3 py-2">
        <div className="flex items-center gap-2">
          <Switch id="daybook-audit-mode" checked={auditMode} onCheckedChange={setAuditMode} />
          <Label htmlFor="daybook-audit-mode" className="text-sm text-gray-400 cursor-pointer">
            Audit mode (all rows equal weight)
          </Label>
        </div>
        {!auditMode && (
          <p className="text-xs text-amber-200/85 max-w-xl">
            Effective view: PF-14 <strong className="text-gray-200">transfer</strong> /{' '}
            <strong className="text-gray-200">amount delta</strong> rows are dimmed — same economic receipt/payment, not a second
            business event. Turn Audit on to see every voucher with equal emphasis.
          </p>
        )}
      </div>
      <p
        className="text-xs text-gray-500 border border-gray-800/80 rounded-lg px-3 py-2 bg-gray-950/40"
        role="status"
      >
        <span className="text-gray-600">Branch scope:</span>{' '}
        {!contextBranchId || contextBranchId === 'all' ? (
          <>All branches — every journal line for this company in the date range.</>
        ) : (
          <>
            Selected branch plus company-wide journal entries (null <code className="text-gray-400">branch_id</code>),
            consistent with GL account ledger filtering.
          </>
        )}
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-base leading-snug">
                <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                  <tr>
                    {([
                      { key: 'date' as const, label: 'Txn date / posted', className: 'w-44', align: 'left' },
                      { key: 'voucher' as const, label: 'Voucher #', className: 'w-24', align: 'left' },
                      { key: 'presentation' as const, label: 'Presentation', className: 'w-36', align: 'left' },
                      { key: 'flow' as const, label: 'Account flow', className: 'min-w-[12rem]', align: 'left' },
                      { key: 'economic' as const, label: 'Economic meaning', className: 'min-w-[10rem]', align: 'left' },
                      { key: 'account' as const, label: 'Account (line)', className: '', align: 'left' },
                      { key: 'description' as const, label: 'Description', className: '', align: 'left' },
                      { key: 'debit' as const, label: 'Debit (₨)', className: 'w-28', align: 'right' },
                      { key: 'credit' as const, label: 'Credit (₨)', className: 'w-28', align: 'right' },
                      { key: 'type' as const, label: 'Type', className: 'w-24', align: 'center' },
                    ] as const).map(({ key, label, className, align }) => {
                      const isActive = sortKey === key;
                      return (
                        <th key={key} className={cn('px-4 py-3 font-medium', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
                          <button
                            type="button"
                            onClick={() => {
                              if (sortKey === key) {
                                setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                              } else {
                                setSortKey(key);
                                setSortDir('desc');
                              }
                            }}
                            className={cn(
                              'flex items-center gap-1 w-full group hover:text-gray-300 transition-colors focus:outline-none focus:ring-0',
                              align === 'right' && 'justify-end',
                              align === 'center' && 'justify-center'
                            )}
                          >
                            {label}
                            {isActive ? (
                              sortDir === 'desc' ? <ChevronDown size={14} className="shrink-0 opacity-80" /> : <ChevronUp size={14} className="shrink-0 opacity-80" />
                            ) : (
                              <ChevronsUpDown size={14} className="shrink-0 opacity-50 group-hover:opacity-70" />
                            )}
                          </button>
                        </th>
                      );
                    })}
                    {onEditJournalEntry && (
                      <th className="px-4 py-3 text-right font-medium text-gray-400 w-24">Edit</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {paginatedEntries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={cn(
                      'hover:bg-gray-800/30',
                      i % 2 === 0 ? 'bg-gray-950/30' : 'bg-gray-900/20',
                      !auditMode &&
                        (e.presentationKind === 'liquidity_transfer' || e.presentationKind === 'amount_delta') &&
                        'opacity-60'
                    )}
                  >
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <DateTimeDisplay date={e.entryDate} dateOnly className="text-gray-300" />
                        <DateTimeDisplay date={e.createdAt} className="opacity-80 scale-95 origin-top-left" />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-300">
                      {onVoucherClick ? (
                        <button
                          type="button"
                          onClick={() => onVoucherClick(e.voucher)}
                          className="text-blue-400 hover:text-blue-300 hover:underline text-left"
                        >
                          {e.voucher}
                        </button>
                      ) : (
                        e.voucher
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px]">
                      <span
                        className={cn(
                          'inline-block rounded px-2 py-0.5 border text-gray-300',
                          e.presentationKind === 'liquidity_transfer' && 'border-sky-600/50 text-sky-300/95',
                          e.presentationKind === 'amount_delta' && 'border-amber-600/50 text-amber-200/90',
                          e.presentationKind === 'business_primary' && 'border-emerald-700/50 text-emerald-200/90',
                          !['liquidity_transfer', 'amount_delta', 'business_primary'].includes(e.presentationKind) &&
                            'border-gray-700 text-gray-400'
                        )}
                      >
                        {presentationLabel(e.presentationKind)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300 max-w-[14rem] leading-snug">
                      <span className="text-gray-500">From </span>
                      <span className="text-gray-200">{e.fromAccount}</span>
                      <span className="text-gray-600 mx-1">→</span>
                      <span className="text-sky-300/90">{e.toAccount}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-400 max-w-[12rem] leading-snug" title={e.economicMeaning}>
                      {e.economicMeaning}
                    </td>
                    <td className="px-4 py-3 text-white">{e.account}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={e.description}>{e.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">
                      {e.debit > 0 ? e.debit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">
                      {e.credit > 0 ? e.credit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          e.type === 'Sale' && 'bg-blue-500/20 text-blue-400',
                          e.type === 'Purchase' && 'bg-green-500/20 text-green-400',
                          e.type === 'Payment' && 'bg-purple-500/20 text-purple-400',
                          e.type === 'Expense' && 'bg-red-500/20 text-red-400',
                          e.type === 'Rental' && 'bg-amber-500/20 text-amber-400',
                          !['Sale', 'Purchase', 'Payment', 'Expense', 'Rental'].includes(e.type) && 'bg-gray-500/20 text-gray-400'
                        )}
                      >
                        {e.type}
                      </span>
                    </td>
                    {onEditJournalEntry && (
                      <td className="px-4 py-3 text-right">
                        {allowsDayBookUnifiedEdit(e.referenceTypeRaw, e.paymentId, e.hasActiveCorrectionReversal) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-sky-400 hover:text-sky-300"
                            onClick={() => onEditJournalEntry(e.journalEntryId)}
                          >
                            <Pencil size={14} className="mr-1 inline" />
                            {e.paymentId ? 'Edit payment' : 'Edit'}
                          </Button>
                        ) : (
                          <span className="text-gray-600 text-sm tabular-nums">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!isBalanced && (adjustmentDebit > 0 || adjustmentCredit > 0) && (
                  <tr className="bg-amber-950/30 border-t border-amber-700/50">
                    <td className="px-4 py-3 text-gray-500 italic">—</td>
                    <td className="px-4 py-3 font-mono text-amber-400">—</td>
                    <td className="px-4 py-3 text-amber-400/80 text-xs">—</td>
                    <td className="px-4 py-3 text-amber-400/80 text-xs">—</td>
                    <td className="px-4 py-3 text-amber-400/80 text-xs">—</td>
                    <td className="px-4 py-3 text-amber-400/80">—</td>
                    <td className="px-4 py-3 text-amber-400/90 italic">Rounding / Unbalanced difference — display-only</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">
                      {adjustmentDebit > 0 ? adjustmentDebit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">
                      {adjustmentCredit > 0 ? adjustmentCredit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">Journal</span>
                    </td>
                    {onEditJournalEntry && <td className="px-4 py-3" />}
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-900 border-t-2 border-gray-700">
                <tr>
                  <td colSpan={5} className="px-4 py-3 font-bold text-white">
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">
                    ₨ {displayTotalDebit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">
                    ₨ {displayTotalCredit.toLocaleString()}
                  </td>
                  <td />
                  {onEditJournalEntry && <td />}
                </tr>
              </tfoot>
            </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-900/80">
                <p className="text-xs text-gray-400">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedEntries.length)} of {sortedEntries.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-gray-700 text-gray-300"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-500">…</span>}
                        <button
                          type="button"
                          className={cn(
                            'h-8 min-w-[2rem] rounded px-2 text-sm font-medium',
                            p === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          )}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-gray-700 text-gray-300"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {isBalanced ? (
            <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
              <p className="text-green-400 text-center font-medium">✓ Debit = Credit – Balanced Day Book</p>
            </div>
          ) : (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl space-y-2">
              <p className="text-red-400 text-center font-medium">
                ⚠ Unbalanced! Difference: ₨ {Math.abs(difference).toLocaleString()}
                {unbalancedVouchers.length > 0 && (
                  <span className="block text-amber-300/90 text-sm mt-1">
                    Unbalanced voucher(s): {unbalancedVouchers.slice(0, 10).join(', ')}
                    {unbalancedVouchers.length > 10 ? ` +${unbalancedVouchers.length - 10} more` : ''}
                  </span>
                )}
              </p>
              <p className="text-gray-400 text-center text-xs">
                A &quot;Rounding / Unbalanced difference&quot; row has been added above so totals display balanced. Correct the journal entries for the voucher(s) above to fix the underlying data.
              </p>
            </div>
          )}
        </>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No transactions in this period</p>
        </div>
      )}
    </div>
  );
};
