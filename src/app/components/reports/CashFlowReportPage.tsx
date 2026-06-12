/**
 * CF-1 / CF-1.1 — Cash Flow tab (read-only operational cash/bank movement report).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { AlertCircle, ArrowLeftRight, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
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
  buildCashFlowCsvRows,
  buildCashFlowTieOutDiagnosticHints,
  CASH_FLOW_CSV_HEADERS,
  CASH_FLOW_SOURCE_MODULE_LABELS,
  CASH_FLOW_TIEOUT_EXPLANATION,
  cashFlowAuditModeNote,
  cashFlowFiltersAffectRunningBalance,
  cashFlowRunningBalanceNote,
  cashFlowStatusBadges,
  cashFlowStatusLabel,
  computeCashFlowTieOut,
  glCashFlowModeNote,
  type CashFlowSourceModule,
  type GlCashFlowStatementSummary,
} from '@/app/lib/cashFlowReportLogic';
import type { AccountFilter } from '@/app/services/roznamchaService';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import { formatRoznamchaRowDateTimeDisplay } from '@/app/utils/transactionEventDateTime';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';
import { ReportActions } from './ReportActions';
import { exportToCSV } from '@/app/utils/exportUtils';

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

function auditBadgeClass(): string {
  return 'bg-blue-950/40 text-blue-300 border-blue-800/50';
}

export function CashFlowReportPage({ globalStartDate, globalEndDate }: CashFlowReportPageProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { company } = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const businessName = company?.businessName?.trim() || 'Business';
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
  const [glSummary, setGlSummary] = useState<GlCashFlowStatementSummary | null>(null);
  const [loading, setLoading] = useState(!!companyId);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const liquidityLabel =
    accountFilter === 'all'
      ? 'All liquidity'
      : accountFilter.charAt(0).toUpperCase() + accountFilter.slice(1);

  const ledgerAccountLabel = useMemo(() => {
    if (!paymentLedgerAccountId.trim()) return 'All payment accounts';
    return (
      paymentAccountOptions.find((o) => o.id === paymentLedgerAccountId)?.label ||
      paymentLedgerAccountId
    );
  }, [paymentLedgerAccountId, paymentAccountOptions]);

  const sourceModuleLabel =
    sourceModuleFilter === 'all'
      ? 'All modules'
      : CASH_FLOW_SOURCE_MODULE_LABELS[sourceModuleFilter];

  const modeLabel = auditMode ? 'Audit' : 'Normal';

  const filtersAffectBalance = cashFlowFiltersAffectRunningBalance({
    sourceModuleFilter,
    paymentLedgerAccountId,
    accountFilter,
    searchTerm,
  });

  const runningBalanceNote = cashFlowRunningBalanceNote(filtersAffectBalance);
  const auditModeNote = cashFlowAuditModeNote(auditMode);
  const glModeNote = glCashFlowModeNote(auditMode);

  const load = useCallback(async () => {
    if (!companyId || !dateFrom || !dateTo) {
      setData(null);
      setGlSummary(null);
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const branchArg = effectiveBranchId ?? undefined;
      const [result, gl] = await Promise.all([
        getCashFlowReport({
          companyId,
          branchId: effectiveBranchId,
          dateFrom,
          dateTo,
          accountFilter,
          paymentLedgerAccountId: paymentLedgerAccountId.trim() || null,
          auditMode,
          sourceModuleFilter,
        }),
        accountingReportsService.getCashFlowStatement(companyId, dateFrom, dateTo, branchArg, {
          auditMode,
        }),
      ]);
      setData(result);
      setGlSummary(gl);
    } catch (err) {
      setData(null);
      setGlSummary(null);
      setLoadError(err instanceof Error ? err.message : 'Failed to load cash flow report');
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

  const tieOut = useMemo(() => {
    if (!summary || !glSummary) return null;
    return computeCashFlowTieOut(summary.netMovement, glSummary.netChange);
  }, [summary, glSummary]);

  const tieOutHints = useMemo(() => {
    return buildCashFlowTieOutDiagnosticHints(
      filteredRows.map((r) => ({
        sourceModule: r.sourceModule,
        status: r.status,
        referenceType: r.referenceType,
        party: r.party,
        branchName: r.branchName,
      }))
    );
  }, [filteredRows]);

  const csvExportRows = useMemo(() => {
    return buildCashFlowCsvRows(
      filteredRows.map((r) => ({
        dateTime: formatRoznamchaRowDateTimeDisplay(r.date, r.time || ''),
        reference: r.journalEntryNo ? `${r.reference} (${r.journalEntryNo})` : r.reference,
        party: r.party,
        sourceModuleLabel: r.sourceModuleLabel,
        cashAccount: r.cashAccount,
        cashIn: r.cashIn,
        cashOut: r.cashOut,
        runningBalance: r.runningBalance,
        status: r.status,
        branchName: r.branchName,
        auditMode,
      }))
    );
  }, [filteredRows, auditMode]);

  const handleCsvExport = () => {
    exportToCSV(
      {
        title: `${businessName} — Cash Flow`,
        headers: [...CASH_FLOW_CSV_HEADERS],
        rows: csvExportRows,
      },
      'cash-flow'
    );
  };

  const renderStatusBadges = (row: CashFlowRow) =>
    cashFlowStatusBadges(row.status, auditMode).map((label) => (
      <Badge
        key={label}
        variant="outline"
        className={cn(
          'mr-1',
          label === 'Audit' ? auditBadgeClass() : statusBadgeClass(row.status)
        )}
      >
        {label}
      </Badge>
    ));

  const renderTableBody = (rows: CashFlowRow[], emptyMessage: string) => {
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="p-10 text-center">
            <p className="text-gray-400 font-medium">{emptyMessage}</p>
            <p className="text-xs text-gray-600 mt-2">Try widening the date range or switching to Audit mode.</p>
          </td>
        </tr>
      );
    }
    return rows.map((r) => (
      <tr key={r.id} className="border-t border-gray-800/80 hover:bg-gray-900/40">
        <td className="p-3 text-gray-300 whitespace-nowrap">
          {formatRoznamchaRowDateTimeDisplay(r.date, r.time || '')}
        </td>
        <td className="p-3 min-w-[140px]">
          <div className="font-medium text-white">{r.reference}</div>
          {r.journalEntryNo && (
            <div className="text-xs text-gray-500 font-mono">{r.journalEntryNo}</div>
          )}
          <div className="text-xs text-gray-500 mt-0.5">
            {journalDescriptionForDisplay(r.details, r.sourceModuleLabel)}
          </div>
        </td>
        <td className="p-3 text-gray-300">{r.party || '—'}</td>
        <td className="p-3 text-gray-300 whitespace-nowrap">{r.sourceModuleLabel}</td>
        <td className="p-3 text-gray-300 min-w-[120px]">
          <span className="inline-flex items-center gap-1">
            <Wallet className="w-3 h-3 shrink-0 text-gray-500" />
            {r.cashAccount}
          </span>
        </td>
        <td className="p-3 text-right text-emerald-400 tabular-nums whitespace-nowrap">
          {r.cashIn > 0 ? formatCurrency(r.cashIn) : '—'}
        </td>
        <td className="p-3 text-right text-red-400 tabular-nums whitespace-nowrap">
          {r.cashOut > 0 ? formatCurrency(r.cashOut) : '—'}
        </td>
        <td className="p-3 text-right text-white tabular-nums font-medium whitespace-nowrap">
          {formatCurrency(r.runningBalance)}
        </td>
        <td className="p-3 whitespace-nowrap">{renderStatusBadges(r)}</td>
        <td className="p-3 text-gray-400 text-xs whitespace-nowrap">{r.branchName || '—'}</td>
      </tr>
    ));
  };

  return (
    <div className="space-y-6 min-w-0">
      <p className="text-xs text-gray-500 border border-gray-800/80 rounded-lg px-3 py-2 bg-gray-950/40 max-w-4xl">
        <ArrowLeftRight className="inline w-3.5 h-3.5 mr-1 text-gray-400" />
        Read-only operational cash/bank movement by source module.{' '}
        <strong className="text-gray-400">Normal</strong> hides voided and reversal trails;{' '}
        <strong className="text-gray-400">Audit</strong> shows them with badges. No edit or cancel on this tab.
      </p>

      <div className="no-print">
        <ReportActions
          title="Cash Flow"
          onPrint={() => window.print()}
          onCsv={handleCsvExport}
          previewContentRef={printRef}
          previewDocumentType="ledger"
          previewReference={dateFrom && dateTo ? `CashFlow-${dateFrom}-${dateTo}` : 'CashFlow'}
        />
      </div>

      <div className="no-print rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-2 min-w-0">
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

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-gray-500">Branch</Label>
            <p className="text-sm text-gray-300">{branchLabel}</p>
            <p className="text-xs text-gray-600">Accounting header branch selector.</p>
          </div>

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-gray-500">Liquidity</Label>
            <Select value={accountFilter} onValueChange={(v: AccountFilter) => setAccountFilter(v)}>
              <SelectTrigger className="w-full bg-gray-950 border-gray-700 text-white">
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

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-gray-500">Cash/bank account</Label>
            <Select
              value={paymentLedgerAccountId || '__all__'}
              onValueChange={(v) => setPaymentLedgerAccountId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-full bg-gray-950 border-gray-700 text-white">
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

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-gray-500">Source module</Label>
            <Select
              value={sourceModuleFilter}
              onValueChange={(v) => setSourceModuleFilter(v as CashFlowSourceModule | 'all')}
            >
              <SelectTrigger className="w-full bg-gray-950 border-gray-700 text-white">
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

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-gray-500">Mode</Label>
            <div className="flex items-center gap-2">
              <Switch id="cf-audit" checked={auditMode} onCheckedChange={setAuditMode} />
              <Label htmlFor="cf-audit" className="text-sm text-gray-300 cursor-pointer">
                Audit mode
              </Label>
            </div>
            {auditModeNote && <p className="text-xs text-blue-400/90 leading-snug">{auditModeNote}</p>}
          </div>

          <div className="space-y-2 sm:col-span-2 min-w-0">
            <Label className="text-xs text-gray-500">Search</Label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Reference, party, module…"
              className="bg-gray-950 border-gray-700 text-white w-full"
            />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-400">Loading cash flow…</p>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-red-300 font-medium">Could not load cash flow</p>
          <p className="text-sm text-gray-400 max-w-md mx-auto">{loadError}</p>
          <Button variant="outline" className="border-gray-600" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : summary ? (
        <div ref={printRef} className="space-y-6 min-w-0">
          {/* Print header — visible on screen in print block and when printing */}
          <div className="hidden print:block mb-4 text-black">
            <h1 className="text-xl font-bold">{businessName}</h1>
            <h2 className="text-lg font-semibold mt-1">Cash Flow</h2>
            <p className="text-sm mt-2">
              Period: {dateFrom} → {dateTo} · Branch: {branchLabel} · Account: {ledgerAccountLabel} · Liquidity:{' '}
              {liquidityLabel} · Module: {sourceModuleLabel} · Mode: {modeLabel}
            </p>
          </div>

          {loading ? (
            <div className="no-print flex items-center justify-center gap-2 py-2 text-xs text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Refreshing…
            </div>
          ) : null}

          {glSummary && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  GL cash flow summary
                </h3>
                <span className="text-xs text-gray-600">{glModeNote}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Operating Cash Flow', value: glSummary.operating.net },
                  { label: 'Investing Cash Flow', value: glSummary.investing.net },
                  { label: 'Financing Cash Flow', value: glSummary.financing.net },
                  {
                    label: 'Net GL Cash Flow',
                    value: glSummary.netChange,
                    accent: glSummary.netChange >= 0 ? 'text-emerald-400' : 'text-red-400',
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-violet-900/40 bg-violet-950/20 p-3 sm:p-4 print:border-gray-300 print:bg-white"
                  >
                    <p className="text-xs text-gray-500 uppercase tracking-wide print:text-gray-600">
                      {card.label}
                    </p>
                    <p
                      className={cn(
                        'text-lg sm:text-xl font-bold mt-1 text-white print:text-black',
                        card.accent
                      )}
                    >
                      {formatCurrency(card.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tieOut && (
            <div className="rounded-xl border border-gray-700/80 bg-gray-900/50 p-4 space-y-3 print:border-gray-300 print:bg-white">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider print:text-black">
                Tie-out / Difference
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed print:text-gray-700">{CASH_FLOW_TIEOUT_EXPLANATION}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-800 p-3 print:border-gray-300">
                  <p className="text-xs text-gray-500 uppercase">Operational Net Movement</p>
                  <p className="text-lg font-bold text-white mt-1 print:text-black">
                    {formatCurrency(tieOut.operationalNetMovement)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 p-3 print:border-gray-300">
                  <p className="text-xs text-gray-500 uppercase">GL Summary Net Movement</p>
                  <p className="text-lg font-bold text-white mt-1 print:text-black">
                    {formatCurrency(tieOut.glNetMovement)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 p-3 print:border-gray-300">
                  <p className="text-xs text-gray-500 uppercase">Difference</p>
                  <p
                    className={cn(
                      'text-lg font-bold mt-1 print:text-black',
                      tieOut.difference === 0
                        ? 'text-emerald-400'
                        : Math.abs(tieOut.difference) < 1
                          ? 'text-amber-400'
                          : 'text-amber-300'
                    )}
                  >
                    {formatCurrency(tieOut.difference)}
                  </p>
                </div>
              </div>
              {tieOutHints.length > 0 && (
                <div className="no-print space-y-1">
                  <p className="text-[10px] uppercase text-gray-500 font-semibold">Diagnostic hints</p>
                  <ul className="text-xs text-gray-500 space-y-0.5">
                    {tieOutHints.map((h) => (
                      <li key={h.code}>
                        {h.label}: {h.count} row(s)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Operational cash movement
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Opening', value: summary.opening },
              { label: 'Cash In', value: summary.cashIn, accent: 'text-emerald-400' },
              { label: 'Cash Out', value: summary.cashOut, accent: 'text-red-400' },
              { label: 'Net Movement', value: summary.netMovement },
              { label: 'Closing', value: summary.closing },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 sm:p-4 print:border-gray-300 print:bg-white"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide print:text-gray-600">{card.label}</p>
                <p className={cn('text-lg sm:text-xl font-bold mt-1 text-white print:text-black', card.accent)}>
                  {formatCurrency(card.value)}
                </p>
              </div>
            ))}
          </div>

          {(runningBalanceNote || auditModeNote) && (
            <div className="no-print space-y-1 text-xs text-gray-500">
              {runningBalanceNote && <p>{runningBalanceNote}</p>}
            </div>
          )}

          <div className="rounded-xl border border-gray-800 overflow-hidden print:border-gray-300">
            <div className="overflow-x-auto -mx-px">
              <table className="w-full text-sm min-w-[960px] print:min-w-0 print:text-black">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400 text-left text-xs uppercase tracking-wide print:bg-gray-100 print:text-gray-700">
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Party</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Cash/bank account</th>
                    <th className="p-3 text-right">In</th>
                    <th className="p-3 text-right">Out</th>
                    <th className="p-3 text-right">Running balance</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Branch</th>
                  </tr>
                </thead>
                <tbody className="print:text-black">
                  {renderTableBody(
                    filteredRows,
                    searchTerm.trim()
                      ? 'No cash movement found for selected filters.'
                      : 'No cash movement found for selected filters.'
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600 p-3 border-t border-gray-800 no-print">
              {filteredRows.length} row(s) · {modeLabel} mode · Read-only
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center space-y-4">
          <p className="text-gray-400">No cash flow data for the selected period.</p>
          <Button variant="outline" className="border-gray-600" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

export default CashFlowReportPage;
