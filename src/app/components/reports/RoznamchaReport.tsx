/**
 * Roznamcha – Daily Cash Book (Pakistan/India style).
 * Cash In / Cash Out only (not Journal Debit/Credit).
 * Structure: Filters → Summary Cards → Cash Split → Roznamcha Table.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { ReportActions } from './ReportActions';
import { DateRangePicker } from '../ui/DateRangePicker';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { BranchSelector } from '@/app/components/layout/BranchSelector';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import {
  getRoznamcha,
  type AccountFilter,
  type RoznamchaResult,
  type RoznamchaRowWithBalance,
} from '@/app/services/roznamchaService';
import { exportToPDF, exportToExcel } from '@/app/utils/exportUtils';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { Loader2, BookOpen, Wallet, Building2, CreditCard, Smartphone } from 'lucide-react';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

function AccountBadge({
  accountLabel,
  liquidity,
}: {
  accountLabel: string;
  liquidity?: 'cash' | 'bank' | 'wallet' | null;
}) {
  const label = accountLabel || '—';
  const icon =
    liquidity === 'cash' || label === 'Cash' ? (
      <Wallet className="w-3.5 h-3.5" />
    ) : liquidity === 'bank' || label === 'Bank' ? (
      <Building2 className="w-3.5 h-3.5" />
    ) : liquidity === 'wallet' || label === 'Wallet' || label === 'JazzCash' ? (
      <Smartphone className="w-3.5 h-3.5" />
    ) : (
      <CreditCard className="w-3.5 h-3.5" />
    );
  return (
    <span className={cn(
      'inline-flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-md text-sm',
      label === '—' ? 'text-gray-500' : 'text-gray-200'
    )}>
      {icon} {label}
    </span>
  );
}

export interface RoznamchaReportProps {
  /** When provided, use global filter date range instead of local picker (aligns with TopHeader). */
  globalStartDate?: string | null;
  globalEndDate?: string | null;
}

