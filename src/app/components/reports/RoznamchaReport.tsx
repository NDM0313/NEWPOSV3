/**
 * Roznamcha – Daily Cash Book (Pakistan/India style).
 * Cash In / Cash Out only (not Journal Debit/Credit).
 * Structure: Filters → Summary Cards → Cash Split → Roznamcha Table.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
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
import {
  getRoznamcha,
  type AccountFilter,
  type RoznamchaResult,
  type RoznamchaRowWithBalance,
} from '@/app/services/roznamchaService';
import { exportToPDF, exportToExcel } from '@/app/utils/exportUtils';
import { Loader2, BookOpen, Wallet, Building2, CreditCard } from 'lucide-react';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

function AccountBadge({ accountLabel }: { accountLabel: string }) {
  const label = accountLabel || '—';
  const icon =
    label === 'Cash' ? <Wallet className="w-3.5 h-3.5" /> :
    label === 'Bank' ? <Building2 className="w-3.5 h-3.5" /> :
    label === 'JazzCash' ? <CreditCard className="w-3.5 h-3.5" /> :
    <CreditCard className="w-3.5 h-3.5" />;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-md text-sm',
      label === '—' ? 'text-gray-500' : 'text-gray-200'
    )}>
      {icon} {label}
    </span>
  );
}

export const RoznamchaReport = () => {
  const { companyId, branchId: userBranchId } = useSupabase();
  const { branches } = useSettings();
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: today, to: today });
  const [branchId, setBranchId] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [data, setData] = useState<RoznamchaResult | null>(null);
  const [loading, setLoading] = useState(!!companyId);

  const dateFrom = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const dateTo = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : dateFrom;

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
        branchId || null,
        dateFrom,
        dateTo,
        accountFilter
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, dateFrom, dateTo, accountFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const branchOptions = branches || [];
  const selectedBranchName = branchId ? branchOptions.find((b: any) => b.id === branchId)?.branchName || 'All' : 'All';

  const exportData = {
    title: `Roznamcha ${dateFrom} to ${dateTo} – ${selectedBranchName}`,
    headers: ['Time', 'Ref', 'Details', 'Account', 'Cash In', 'Cash Out', 'Balance'],
    rows: data
      ? [
          ['Opening', '—', 'Opening Balance', '—', '', '', data.summary.openingBalance],
          ...data.rows.map((r: RoznamchaRowWithBalance) => [
            r.time,
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Date Range</span>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Select range"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Branch</span>
            <Select value={branchId || 'all'} onValueChange={(v) => setBranchId(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[200px] bg-gray-950 border-gray-700 text-white">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {branchOptions.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.branchName || b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Date: {dateFrom} → {dateTo} · Branch: {selectedBranchName} · Account: {accountFilter === 'all' ? 'All' : accountFilter}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider p-4 border-b border-gray-800">
              Roznamcha Table
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-20">Time</th>
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
                  {data.rows.map((r: RoznamchaRowWithBalance, i: number) => (
                    <tr
                      key={r.id}
                      className={cn(
                        'hover:bg-gray-800/30',
                        i % 2 === 0 ? 'bg-gray-950/30' : 'bg-gray-900/20'
                      )}
                    >
                      <td className="px-4 py-3 text-gray-300">{r.time}</td>
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
                        <AccountBadge accountLabel={r.accountLabel} />
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
