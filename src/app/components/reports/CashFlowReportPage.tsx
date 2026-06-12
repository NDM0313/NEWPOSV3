/**
 * CF-1 — Cash Flow tab (read-only operational cash/bank movement report).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { Loader2, ArrowLeftRight, Wallet } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { DateRangePicker } from '../ui/DateRangePicker';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';
import { accountService } from '@/app/services/accountService';
import {
  getCashFlowReport,
  type CashFlowReportResult,
  type CashFlowRow,
} from '@/app/services/cashFlowReportService';
import {
  CASH_FLOW_SOURCE_MODULE_LABELS,
  cashFlowStatusLabel,
  type CashFlowSourceModule,
} from '@/app/lib/cashFlowReportLogic';
import type { AccountFilter } from '@/app/services/roznamchaService';
import { formatRoznamchaRowDateTimeDisplay } from '@/app/utils/transactionEventDateTime';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';

export interface CashFlowReportPageProps {
  globalStartDate?: string | null;
  globalEndDate?: string | null;
}

const SOURCE_MODULE_OPTIONS: Array<{ value: CashFlowSourceModule | 'all'; label: string }> = [
  { value: 'all', label: 'All modules' },
  ...(
    Object.entries(CASH_FLOW_SOURCE_MODULE_LABELS) as Array<[CashFlowSourceModule, string]>
  ).map(([value, label]) => ({ value, label })),
];

function statusBadgeClass(status: CashFlowRow['status']): string {
  if (status === 'reversed') return 'bg-amber-950/50 text-amber-300 border-amber-800/60';
  if (status === 'voided') return 'bg-gray-800 text-gray-400 border-gray-700';
  return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
}

export function CashFlowReportPage({ globalStartDate, globalEndDate }: CashFlowReportPageProps) {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const monthStart = startOfMonth(new Date());
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: monthStart,
    to: new Date(),
  });
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [paymentLedgerAccountId, setPaymentLedgerAccountId] = useState('');
  const [paymentAccountOptions, setPaymentAccountOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [sourceModuleFilter, setSourceModuleFilter] = useState<CashFlowSourceModule | 'all'>('all');
  const [auditMode, setAuditMode] = useState(false);
  const [overrideGlobalDates, setOverrideGlobalDates] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<CashFlowReportResult | null>(null);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setPaymentAccountOptions([]);
      return;
    }
    let cancelled = false;
    accountService
      .getPaymentAccountsOnly(companyId)
      .then((list) => {
        if (cancelled) return;
        setPaymentAccountOptions(
          (list || []).map((a: { id: string; name?: string; code?: string }) => ({
            id: String(a.id),
            label: [a.code, a.name].filter(Boolean).join(' — ') || a.name || String(a.id),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPaymentAccountOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const useGlobalRange = Boolean(globalStartDate && globalEndDate);
  const dateFrom = useMemo(() => {
    if (useGlobalRange && !overrideGlobalDates) return (globalStartDate ?? '').slice(0, 10);
    if (dateRange.from) return format(dateRange.from, 'yyyy-MM-dd');
    return '';
  }, [useGlobalRange, overrideGlobalDates, globalStartDate, dateRange.from]);

  const dateTo = useMemo(() => {
    if (useGlobalRange && !overrideGlobalDates) return (globalEndDate ?? '').slice(0, 10);
    if (dateRange.to) return format(dateRange.to, 'yyyy-MM-dd');
    if (dateRange.from) return format(dateRange.from, 'yyyy-MM-dd');
    return dateFrom;
  }, [useGlobalRange, overrideGlobalDates, globalEndDate, dateRange.to, dateRange.from, dateFrom]);

  const effectiveBranchId = contextBranchId === 'all' ? null : contextBranchId || null;
  const branchLabel =
    !contextBranchId || contextBranchId === 'all' ? 'All branches' : 'Selected branch';

  const load = useCallback(async () => {
    if (!companyId || !dateFrom || !dateTo) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getCashFlowReport({
        companyId,
        branchId: effectiveBranchId,
        dateFrom,
        dateTo,
        accountFilter,
        paymentLedgerAccountId: paymentLedgerAccountId.trim() || null,
        auditMode,
        sourceModuleFilter,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    effectiveBranchId,
    dateFrom,
    dateTo,
    accountFilter,
    paymentLedgerAccountId,
    auditMode,
    sourceModuleFilter,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!data?.rows.length) return [];
    if (!q) return data.rows;
    return data.rows.filter((r) => {
      const hay = [
        r.reference,
        r.journalEntryNo,
        r.party,
        r.sourceModuleLabel,
        r.cashAccount,
        r.details,
        r.branchName,
        cashFlowStatusLabel(r.status),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.rows, searchTerm]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 border border-gray-800/80 rounded-lg px-3 py-2 bg-gray-950/40 max-w-4xl">
        <ArrowLeftRight className="inline w-3.5 h-3.5 mr-1 text-gray-400" />
        Read-only operational cash/bank movement by source module. Uses the same deduped stream as Roznamcha —{' '}
        <strong className="text-gray-400">normal mode</strong> hides voided and reversal trails;{' '}
        <strong className="text-gray-400">audit mode</strong> shows them with badges. No edit or cancel actions on this tab.
      </p>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Date range</Label>
            {useGlobalRange && (
              <div className="flex items-center gap-2 mb-1">
                <Switch checked={overrideGlobalDates} onCheckedChange={setOverrideGlobalDates} id="cf-override-dates" />
                <Label htmlFor="cf-override-dates" className="text-xs text-gray-400 cursor-pointer">
                  Override header dates
                </Label>
              </div>
            )}
            {(!useGlobalRange || overrideGlobalDates) && (
              <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Period" />
            )}
            {useGlobalRange && !overrideGlobalDates && (
              <p className="text-xs text-gray-500">
                {globalStartDate?.slice(0, 10)} → {globalEndDate?.slice(0, 10)} (header)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Branch</Label>
            <p className="text-sm text-gray-300">{branchLabel}</p>
            <p className="text-xs text-gray-600">Uses Accounting branch selector in the header.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Liquidity</Label>
            <Select value={accountFilter} onValueChange={(v: AccountFilter) => setAccountFilter(v)}>
              <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
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

          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Cash/bank account</Label>
            <Select
              value={paymentLedgerAccountId || '__all__'}
              onValueChange={(v) => setPaymentLedgerAccountId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all__">All payment accounts</SelectItem>
                {paymentAccountOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Source module</Label>
            <Select
              value={sourceModuleFilter}
              onValueChange={(v) => setSourceModuleFilter(v as CashFlowSourceModule | 'all')}
            >
              <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_MODULE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Mode</Label>
            <div className="flex items-center gap-2">
              <Switch id="cf-audit" checked={auditMode} onCheckedChange={setAuditMode} />
              <Label htmlFor="cf-audit" className="text-sm text-gray-300 cursor-pointer">
                Audit mode (voids &amp; reversals)
              </Label>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs text-gray-500">Search</Label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Reference, party, module…"
              className="bg-gray-950 border-gray-700 text-white"
            />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Opening', value: summary.opening },
              { label: 'Cash In', value: summary.cashIn, accent: 'text-emerald-400' },
              { label: 'Cash Out', value: summary.cashOut, accent: 'text-red-400' },
              { label: 'Net Movement', value: summary.netMovement },
              { label: 'Closing', value: summary.closing },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-gray-800 bg-gray-900/60 p-4"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
                <p className={cn('text-xl font-bold mt-1 text-white', card.accent)}>{formatCurrency(card.value)}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400 text-left text-xs uppercase tracking-wide">
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Party</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Cash/bank account</th>
                    <th className="p-3 text-right">In</th>
                    <th className="p-3 text-right">Out</th>
                    <th className="p-3 text-right">Balance</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-500">
                        No cash movements for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id} className="border-t border-gray-800/80 hover:bg-gray-900/40">
                        <td className="p-3 text-gray-300 whitespace-nowrap">
                          {formatRoznamchaRowDateTimeDisplay(r.date, r.time || '')}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-white">{r.reference}</div>
                          {r.journalEntryNo && (
                            <div className="text-xs text-gray-500 font-mono">{r.journalEntryNo}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-0.5">
                            {journalDescriptionForDisplay(r.details, r.sourceModuleLabel)}
                          </div>
                        </td>
                        <td className="p-3 text-gray-300">{r.party || '—'}</td>
                        <td className="p-3 text-gray-300">{r.sourceModuleLabel}</td>
                        <td className="p-3 text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Wallet className="w-3 h-3 text-gray-500" />
                            {r.cashAccount}
                          </span>
                        </td>
                        <td className="p-3 text-right text-emerald-400 tabular-nums">
                          {r.cashIn > 0 ? formatCurrency(r.cashIn) : '—'}
                        </td>
                        <td className="p-3 text-right text-red-400 tabular-nums">
                          {r.cashOut > 0 ? formatCurrency(r.cashOut) : '—'}
                        </td>
                        <td className="p-3 text-right text-white tabular-nums font-medium">
                          {formatCurrency(r.runningBalance)}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={statusBadgeClass(r.status)}>
                            {cashFlowStatusLabel(r.status)}
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-400 text-xs">{r.branchName || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600 p-3 border-t border-gray-800">
              {filteredRows.length} row(s) · {auditMode ? 'Audit' : 'Normal'} mode · Read-only
            </p>
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-8">Unable to load cash flow data.</p>
      )}
    </div>
  );
}

export default CashFlowReportPage;
