import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { ReportActions } from './ReportActions';
import { DateRangePicker } from '../ui/DateRangePicker';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { Button } from '../ui/button';
import { Loader2, BookOpen } from 'lucide-react';
import { cn } from '../ui/utils';
import { exportToPDF, exportToExcel } from '@/app/utils/exportUtils';

export interface DayBookEntry {
  id: string;
  /** For two-line display (date + time) */
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
}

function refTypeToDisplayType(ref: string): DayBookEntry['type'] {
  const m: Record<string, DayBookEntry['type']> = {
    sale: 'Sale',
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
  /** When provided, use global filter date range instead of local picker (aligns with TopHeader). */
  globalStartDate?: string | null;
  globalEndDate?: string | null;
}

export const DayBookReport = ({ onVoucherClick, globalStartDate, globalEndDate }: DayBookReportProps) => {
  const { companyId } = useSupabase();
  const { formatDateTime } = useFormatDate();
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: today,
    to: today,
  });
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [loading, setLoading] = useState(!!companyId);

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
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          id, entry_no, entry_date, description, reference_type, created_at,
          lines:journal_entry_lines(id, debit, credit, description, account:accounts(name))
        `)
        .eq('company_id', companyId)
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(500);

      if (cancelled) return;
      setLoading(false);
      if (error) {
        setEntries([]);
        return;
      }

      const list: DayBookEntry[] = [];
      for (const je of data || []) {
        const lines = (je.lines as Array<{ id?: string; debit?: number; credit?: number; description?: string; account?: { name?: string } | null }>) ?? [];
        const createdAt = je.created_at ? new Date(je.created_at as string) : new Date();
        const dateTimeStr = formatDateTime(createdAt);
        const timeStr = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const voucher = String(je.entry_no ?? `JE-${String(je.id ?? '').slice(0, 8)}`);
        const desc = String(je.description ?? '');
        const type = refTypeToDisplayType(String(je.reference_type ?? ''));

        for (const line of lines) {
          const debit = Number(line.debit ?? 0);
          const credit = Number(line.credit ?? 0);
          if (debit === 0 && credit === 0) continue;
          const acc = line.account;
          const accountName = Array.isArray(acc) ? (acc[0] as { name?: string })?.name : (acc as { name?: string } | null)?.name;
          const accountNameStr = accountName ?? 'Unknown Account';
          list.push({
            id: `${je.id}-${line.id ?? Math.random()}`,
            createdAt,
            dateTime: dateTimeStr,
            time: timeStr,
            voucher,
            account: accountNameStr,
            description: line.description ?? desc,
            debit,
            credit,
            type,
          });
        }
      }
      setEntries(list);
    })();
    return () => { cancelled = true; };
  }, [companyId, dateFrom, dateTo]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const difference = totalDebit - totalCredit;
  const ROUNDING_TOLERANCE = 0.02;
  const isBalanced = Math.abs(difference) < ROUNDING_TOLERANCE;

  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage, PAGE_SIZE]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(1);
  }, [currentPage, totalPages]);
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo]);

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
    headers: ['Date & Time', 'Voucher #', 'Account', 'Description', 'Debit (₨)', 'Credit (₨)', 'Type'],
    rows: entries.map((e) => [
      e.dateTime,
      e.voucher,
      e.account,
      e.description,
      e.debit,
      e.credit,
      e.type,
    ]),
    title: `Roznamcha (Day Book) ${dateFrom} to ${dateTo}`,
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-40">Date & Time</th>
                    <th className="px-4 py-3 text-left font-medium w-24">Voucher #</th>
                    <th className="px-4 py-3 text-left font-medium">Account</th>
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Debit (₨)</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Credit (₨)</th>
                    <th className="px-4 py-3 text-center font-medium w-24">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {paginatedEntries.map((e, i) => (
                  <tr key={e.id} className={cn('hover:bg-gray-800/30', i % 2 === 0 ? 'bg-gray-950/30' : 'bg-gray-900/20')}>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      <DateTimeDisplay date={e.createdAt} className="flex flex-col leading-tight" />
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
                  </tr>
                ))}
                {!isBalanced && (adjustmentDebit > 0 || adjustmentCredit > 0) && (
                  <tr className="bg-amber-950/30 border-t border-amber-700/50">
                    <td className="px-4 py-3 text-gray-500 italic">—</td>
                    <td className="px-4 py-3 font-mono text-amber-400">—</td>
                    <td className="px-4 py-3 text-amber-400/90 italic">Rounding / Unbalanced difference</td>
                    <td className="px-4 py-3 text-amber-500/80 italic text-xs">Display-only adjustment so totals balance</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">
                      {adjustmentDebit > 0 ? adjustmentDebit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">
                      {adjustmentCredit > 0 ? adjustmentCredit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">Journal</span>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-900 border-t-2 border-gray-700">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-bold text-white">
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">
                    ₨ {displayTotalDebit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">
                    ₨ {displayTotalCredit.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-900/80">
                <p className="text-xs text-gray-400">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, entries.length)} of {entries.length}
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
