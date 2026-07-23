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
import { SearchableSelect } from '../ui/searchable-select';
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
  CASH_FLOW_SAFE_RANGE_DAYS,
  CASH_FLOW_SOURCE_MODULE_LABELS,
  CASH_FLOW_TIEOUT_EXPLANATION,
  cashFlowAuditModeNote,
  cashFlowFiltersAffectRunningBalance,
  cashFlowHeaderRangeExceedsSafeDays,
  cashFlowRowMatchesSelectedAccount,
  cashFlowRunningBalanceNote,
  cashFlowStatusBadges,
  cashFlowStatusLabel,
  computeCashFlowSummary,
  computeCashFlowTieOut,
  glCashFlowModeNote,
  recomputeCashFlowRunningBalance,
  resolveCashFlowPartyDisplay,
  type CashFlowSourceModule,
  type GlCashFlowStatementSummary,
} from '@/app/lib/cashFlowReportLogic';
import type { AccountFilter } from '@/app/services/roznamchaService';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import { ReportBasisBanner, ReportBasisBadge } from '@/app/components/accounting/ReportBasisBanner';
import { formatRoznamchaRowDateTimeDisplay } from '@/app/utils/transactionEventDateTime';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';
import { ReportActions } from './ReportActions';
import { PdfPreviewModal, type PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';
import { useReportExport } from './shared/useReportExport';
import { CashBookReportPreview } from './shared/CashBookReportPreview';
import {
  buildCashFlowPrintRows,
  buildCashFlowSummaryStats,
  CASH_FLOW_PRINT_COLUMNS,
} from './shared/buildCashFlowPrintPreview';
import { exportToCSV } from '@/app/utils/exportUtils';
import { canAccessCashFlowUnifiedPreview } from '@/app/lib/accounting/cashFlowUnifiedPreviewAccess';
import {
  compareCashFlowUnifiedPreview,
  type CashFlowUnifiedPreviewDiff,
} from '@/app/lib/accounting/cashFlowUnifiedPreviewDiff';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { useUnifiedLedgerEngineState } from '@/app/hooks/useUnifiedLedgerEngineState';
import { loadCashFlowUnifiedPreview } from '@/app/services/cashFlowUnifiedPreviewService';
import type { CashFlowUnifiedPreviewLoadResult } from '@/app/services/cashFlowUnifiedPreviewService';
import { CashFlowUnifiedPreviewPanel } from '@/app/components/accounting/CashFlowUnifiedPreviewPanel';
import {
  effectiveCashFlowMainLoaderSource,
  resolveCashFlowMainLoaderSource,
} from '@/app/lib/resolveCashFlowMainLoaderSource';
import { loadCashFlowUnifiedMain } from '@/app/services/cashFlowUnifiedMainService';
import { assertUnifiedMainLoaderSource } from '@/app/lib/r8R2LegacyMainRetired';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import { CASH_FLOW_APPROVED_FINANCE_RULES } from '@/app/lib/accounting/cashFlowPreviewFinanceAlignment';
import { AttachmentViewer } from '@/app/components/shared/AttachmentViewer';
import { TransactionAttachmentIconButton } from '@/app/components/shared/TransactionAttachmentIconButton';
import { loadRowAttachmentsLazy } from '@/app/lib/roznamchaAttachments';
import type { TransactionAttachment } from '@/app/utils/transactionAttachments';

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
  if (status === 'voided') return 'bg-muted text-muted-foreground border-border';
  return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
}

function auditBadgeClass(): string {
  return 'bg-primary/10 text-blue-700 dark:text-blue-300 border-primary/30';
}