export const RoznamchaReport = ({ globalStartDate, globalEndDate }: RoznamchaReportProps = {}) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { formatDate, formatDateTime } = useFormatDate();
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: today, to: today });
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  /** Default off: voided payments (e.g. reversed receipts) are excluded from cash book totals. */
  const [includeVoidedReversed, setIncludeVoidedReversed] = useState(false);
  const [data, setData] = useState<RoznamchaResult | null>(null);
  const [loading, setLoading] = useState(!!companyId);
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalRows = data?.rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    if (!data?.rows?.length) return [];
    const start = (currentPage - 1) * PAGE_SIZE;
    return data.rows.slice(start, start + PAGE_SIZE);
  }, [data?.rows, currentPage, PAGE_SIZE]);

  const useGlobalRange = Boolean(globalStartDate && globalEndDate);
  const dateFrom = useGlobalRange ? (globalStartDate ?? '').slice(0, 10) : (dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '');
  const dateTo = useGlobalRange ? (globalEndDate ?? '').slice(0, 10) : (dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : dateFrom);

  const rowDateTime = (r: RoznamchaRowWithBalance) => {
    if (!r.date) return r.time || '—';
    if (!r.time) return formatDate(new Date(r.date));
    try {
      const combined = r.date + 'T' + (r.time.length === 5 ? r.time + ':00' : r.time);
      return formatDateTime(new Date(combined));
    } catch {
      return r.date + ' ' + r.time;
    }
  };

  const effectiveBranchId = contextBranchId === 'all' ? null : (contextBranchId || null);

  const load = useCallback(async () => {
    if (!companyId || !dateFrom || !dateTo) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getRoznamcha(
        companyId,
        effectiveBranchId,
        dateFrom,
        dateTo,
        accountFilter,
        includeVoidedReversed
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveBranchId, dateFrom, dateTo, accountFilter, includeVoidedReversed]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(1);
  }, [currentPage, totalPages]);
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, accountFilter, includeVoidedReversed]);

  const selectedBranchLabel = contextBranchId === 'all' || !contextBranchId ? 'All Branches' : 'Selected branch';

  const exportData = {
    title: `Roznamcha ${dateFrom} to ${dateTo} – ${selectedBranchLabel}`,
    headers: ['Date & Time', 'Ref', 'Details', 'Account', 'Cash In', 'Cash Out', 'Balance'],
    rows: data
      ? [
          ['Opening', '—', 'Opening Balance', '—', '', '', data.summary.openingBalance],
          ...data.rows.map((r: RoznamchaRowWithBalance) => [
            rowDateTime(r),
            r.ref,
            r.referenceDisplay && r.createdBy
              ? `${r.details}\n${r.referenceDisplay} • by ${r.createdBy}`
              : r.referenceDisplay
                ? `${r.details}\n${r.referenceDisplay}`
                : r.createdBy
                  ? `${r.details}\nby ${r.createdBy}`
                  : r.details,
            r.accountLabel || '—',
            r.cashIn || '',
            r.cashOut || '',
            r.runningBalance,
          ]),
        ]
      : [],
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <p className="text-xs text-gray-500 border border-gray-800/80 rounded-lg px-3 py-2 bg-gray-950/40 max-w-3xl">
        One row per <strong className="text-gray-400">payments</strong> record. Account changes (PF-14 transfer JEs) update the
        payment row; they do not create a second cash-book receipt — use Journal Day Book with Presentation column to see
        transfer vouchers.
      </p>
      <ReportActions
        title="Roznamcha"
        onPrint={() => window.print()}
        onPdf={() => exportToPDF(exportData, 'Roznamcha')}
        onExcel={() => exportToExcel(exportData, 'Roznamcha')}
        onWhatsapp={() => {}}
      />

      {/* 1. FILTERS */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Filters</h3>
        <div className="flex flex-nowrap justify-start items-start gap-[57px]">
          {useGlobalRange ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Date Range</span>
              <span className="text-sm text-gray-500">Using global date range from top bar</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Date Range</span>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select range"
              />
            </div>
          )}
          {/* Global rule: BranchSelector hides when single branch */}
          <BranchSelector variant="inline" showAllBranchesOption />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Account</span>
            <Select value={accountFilter} onValueChange={(v: AccountFilter) => setAccountFilter(v)}>
              <SelectTrigger className="w-[140px] bg-gray-950 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 max-w-[220px]">
            <div className="flex items-center gap-2">
              <Switch
                id="roznamcha-include-voided"
                checked={includeVoidedReversed}
                onCheckedChange={setIncludeVoidedReversed}
              />
              <Label htmlFor="roznamcha-include-voided" className="text-sm text-gray-400 cursor-pointer leading-snug">
                Include voided payments (audit)
              </Label>
            </div>
            <span className="text-xs text-gray-600 pl-11">
              Off by default: reversed/voided receipts do not affect Roznamcha totals.
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Date: {dateFrom} → {dateTo} · Branch: {selectedBranchLabel} · Account:{' '}
          {accountFilter === 'all' ? 'All' : accountFilter === 'wallet' ? 'Wallet' : accountFilter}
          {includeVoidedReversed ? ' · Voided rows shown' : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* 2. SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Opening Balance"
              value={data.summary.openingBalance}
              subtitle="yesterday closing"
            />
            <SummaryCard
              title="Cash In Today"
              value={data.summary.cashIn}
              subtitle="total incoming"
              variant="in"
            />
            <SummaryCard
              title="Cash Out Today"
              value={data.summary.cashOut}
              subtitle="total outgoing"
              variant="out"
            />
            <SummaryCard
              title="Closing Balance"
              value={data.summary.closingBalance}
              subtitle="opening + in − out"
            />
          </div>

          {/* 3. CASH SPLIT */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cash Split</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-950 border border-gray-800 px-4 py-3">
                <span className="text-gray-400 flex items-center gap-2">
                  <Wallet size={18} /> Cash
                </span>
                <span className="font-mono font-semibold text-white">
                  {data.cashSplit.cash.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-950 border border-gray-800 px-4 py-3">
                <span className="text-gray-400 flex items-center gap-2">
                  <Building2 size={18} /> Bank
                </span>
                <span className="font-mono font-semibold text-white">
                  {data.cashSplit.bank.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-950 border border-gray-800 px-4 py-3">
                <span className="text-gray-400 flex items-center gap-2">
                  <Smartphone size={18} /> Wallet
                </span>
                <span className="font-mono font-semibold text-white">
                  {data.cashSplit.wallet.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
                <span className="text-gray-300 flex items-center gap-2">
                  <CreditCard size={18} /> Total
                </span>
                <span className="font-mono font-bold text-white">
                  {data.cashSplit.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 4. ROZNAMCHA TABLE */}
          <div className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider p-4 border-b border-gray-800">
              Roznamcha Table
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-40">Date & Time</th>
                    <th className="px-4 py-3 text-left font-medium w-28">Ref</th>
                    <th className="px-4 py-3 text-left font-medium">Details</th>
                    <th className="px-4 py-3 text-left font-medium w-24">Account</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Cash In</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Cash Out</th>
                    <th className="px-4 py-3 text-right font-medium w-32">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr className="bg-gray-950/50">
                    <td className="px-4 py-3 text-gray-400">Opening</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-gray-300">Opening Balance</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {data.summary.openingBalance.toLocaleString()}
                    </td>
                  </tr>
                  {paginatedRows.map((r: RoznamchaRowWithBalance, i: number) => (
                    <tr
                      key={r.id}
                      className={cn(
                        'hover:bg-gray-800/30',
                        i % 2 === 0 ? 'bg-gray-950/30' : 'bg-gray-900/20'
                      )}
                    >
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {r.date && r.time ? (
                          <DateTimeDisplay
                            date={new Date(r.date + 'T' + (r.time.length === 5 ? r.time + ':00' : r.time))}
                          />
                        ) : (
                          rowDateTime(r)
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300">{r.ref}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-medium text-white">{r.details}</div>
                        {(r.referenceDisplay || r.createdBy) && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {r.referenceDisplay && r.createdBy
                              ? `${r.referenceDisplay} • by ${r.createdBy}`
                              : r.referenceDisplay
                                ? r.referenceDisplay
                                : `by ${r.createdBy}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AccountBadge accountLabel={r.accountName ?? r.accountLabel} liquidity={r.accountType} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        {r.cashIn > 0 ? r.cashIn.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-400">
                        {r.cashOut > 0 ? r.cashOut.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {r.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-900 border-t-2 border-gray-700">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-bold text-white">
                      Closing
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-400">
                      {data.summary.cashIn.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-400">
                      {data.summary.cashOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {data.summary.closingBalance.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-900/80">
                <p className="text-xs text-gray-400">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalRows)} of {totalRows}
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
        </>
      ) : null}

      {!loading && (!data || data.rows.length === 0) && (
        <div className="text-center py-16 rounded-xl border border-gray-800 bg-gray-900/30">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No cash transactions in this period</p>
          <p className="text-sm text-gray-500 mt-1">Roznamcha shows Cash In / Cash Out only (not journal entries).</p>
        </div>
      )}
    </div>
  );
};

function SummaryCard({
  title,
  value,
  subtitle,
  variant,
}: {
  title: string;
  value: number;
  subtitle: string;
  variant?: 'in' | 'out';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        variant === 'in' && 'border-green-800/50 bg-green-950/20',
        variant === 'out' && 'border-red-800/50 bg-red-950/20',
        !variant && 'border-gray-800 bg-gray-900/50'
      )}
    >
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</p>
      <p
        className={cn(
          'text-xl font-bold mt-1 font-mono',
          variant === 'in' && 'text-green-400',
          variant === 'out' && 'text-red-400',
          !variant && 'text-white'
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}