export function CashFlowReportPage({ globalStartDate, globalEndDate }: CashFlowReportPageProps) {
  const { companyId, branchId: contextBranchId, userRole } = useSupabase();
  const reportExport = useReportExport({ companyId, documentType: 'ledger', reportKind: 'cash_flow' });
  const [printOrientation, setPrintOrientation] = useState<PdfPreviewOrientation>('landscape');
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
  const [rangeNarrowedForPerf, setRangeNarrowedForPerf] = useState(false);
  const didAutoNarrowRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState<CashFlowReportResult | null>(null);
  const [glSummary, setGlSummary] = useState<GlCashFlowStatementSummary | null>(null);
  const [glSummaryLoading, setGlSummaryLoading] = useState(false);
  const [loading, setLoading] = useState(!!companyId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mainLoaderSource, setMainLoaderSource] = useState<'legacy' | 'unified'>('legacy');
  const paymentAccountOptionsRef = useRef(paymentAccountOptions);
  paymentAccountOptionsRef.current = paymentAccountOptions;

  const showUnifiedPreviewTools = canAccessCashFlowUnifiedPreview(userRole);
  const [unifiedPreviewEnabled, setUnifiedPreviewEnabled] = useState(false);
  const [previewBasis, setPreviewBasis] = useState<UnifiedLedgerBasis>('effective_party');
  const [previewLoadResult, setPreviewLoadResult] = useState<CashFlowUnifiedPreviewLoadResult | null>(null);
  const [previewDiff, setPreviewDiff] = useState<CashFlowUnifiedPreviewDiff | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<TransactionAttachment[] | null>(null);

  const { state: engineState } = useUnifiedLedgerEngineState(companyId, {
    screenId: UNIFIED_LEDGER_SCREEN_IDS.CASH_FLOW,
    screenPreview: unifiedPreviewEnabled,
  });

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
          (list || [])
            .map((a: { id: string; name?: string; code?: string }) => ({
              id: String(a.id),
              label: [a.code, a.name].filter(Boolean).join(' — ') || a.name || String(a.id),
            }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
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

  // Auto-narrow wide header ranges to current month so first paint does not dump years of cash rows.
  useEffect(() => {
    if (didAutoNarrowRef.current) return;
    if (!useGlobalRange || !globalStartDate || !globalEndDate) return;
    if (overrideGlobalDates) return;
    if (
      cashFlowHeaderRangeExceedsSafeDays(
        String(globalStartDate).slice(0, 10),
        String(globalEndDate).slice(0, 10),
      )
    ) {
      didAutoNarrowRef.current = true;
      setOverrideGlobalDates(true);
      setRangeNarrowedForPerf(true);
    }
  }, [useGlobalRange, globalStartDate, globalEndDate, overrideGlobalDates]);

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
    if (!paymentLedgerAccountId.trim()) return 'All accounts';
    return (
      paymentAccountOptions.find((o) => o.id === paymentLedgerAccountId)?.label ||
      paymentLedgerAccountId
    );
  }, [paymentLedgerAccountId, paymentAccountOptions]);

  const accountSelectOptions = useMemo(
    () => [
      { id: '__all__', name: 'All accounts' },
      ...paymentAccountOptions.map((o) => ({ id: o.id, name: o.label })),
    ],
    [paymentAccountOptions],
  );

  /** Account-scoped rows/summary (display safety net on top of unified filter). */
  const accountScopedData = useMemo((): CashFlowReportResult | null => {
    if (!data) return null;
    const id = paymentLedgerAccountId.trim();
    if (!id) return data;
    const opt = paymentAccountOptions.find((o) => o.id === id);
    const scopedRows = !opt
      ? []
      : data.rows.filter((r) => cashFlowRowMatchesSelectedAccount(r.cashAccount, opt));
    const rows = recomputeCashFlowRunningBalance(scopedRows, data.summary.opening);
    const summary = computeCashFlowSummary(rows, data.summary.opening);
    return { ...data, rows, summary };
  }, [data, paymentLedgerAccountId, paymentAccountOptions]);

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
  const glModeNote = glCashFlowModeNote(auditMode, auditMode ? 'official_gl' : 'effective_party');

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
    setGlSummary(null);
    try {
      const resolved = await resolveCashFlowMainLoaderSource(companyId);
      const mainSource = effectiveCashFlowMainLoaderSource(resolved);
      setMainLoaderSource(mainSource);

      // Main grid only — GL statement loads after data lands (does not block paint).
      assertUnifiedMainLoaderSource(mainSource);
      const unified = await loadCashFlowUnifiedMain({
        companyId,
        branchId: effectiveBranchId,
        dateFrom,
        dateTo,
        accountFilter,
        paymentLedgerAccountId: paymentLedgerAccountId.trim() || null,
        paymentAccountOptions: paymentAccountOptionsRef.current,
        auditMode,
        sourceModuleFilter,
        basis: previewBasis,
      });
      setData(unified);
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
    previewBasis,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Defer GL cash-flow statement until operational grid is ready.
  useEffect(() => {
    if (!companyId || !dateFrom || !dateTo || !data) {
      return;
    }
    let cancelled = false;
    setGlSummaryLoading(true);
    const branchArg = effectiveBranchId ?? undefined;
    void accountingReportsService
      .getCashFlowStatement(companyId, dateFrom, dateTo, branchArg, {
        auditMode,
        basis: auditMode ? 'official_gl' : 'effective_party',
      })
      .then((gl) => {
        if (!cancelled) setGlSummary(gl);
      })
      .catch(() => {
        if (!cancelled) setGlSummary(null);
      })
      .finally(() => {
        if (!cancelled) setGlSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, dateFrom, dateTo, effectiveBranchId, auditMode, data]);

  const loadUnifiedPreview = useCallback(async () => {
    if (!companyId || !data || !unifiedPreviewEnabled || !dateFrom || !dateTo) {
      setPreviewLoadResult(null);
      setPreviewDiff(null);
      setPreviewError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      if (mainLoaderSource === 'unified') {
        const [legacy, previewResult] = await Promise.all([
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
          loadCashFlowUnifiedPreview({
            companyId,
            branchId: effectiveBranchId,
            dateFrom,
            dateTo,
            accountFilter,
            paymentLedgerAccountId: paymentLedgerAccountId.trim() || null,
            paymentAccountOptions: paymentAccountOptionsRef.current,
            auditMode,
            sourceModuleFilter,
            basis: previewBasis,
          }),
        ]);
        setPreviewLoadResult(previewResult);
        if (previewResult.preview) {
          setPreviewDiff(compareCashFlowUnifiedPreview({ legacy, preview: previewResult.preview }));
        } else {
          setPreviewDiff(null);
          setPreviewError(previewResult.roznamchaPreview.blockReason ?? 'Unified preview blocked.');
        }
        return;
      }

      const result = await loadCashFlowUnifiedPreview({
        companyId,
        branchId: effectiveBranchId,
        dateFrom,
        dateTo,
        accountFilter,
        paymentLedgerAccountId: paymentLedgerAccountId.trim() || null,
        paymentAccountOptions: paymentAccountOptionsRef.current,
        auditMode,
        sourceModuleFilter,
        basis: previewBasis,
      });
      setPreviewLoadResult(result);
      if (result.roznamchaPreview.blockedByKillSwitch) {
        setPreviewDiff(null);
        setPreviewError(result.roznamchaPreview.blockReason ?? 'Unified preview blocked.');
        return;
      }
      if (result.preview) {
        setPreviewDiff(compareCashFlowUnifiedPreview({ legacy: data, preview: result.preview }));
      } else {
        setPreviewDiff(null);
      }
    } catch {
      setPreviewLoadResult(null);
      setPreviewDiff(null);
      setPreviewError('Unified preview failed to load');
    } finally {
      setPreviewLoading(false);
    }
  }, [
    companyId,
    data,
    unifiedPreviewEnabled,
    dateFrom,
    dateTo,
    effectiveBranchId,
    accountFilter,
    paymentLedgerAccountId,
    auditMode,
    sourceModuleFilter,
    previewBasis,
    mainLoaderSource,
  ]);

  useEffect(() => {
    if (!unifiedPreviewEnabled) {
      setPreviewLoadResult(null);
      setPreviewDiff(null);
      setPreviewError(null);
      return;
    }
    void loadUnifiedPreview();
  }, [unifiedPreviewEnabled, loadUnifiedPreview]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const rows = accountScopedData?.rows ?? [];
    if (!rows.length) return [];
    if (!q) return rows;
    return rows.filter((r) => {
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
  }, [accountScopedData?.rows, searchTerm]);

  const summary = accountScopedData?.summary;

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize) || 1);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    dateFrom,
    dateTo,
    accountFilter,
    paymentLedgerAccountId,
    sourceModuleFilter,
    auditMode,
    searchTerm,
    pageSize,
  ]);

  useEffect(() => {
    setPrintOrientation(reportExport.accountingPrintOptions.orientation);
  }, [reportExport.accountingPrintOptions.orientation]);

  const handleOpenPdfPreview = useCallback(async () => {
    await reportExport.openPreview();
  }, [reportExport]);

  const printOpts = reportExport.accountingPrintOptions;
  const periodLabel = dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : '—';
  const generatedAt = useMemo(() => new Date().toLocaleString(), [reportExport.previewOpen]);

  // Only build print rows when PDF preview is open/loading (avoid remapping thousands of rows on every filter tick).
  const cashFlowPrintPreview = useMemo(() => {
    if (!summary) return null;
    if (!reportExport.previewOpen && !reportExport.loadingBrand) return null;
    return {
      summaryStats: buildCashFlowSummaryStats(summary, formatCurrency),
      rows: buildCashFlowPrintRows(filteredRows),
      openingBalance: formatCurrency(summary.opening),
      closingBalance: formatCurrency(summary.closing),
    };
  }, [
    reportExport.previewOpen,
    reportExport.loadingBrand,
    summary,
    filteredRows,
    formatCurrency,
  ]);

  const tieOut = useMemo(() => {
    if (!summary || !glSummary) return null;
    return computeCashFlowTieOut(summary.netMovement, glSummary.netChange);
  }, [summary, glSummary]);

  const tieOutHints = useMemo(() => {
    if (!glSummary || !tieOut) return [];
    return buildCashFlowTieOutDiagnosticHints(
      filteredRows.map((r) => ({
        sourceModule: r.sourceModule,
        status: r.status,
        referenceType: r.referenceType,
        party: r.party,
        branchName: r.branchName,
      })),
    );
  }, [filteredRows, glSummary, tieOut]);

  const handleCsvExport = () => {
    const rows = buildCashFlowCsvRows(
      filteredRows.map((r) => ({
        dateTime: formatRoznamchaRowDateTimeDisplay(r.date, r.time || ''),
        reference: r.journalEntryNo ? `${r.reference} (${r.journalEntryNo})` : r.reference,
        party: resolveCashFlowPartyDisplay(r),
        sourceModuleLabel: r.sourceModuleLabel,
        cashAccount: r.cashAccount,
        cashIn: r.cashIn,
        cashOut: r.cashOut,
        runningBalance: r.runningBalance,
        status: r.status,
        branchName: r.branchName,
        auditMode,
      })),
    );
    exportToCSV(
      {
        title: `${businessName} — Cash Flow`,
        headers: [...CASH_FLOW_CSV_HEADERS],
        rows,
      },
      'cash-flow',
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

  const openRowAttachments = useCallback(
    async (row: CashFlowRow) => {
      if (!companyId) return;
      if (row.attachments?.length) {
        setAttachmentsDialogList(row.attachments);
        return;
      }
      const loaded = await loadRowAttachmentsLazy(companyId, {
        sourcePaymentId: row.sourcePaymentId,
        sourceJournalEntryId: row.sourceJournalEntryId,
        referenceType: row.referenceType,
      });
      if (loaded.length) setAttachmentsDialogList(loaded);
    },
    [companyId],
  );

  const renderTableBody = (rows: CashFlowRow[], emptyMessage: string) => {
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="p-10 text-center">
            <p className="text-muted-foreground font-medium">{emptyMessage}</p>
            <p className="text-xs text-muted-foreground mt-2">Try widening the date range or switching to Audit mode.</p>
          </td>
        </tr>
      );
    }
    return rows.map((r) => (
      <tr key={r.id} className="border-t border-border/80 hover:bg-card/40">
        <td className="p-3 text-muted-foreground whitespace-nowrap align-middle">
          {formatRoznamchaRowDateTimeDisplay(r.date, r.time || '')}
        </td>
        <td className="p-3 align-middle min-w-0">
          <div className="font-medium text-foreground leading-snug">{r.reference}</div>
          {r.journalEntryNo && (
            <div className="text-xs text-muted-foreground font-mono">{r.journalEntryNo}</div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug inline-flex items-start gap-1 max-w-full">
            <span>{journalDescriptionForDisplay(r.details, r.sourceModuleLabel)}</span>
            {(r.attachments?.length ?? 0) > 0 ? (
              <TransactionAttachmentIconButton onClick={() => void openRowAttachments(r)} />
            ) : null}
          </div>
        </td>
        <td className="p-3 text-muted-foreground align-middle min-w-[200px] max-w-[280px] break-words leading-snug">
          {resolveCashFlowPartyDisplay(r) || '—'}
        </td>
        <td className="p-3 text-muted-foreground align-middle min-w-[120px]">
          <span className="inline-flex items-center gap-1">
            <Wallet className="w-3 h-3 shrink-0 text-muted-foreground" />
            <span className="leading-snug">{r.cashAccount}</span>
          </span>
        </td>
        <td className="p-3 text-right text-emerald-400 tabular-nums whitespace-nowrap align-middle">
          {r.cashIn > 0 ? formatCurrency(r.cashIn) : '—'}
        </td>
        <td className="p-3 text-right text-red-400 tabular-nums whitespace-nowrap align-middle">
          {r.cashOut > 0 ? formatCurrency(r.cashOut) : '—'}
        </td>
        <td className="p-3 text-right text-foreground tabular-nums font-medium whitespace-nowrap align-middle">
          {formatCurrency(r.runningBalance)}
        </td>
        <td className="p-3 text-muted-foreground text-[11px] leading-tight align-middle w-[72px] max-w-[88px]">
          {r.sourceModuleLabel}
        </td>
        <td className="p-3 whitespace-nowrap align-middle">{renderStatusBadges(r)}</td>
        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap align-middle">{r.branchName || '—'}</td>
      </tr>
    ));
  };

  return (
    <div className="space-y-6 min-w-0" data-cash-flow-main-loader={mainLoaderSource}>
      <ReportBasisBanner
        basis={auditMode ? 'audit_full' : 'effective_party'}
        detail={
          mainLoaderSource === 'unified'
            ? `Unified Cash Flow main loader (Q4=${CASH_FLOW_APPROVED_FINANCE_RULES.Q4} · Q5=${CASH_FLOW_APPROVED_FINANCE_RULES.Q5} · Q7=${CASH_FLOW_APPROVED_FINANCE_RULES.Q7}). Operational grid: cash/bank movement rows.`
            : 'Operational grid: cash/bank movement rows. Normal hides voided and reversal trails; Audit shows them with badges.'
        }
      />

      {showUnifiedPreviewTools ? (
        <div className="flex flex-wrap items-center gap-3 no-print">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={unifiedPreviewEnabled}
              disabled={engineState.killSwitchActive}
              onChange={(e) => setUnifiedPreviewEnabled(e.target.checked)}
              className="rounded border-gray-600 disabled:opacity-50"
            />
            Unified Roznamcha preview (Cash Flow {mainLoaderSource === 'unified' ? 'legacy shadow compare' : 'compare only'})
          </label>
          {unifiedPreviewEnabled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => void loadUnifiedPreview()}
            >
              Refresh preview
            </Button>
          ) : null}
        </div>
      ) : null}
      {unifiedPreviewEnabled && showUnifiedPreviewTools ? (
        <CashFlowUnifiedPreviewPanel
          companyId={companyId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          branchLabel={branchLabel}
          auditMode={auditMode}
          legacyReport={data}
          loadResult={previewLoadResult}
          diff={previewDiff}
          loading={previewLoading}
          error={previewError}
          engineState={engineState}
          previewBasis={previewBasis}
          onPreviewBasisChange={setPreviewBasis}
        />
      ) : null}

      <div className="no-print">
        <ReportActions
          title="Cash Flow"
          onPrint={() => void handleOpenPdfPreview()}
          onOpenPdfPreview={() => void handleOpenPdfPreview()}
          onCsv={handleCsvExport}
          pdfLoading={reportExport.loadingBrand}
          previewContentRef={reportExport.printRef}
          previewDocumentType="ledger"
          previewReference={dateFrom && dateTo ? `CashFlow-${dateFrom}-${dateTo}` : 'CashFlow'}
        />
      </div>

      {reportExport.previewOpen && reportExport.brand && cashFlowPrintPreview ? (
        <PdfPreviewModal
          open={reportExport.previewOpen}
          onClose={reportExport.closePreview}
          title="Cash Flow"
          documentType="ledger"
          reference={dateFrom && dateTo ? `CashFlow-${dateFrom}-${dateTo}` : 'CashFlow'}
          format={reportExport.printFormat}
          orientation={printOrientation}
          showOrientationToggle
          onOrientationChange={setPrintOrientation}
          pageNumbers={printOpts.showFooter}
        >
          <CashBookReportPreview
            brand={reportExport.brand}
            title="Cash Flow"
            subtitle={`${modeLabel} mode · ${liquidityLabel} · ${sourceModuleLabel}`}
            periodLabel={periodLabel}
            branchScopeLabel={branchLabel}
            generatedAt={generatedAt}
            columns={CASH_FLOW_PRINT_COLUMNS}
            rows={cashFlowPrintPreview.rows}
            summaryStats={cashFlowPrintPreview.summaryStats}
            openingBalance={cashFlowPrintPreview.openingBalance}
            closingBalance={cashFlowPrintPreview.closingBalance}
            balanceColumnIndex={6}
            fieldVisibility={printOpts.fieldVisibility}
            showHeader={printOpts.showHeader}
            showFooter={printOpts.showFooter}
            orientation={printOrientation}
            fontSize={printOpts.fontSize}
            dataListFontSize={printOpts.dataListFontSize}
            tableHeaderFontSize={printOpts.tableHeaderFontSize}
            summaryFontSize={printOpts.summaryFontSize}
            columnPaddingPx={printOpts.columnPaddingPx}
            showCurrencySymbol={printOpts.showCurrencySymbol}
            fontFamily={printOpts.fontFamily}
            margins={printOpts.margins}
          />
        </PdfPreviewModal>
      ) : null}

      <div ref={reportExport.printRef} className="sr-only">
        {reportExport.brand && cashFlowPrintPreview ? (
          <CashBookReportPreview
            brand={reportExport.brand}
            title="Cash Flow"
            subtitle={`${modeLabel} mode · ${liquidityLabel} · ${sourceModuleLabel}`}
            periodLabel={periodLabel}
            branchScopeLabel={branchLabel}
            generatedAt={generatedAt}
            columns={CASH_FLOW_PRINT_COLUMNS}
            rows={cashFlowPrintPreview.rows}
            summaryStats={cashFlowPrintPreview.summaryStats}
            openingBalance={cashFlowPrintPreview.openingBalance}
            closingBalance={cashFlowPrintPreview.closingBalance}
            balanceColumnIndex={6}
            fieldVisibility={printOpts.fieldVisibility}
            showHeader={printOpts.showHeader}
            showFooter={printOpts.showFooter}
            orientation={printOrientation}
            fontSize={printOpts.fontSize}
            dataListFontSize={printOpts.dataListFontSize}
            tableHeaderFontSize={printOpts.tableHeaderFontSize}
            summaryFontSize={printOpts.summaryFontSize}
            columnPaddingPx={printOpts.columnPaddingPx}
            showCurrencySymbol={printOpts.showCurrencySymbol}
            fontFamily={printOpts.fontFamily}
            margins={printOpts.margins}
          />
        ) : null}
      </div>

      {rangeNarrowedForPerf && overrideGlobalDates && useGlobalRange ? (
        <div className="no-print rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Date range was narrowed to this month for performance (header span exceeded{' '}
          {CASH_FLOW_SAFE_RANGE_DAYS} days). Turn off <strong>Override header dates</strong> below to
          load the full header period.
        </div>
      ) : null}

      <div className="no-print rounded-xl border border-border bg-muted/40 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Date range</Label>
            {useGlobalRange && (
              <div className="flex items-center gap-2 mb-1">
                <Switch
                  checked={overrideGlobalDates}
                  onCheckedChange={(on) => {
                    setOverrideGlobalDates(on);
                    if (!on) setRangeNarrowedForPerf(false);
                  }}
                  id="cf-override-dates"
                />
                <Label htmlFor="cf-override-dates" className="text-xs text-muted-foreground cursor-pointer">
                  Override header dates
                </Label>
              </div>
            )}
            {(!useGlobalRange || overrideGlobalDates) && (
              <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Period" />
            )}
            {useGlobalRange && !overrideGlobalDates && (
              <p className="text-xs text-muted-foreground">
                {globalStartDate?.slice(0, 10)} → {globalEndDate?.slice(0, 10)} (header)
              </p>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Branch</Label>
            <p className="text-sm text-muted-foreground">{branchLabel}</p>
            <p className="text-xs text-muted-foreground">Accounting header branch selector.</p>
          </div>

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Liquidity</Label>
            <Select value={accountFilter} onValueChange={(v: AccountFilter) => setAccountFilter(v)}>
              <SelectTrigger className="w-full bg-input-background border-border text-foreground">
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
            <Label className="text-xs text-muted-foreground">Account</Label>
            <SearchableSelect
              value={paymentLedgerAccountId || '__all__'}
              onValueChange={(v) => setPaymentLedgerAccountId(v === '__all__' ? '' : v)}
              options={accountSelectOptions}
              placeholder="All accounts"
              searchPlaceholder="Search cash/bank/wallet…"
              emptyText="No accounts found."
              className="w-full max-w-none"
            />
            <p className="text-xs text-muted-foreground">
              All cash/bank/wallet books. Select one to show only that account.
            </p>
          </div>

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Source module</Label>
            <Select
              value={sourceModuleFilter}
              onValueChange={(v) => setSourceModuleFilter(v as CashFlowSourceModule | 'all')}
            >
              <SelectTrigger className="w-full bg-input-background border-border text-foreground">
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
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <div className="flex items-center gap-2">
              <Switch id="cf-audit" checked={auditMode} onCheckedChange={setAuditMode} />
              <Label htmlFor="cf-audit" className="text-sm text-muted-foreground cursor-pointer">
                Audit mode
              </Label>
            </div>
            {auditModeNote && <p className="text-xs text-blue-400/90 leading-snug">{auditModeNote}</p>}
          </div>

          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Rows per page</Label>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-full bg-input-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Reference, party, module…"
              className="bg-input-background border-border text-foreground w-full"
            />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading cash flow…</p>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-red-300 font-medium">Could not load cash flow</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{loadError}</p>
          <Button variant="outline" className="border-gray-600" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : summary ? (
        <div className="space-y-6 min-w-0">
          {/* Print header — visible on screen in print block and when printing */}
          <div className="hidden print:block mb-4 text-black">
            <h1 className="text-xl font-bold">{businessName}</h1>
            <h2 className="text-lg font-semibold mt-1">Cash Flow</h2>
            <p className="text-sm mt-2">
              Period: {dateFrom} → {dateTo} · Branch: {branchLabel} · Account: {ledgerAccountLabel} · Liquidity:{' '}
              {liquidityLabel} · Module: {sourceModuleLabel} · Mode: {modeLabel}
            </p>
          </div>

          {(glSummary || glSummaryLoading) && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  GL cash flow summary
                </h3>
                {glSummary ? (
                  <ReportBasisBadge basis={auditMode ? 'official_gl' : 'effective_party'} />
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {glSummaryLoading && !glSummary ? 'Loading GL tie-out…' : glModeNote}
                </span>
              </div>
              {glSummary ? (
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
                      <p className="text-xs text-muted-foreground uppercase tracking-wide print:text-muted-foreground">
                        {card.label}
                      </p>
                      <p
                        className={cn(
                          'text-lg sm:text-xl font-bold mt-1 text-foreground print:text-black',
                          card.accent
                        )}
                      >
                        {formatCurrency(card.value)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-print flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  GL summary loads after the operational grid (non-blocking).
                </div>
              )}
            </div>
          )}

          {tieOut && (
            <div className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-3 print:border-gray-300 print:bg-white">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider print:text-black">
                Tie-out / Difference
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed print:text-gray-700">{CASH_FLOW_TIEOUT_EXPLANATION}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 print:border-gray-300">
                  <p className="text-xs text-muted-foreground uppercase">Operational Net Movement</p>
                  <p className="text-lg font-bold text-foreground mt-1 print:text-black">
                    {formatCurrency(tieOut.operationalNetMovement)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 print:border-gray-300">
                  <p className="text-xs text-muted-foreground uppercase">GL Summary Net Movement</p>
                  <p className="text-lg font-bold text-foreground mt-1 print:text-black">
                    {formatCurrency(tieOut.glNetMovement)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 print:border-gray-300">
                  <p className="text-xs text-muted-foreground uppercase">Difference</p>
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
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Diagnostic hints</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
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

          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
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
                className="rounded-xl border border-border bg-muted/60 p-3 sm:p-4 print:border-gray-300 print:bg-white"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide print:text-muted-foreground">{card.label}</p>
                <p className={cn('text-lg sm:text-xl font-bold mt-1 text-foreground print:text-black', card.accent)}>
                  {formatCurrency(card.value)}
                </p>
              </div>
            ))}
          </div>

          {(runningBalanceNote || auditModeNote) && (
            <div className="no-print space-y-1 text-xs text-muted-foreground">
              {runningBalanceNote && <p>{runningBalanceNote}</p>}
            </div>
          )}

          <div className="relative rounded-xl border border-border overflow-hidden print:border-gray-300">
            {loading ? (
              <div
                className="no-print absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-input-background/70 backdrop-blur-sm pointer-events-none"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading cash flow…</p>
              </div>
            ) : null}
            <div className="overflow-x-auto -mx-px">
              <table className="w-full text-sm min-w-[1080px] table-fixed print:min-w-0 print:text-black">
                <colgroup>
                  <col className="w-[132px]" />
                  <col className="w-[168px]" />
                  <col className="w-[240px]" />
                  <col className="w-[136px]" />
                  <col className="w-[96px]" />
                  <col className="w-[96px]" />
                  <col className="w-[120px]" />
                  <col className="w-[80px]" />
                  <col className="w-[96px]" />
                  <col className="w-[96px]" />
                </colgroup>
                <thead>
                  <tr className="bg-card text-muted-foreground text-left text-xs uppercase tracking-wide print:bg-gray-100 print:text-gray-700">
                    <th className="p-3 align-middle">Date</th>
                    <th className="p-3 align-middle">Reference</th>
                    <th className="p-3 align-middle">Party</th>
                    <th className="p-3 align-middle">Cash/bank account</th>
                    <th className="p-3 text-right align-middle">In</th>
                    <th className="p-3 text-right align-middle">Out</th>
                    <th className="p-3 text-right align-middle">Running balance</th>
                    <th className="p-3 align-middle text-[10px] leading-tight">Source</th>
                    <th className="p-3 align-middle">Status</th>
                    <th className="p-3 align-middle">Branch</th>
                  </tr>
                </thead>
                <tbody className="print:text-black">
                  {renderTableBody(
                    paginatedRows,
                    searchTerm.trim()
                      ? 'No cash movement found for selected filters.'
                      : 'No cash movement found for selected filters.',
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t border-border no-print">
              <p className="text-xs text-muted-foreground">
                {totalRows === 0
                  ? `0 row(s) · Page ${currentPage} of ${totalPages} · ${modeLabel} mode · Read-only`
                  : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRows)} of ${totalRows} · Page ${currentPage} of ${totalPages} · ${pageSize}/page · ${modeLabel} mode · Read-only`}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border text-muted-foreground"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 ? (
                        <span className="px-1 text-muted-foreground">…</span>
                      ) : null}
                      <button
                        type="button"
                        className={cn(
                          'h-8 min-w-[2rem] rounded px-2 text-sm font-medium',
                          p === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted',
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
                  className="h-8 border-border text-muted-foreground"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 p-8 text-center space-y-4">
          <p className="text-muted-foreground">No cash flow data for the selected period.</p>
          <Button variant="outline" className="border-gray-600" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
      {attachmentsDialogList ? (
        <AttachmentViewer
          attachments={attachmentsDialogList}
          isOpen={!!attachmentsDialogList}
          onClose={() => setAttachmentsDialogList(null)}
        />
      ) : null}
    </div>
  );
}

export default CashFlowReportPage;
