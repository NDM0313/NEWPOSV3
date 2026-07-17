/**
 * Roznamcha – Daily Cash Book (Pakistan/India style).
 * Cash In / Cash Out only (not Journal Debit/Credit).
 * Structure: Filters → Summary Cards → Cash Split → Roznamcha Table.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccountingReportReload } from '@/app/hooks/useAccountingReportReload';
import { useSupabase } from '@/app/context/SupabaseContext';
import { ReportActions } from './ReportActions';
import { PdfPreviewModal, type PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';
import { useReportExport } from './shared/useReportExport';
import { CashBookReportPreview } from './shared/CashBookReportPreview';
import {
  buildRoznamchaPrintRows,
  buildRoznamchaSummaryStats,
  ROZNAMCHA_PRINT_COLUMNS,
  roznamchaDetailsForDisplay,
} from './shared/buildRoznamchaPrintPreview';
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
import { formatRoznamchaRowDateTimeDisplay } from '@/app/utils/transactionEventDateTime';
import {
  roznamchaJournalSubtitle,
  roznamchaRefDisplay,
  type AccountFilter,
  type RoznamchaResult,
  type RoznamchaRowWithBalance,
} from '@/app/services/roznamchaService';
import { assertUnifiedMainLoaderSource } from '@/app/lib/r8R2LegacyMainRetired';
import { loadRoznamchaUnifiedMain } from '@/app/services/roznamchaUnifiedMainService';
import { loadRoznamchaLegacyShadowPreview } from '@/app/services/roznamchaLegacyShadowPreviewService';
import {
  resolveRoznamchaMainLoaderSource,
  effectiveRoznamchaMainLoaderSource,
} from '@/app/lib/resolveRoznamchaMainLoaderSource';
import {
  resolveRoznamchaPreviewCompareSource,
  buildRoznamchaPreviewCompareArgs,
} from '@/app/lib/resolveRoznamchaPreviewCompareSource';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import { accountService } from '@/app/services/accountService';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { canAccessRoznamchaUnifiedPreview } from '@/app/lib/roznamchaUnifiedPreviewAccess';
import {
  compareRoznamchaUnifiedPreview,
  defaultUnifiedBasisForRoznamcha,
  type RoznamchaUnifiedPreviewDiff,
} from '@/app/lib/roznamchaUnifiedPreviewDiff';
import { loadRoznamchaUnifiedPreview } from '@/app/services/roznamchaUnifiedPreviewService';
import { buildRoznamchaPreviewRpcScope } from '@/app/lib/roznamchaUnifiedPreviewScope';
import { useUnifiedLedgerEngineState } from '@/app/hooks/useUnifiedLedgerEngineState';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { RoznamchaUnifiedPreviewPanel } from '@/app/components/reports/RoznamchaUnifiedPreviewPanel';
import { DIN_CHINA_COMPANY_ID } from '@/app/lib/unifiedLedgerGoldenFixtures';
import { toast } from 'sonner';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { isTransactionActionPanelEnabled } from '@/app/lib/transactionActionRules';
import {
  buildSyntheticAccountingEntryFromRoznamchaRow,
  roznamchaAllowsUnifiedEdit,
  roznamchaRowHasActionTarget,
} from '@/app/lib/roznamchaTransactionActions';
import { useJournalTransactionActionHandlers } from '@/app/hooks/useJournalTransactionActionHandlers';
import { RoznamchaRowTransactionActions } from '@/app/components/reports/RoznamchaRowTransactionActions';
import { TransactionDetailModal } from '@/app/components/accounting/TransactionDetailModal';
import { TransactionConfirmDialog } from '@/app/components/accounting/TransactionConfirmDialog';
import { AttachmentViewer } from '@/app/components/shared/AttachmentViewer';
import { TransactionAttachmentIconButton } from '@/app/components/shared/TransactionAttachmentIconButton';
import { roznamchaRowHasAttachments } from '@/app/lib/roznamchaAttachments';
import type { TransactionAttachment } from '@/app/utils/transactionAttachments';
import { exportToExcel } from '@/app/utils/exportUtils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { Loader2, BookOpen, Wallet, Building2, CreditCard, Smartphone, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { format, parseISO } from 'date-fns';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';

function rowSortTimestamp(r: RoznamchaRowWithBalance): number {
  const t = r.time?.length === 5 ? `${r.time}:00` : r.time || '00:00:00';
  try {
    return new Date(`${r.date}T${t}`).getTime();
  } catch {
    return 0;
  }
}

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
      'inline-flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm',
      label === '—' ? 'text-muted-foreground' : 'text-gray-200'
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
  const { companyId, branchId: contextBranchId, userRole } = useSupabase();
  const reloadEpoch = useAccountingReportReload({ companyId, branchId: contextBranchId });
  const { canPostAccounting } = useCheckPermission();
  const useTransactionActionPanel = isTransactionActionPanelEnabled();
  const showRoznamchaActions = canPostAccounting && useTransactionActionPanel;
  const {
    busy: actionBusy,
    transactionReference,
    transactionJournalEntryIdHint,
    transactionDetailAutoEdit,
    transactionDetailAutoOpenTrace,
    transactionDetailScrollToAudit,
    clearTransactionDetail,
    setTransactionDetailAutoEdit,
    setTransactionDetailAutoOpenTrace,
    setTransactionDetailScrollToAudit,
    handleOpenJournalSourceDocument,
    openFromRoznamchaRow,
    handleJournalUndoLastChange,
    handleJournalCancelPayment,
    handleJournalCancelEntry,
    handleJournalCancelOrphan,
    pendingConfirm,
    dismissPendingConfirm,
    confirmPendingJournalAction,
  } = useJournalTransactionActionHandlers();
  const reportExport = useReportExport({ companyId, documentType: 'ledger', reportKind: 'roznamcha' });
  const { formatCurrency } = useFormatCurrency();
  const [printOrientation, setPrintOrientation] = useState<PdfPreviewOrientation>('landscape');
  const { formatDate, formatDateTime } = useFormatDate();
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: today, to: today });
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  /** Ledger row filter: single payment (cash/bank/wallet) account — all types when empty */
  const [paymentLedgerAccountId, setPaymentLedgerAccountId] = useState<string>('');
  const [paymentAccountOptions, setPaymentAccountOptions] = useState<Array<{ id: string; label: string }>>([]);
  /** Default off: voided payments (e.g. reversed receipts) are excluded from cash book totals. */
  const [includeVoidedReversed, setIncludeVoidedReversed] = useState(false);
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<RoznamchaResult | null>(null);
  const [mainLoaderSource, setMainLoaderSource] = useState<'legacy' | 'unified'>('legacy');
  const [mainUnifiedRows, setMainUnifiedRows] = useState<UnifiedLedgerRow[]>([]);
  const previewCompareSource = useMemo(
    () => resolveRoznamchaPreviewCompareSource(mainLoaderSource),
    [mainLoaderSource],
  );
  const [loading, setLoading] = useState(!!companyId);
  const [currentPage, setCurrentPage] = useState(1);
  /** When Accounting uses global header dates, still allow a local start/end (or single day) here */
  const [overrideGlobalDates, setOverrideGlobalDates] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<TransactionAttachment[] | null>(null);

  const showUnifiedPreviewTools = canAccessRoznamchaUnifiedPreview(userRole);
  const [unifiedPreviewEnabled, setUnifiedPreviewEnabled] = useState(false);
  const [previewBasis, setPreviewBasis] = useState<UnifiedLedgerBasis>('effective_party');
  const [previewResult, setPreviewResult] = useState<Awaited<ReturnType<typeof loadRoznamchaUnifiedPreview>> | null>(null);
  const [previewDiff, setPreviewDiff] = useState<RoznamchaUnifiedPreviewDiff | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { state: engineState } = useUnifiedLedgerEngineState(companyId, {
    screenId: UNIFIED_LEDGER_SCREEN_IDS.ROZNAMCHA,
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

  const orderedRows = useMemo(() => {
    if (!data?.rows?.length) return [];
    const copy = [...data.rows];
    copy.sort((a, b) => rowSortTimestamp(a) - rowSortTimestamp(b));
    if (dateSort === 'desc') copy.reverse();
    return copy;
  }, [data?.rows, dateSort]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orderedRows;
    return orderedRows.filter((r) => {
      const textHay = [
        r.ref,
        r.journalEntryNo,
        roznamchaRefDisplay(r),
        roznamchaJournalSubtitle(r),
        roznamchaDetailsForDisplay(r),
        r.referenceDisplay,
        r.partyLine,
        r.type,
        r.accountLabel,
        r.accountName,
        r.createdBy,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (textHay.includes(q)) return true;
      const amtHay = [
        r.amount,
        r.cashIn,
        r.cashOut,
        r.runningBalance,
      ]
        .map((n) => String(n ?? ''))
        .join(' ');
      return amtHay.includes(q.replace(/,/g, ''));
    });
  }, [orderedRows, searchTerm]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginatedRows = useMemo(() => {
    if (!filteredRows.length) return [];
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const useGlobalRange = Boolean(globalStartDate && globalEndDate);
  const dateFrom = useMemo(() => {
    if (useGlobalRange && !overrideGlobalDates) {
      return (globalStartDate ?? '').slice(0, 10);
    }
    if (dateRange.from) return format(dateRange.from, 'yyyy-MM-dd');
    return '';
  }, [useGlobalRange, overrideGlobalDates, globalStartDate, dateRange.from]);

  const dateTo = useMemo(() => {
    if (useGlobalRange && !overrideGlobalDates) {
      return (globalEndDate ?? '').slice(0, 10);
    }
    if (dateRange.to) return format(dateRange.to, 'yyyy-MM-dd');
    if (dateRange.from) return format(dateRange.from, 'yyyy-MM-dd');
    return dateFrom;
  }, [useGlobalRange, overrideGlobalDates, globalEndDate, dateRange.to, dateRange.from, dateFrom]);

  useEffect(() => {
    if (!useGlobalRange || !overrideGlobalDates) return;
    if (dateRange.from && dateRange.to) return;
    try {
      const gs = globalStartDate?.slice(0, 10);
      const ge = globalEndDate?.slice(0, 10);
      if (gs && ge) {
        setDateRange({ from: parseISO(gs), to: parseISO(ge) });
      }
    } catch {
      /* keep existing range */
    }
  }, [useGlobalRange, overrideGlobalDates, globalStartDate, globalEndDate, dateRange.from, dateRange.to]);

  const rowDateTime = (r: RoznamchaRowWithBalance) => {
    if (!r.date) return r.time || '—';
    return formatRoznamchaRowDateTimeDisplay(r.date, r.time || '');
  };

  const effectiveBranchId = contextBranchId === 'all' ? null : (contextBranchId || null);

  useEffect(() => {
    if (!includeVoidedReversed) {
      setPreviewBasis(defaultUnifiedBasisForRoznamcha(false));
    } else {
      setPreviewBasis(defaultUnifiedBasisForRoznamcha(true));
    }
  }, [includeVoidedReversed]);

  const loadUnifiedPreview = useCallback(async () => {
    if (!companyId || !unifiedPreviewEnabled || !data || !dateFrom || !dateTo) {
      setPreviewResult(null);
      setPreviewDiff(null);
      return;
    }
    if (engineState.killSwitchActive) {
      setPreviewResult(null);
      setPreviewDiff(null);
      setPreviewError('Unified preview disabled — kill switch active.');
      return;
    }

    const ledgerId = paymentLedgerAccountId.trim() ? paymentLedgerAccountId.trim() : null;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const compareSource = resolveRoznamchaPreviewCompareSource(mainLoaderSource);

      if (compareSource === 'legacy_shadow') {
        const shadow = await loadRoznamchaLegacyShadowPreview({
          companyId,
          branchId: effectiveBranchId,
          dateFrom,
          dateTo,
          accountFilter,
          includeVoidedReversed,
          paymentLedgerAccountId: ledgerId,
        });
        setPreviewResult({
          rows: [],
          unifiedRows: [],
          closingBalance: shadow.closingBalance,
          openingBalance: shadow.openingBalance,
          meta: {
            engine: 'legacy_gl',
            basis: previewBasis,
            featureFlagEnabled: true,
            shadowForce: true,
            queryDurationMs: 0,
            rowCount: shadow.legacy.rows.length,
            periodOpeningBalance: shadow.openingBalance,
            message: 'Legacy shadow compare — main table uses unified loader.',
          },
          basis: previewBasis,
          rpcScope: buildRoznamchaPreviewRpcScope({
            branchId: effectiveBranchId,
            dateFrom,
            dateTo,
            accountFilter,
            includeVoidedReversed,
          }),
          paymentAccountFilterApplied: Boolean(ledgerId),
        });
        const compareArgs = buildRoznamchaPreviewCompareArgs({
          compareSource,
          mainResult: data,
          mainUnifiedRows,
          shadowLegacy: shadow.legacy,
          shadowUnifiedRows: [],
          shadowClosingBalance: shadow.closingBalance,
          shadowOpeningBalance: shadow.openingBalance,
        });
        setPreviewDiff(
          compareRoznamchaUnifiedPreview({
            legacy: compareArgs.legacy,
            unifiedRows: compareArgs.unifiedRows,
            unifiedClosingBalance: compareArgs.unifiedClosingBalance,
            unifiedOpeningBalance: compareArgs.unifiedOpeningBalance,
          }),
        );
      } else {
        const preview = await loadRoznamchaUnifiedPreview({
          companyId,
          branchId: effectiveBranchId,
          dateFrom,
          dateTo,
          accountFilter,
          includeVoidedReversed,
          paymentLedgerAccountId: ledgerId,
          paymentAccountOptions,
          basis: previewBasis,
        });
        setPreviewResult(preview);
        if (preview.blockedByKillSwitch) {
          setPreviewDiff(null);
          setPreviewError(preview.blockReason ?? 'Unified preview blocked.');
          return;
        }
        const compareArgs = buildRoznamchaPreviewCompareArgs({
          compareSource,
          mainResult: data,
          mainUnifiedRows,
          shadowLegacy: data,
          shadowUnifiedRows: preview.unifiedRows,
          shadowClosingBalance: preview.closingBalance,
          shadowOpeningBalance: preview.openingBalance,
        });
        setPreviewDiff(
          compareRoznamchaUnifiedPreview({
            legacy: compareArgs.legacy,
            unifiedRows: compareArgs.unifiedRows,
            unifiedClosingBalance: compareArgs.unifiedClosingBalance,
            unifiedOpeningBalance: compareArgs.unifiedOpeningBalance,
          }),
        );
      }
    } catch (err) {
      console.error(err);
      setPreviewResult(null);
      setPreviewDiff(null);
      setPreviewError(
        previewCompareSource === 'legacy_shadow'
          ? 'Legacy shadow compare failed to load'
          : 'Unified preview failed to load',
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [
    companyId,
    unifiedPreviewEnabled,
    data,
    dateFrom,
    dateTo,
    effectiveBranchId,
    accountFilter,
    includeVoidedReversed,
    paymentLedgerAccountId,
    paymentAccountOptions,
    previewBasis,
    engineState.killSwitchActive,
    mainLoaderSource,
    mainUnifiedRows,
    previewCompareSource,
  ]);

  useEffect(() => {
    if (!unifiedPreviewEnabled) {
      setPreviewResult(null);
      setPreviewDiff(null);
      setPreviewError(null);
      return;
    }
    void loadUnifiedPreview();
  }, [unifiedPreviewEnabled, loadUnifiedPreview, mainLoaderSource]);

  const handleLoadDinChinaPeriodHint = useCallback(() => {
    if (companyId !== DIN_CHINA_COMPANY_ID) {
      toast.message('DIN CHINA preset applies when logged into DIN CHINA tenant.');
      return;
    }
    toast.message('Use Roznamcha date range for DIN CHINA validation period. Preview compares legacy vs unified cash/bank ledger.');
  }, [companyId]);

  const displayFiltersActive = searchTerm.trim().length > 0 || dateSort !== 'asc' || pageSize !== 50;
  const paymentAccountFilterActive = Boolean(paymentLedgerAccountId.trim());

  const load = useCallback(async () => {
    if (!companyId || !dateFrom || !dateTo) {
      setData(null);
      setLoading(false);
      return;
    }
    const ledgerId = paymentLedgerAccountId.trim() ? paymentLedgerAccountId.trim() : null;
    setLoading(true);
    try {
      const resolved = await resolveRoznamchaMainLoaderSource(companyId);
      const mainSource = effectiveRoznamchaMainLoaderSource(resolved);
      setMainLoaderSource(mainSource);

      assertUnifiedMainLoaderSource(mainSource);
      setMainUnifiedRows([]);
      const unified = await loadRoznamchaUnifiedMain({
        companyId,
        branchId: effectiveBranchId,
        dateFrom,
        dateTo,
        accountFilter,
        includeVoidedReversed,
        paymentLedgerAccountId: ledgerId,
        paymentAccountOptions,
        basis: previewBasis,
      });
      setMainUnifiedRows(unified.unifiedRows);
      setData(unified);
    } catch (err) {
      console.error('[RoznamchaReport] load failed:', err);
      toast.error('Could not load Roznamcha. Try refreshing or widening the date range.');
      setData(null);
      setMainUnifiedRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    effectiveBranchId,
    dateFrom,
    dateTo,
    accountFilter,
    includeVoidedReversed,
    paymentLedgerAccountId,
    paymentAccountOptions,
    previewBasis,
    reloadEpoch,
  ]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(1);
  }, [currentPage, totalPages]);
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, accountFilter, includeVoidedReversed, paymentLedgerAccountId, dateSort, pageSize, overrideGlobalDates, searchTerm]);

  const selectedBranchLabel = contextBranchId === 'all' || !contextBranchId ? 'All Branches' : 'Selected branch';

  useEffect(() => {
    setPrintOrientation(reportExport.accountingPrintOptions.orientation);
  }, [reportExport.accountingPrintOptions.orientation]);

  const handleOpenPdfPreview = useCallback(async () => {
    await reportExport.openPreview();
  }, [reportExport]);

  const printOpts = reportExport.accountingPrintOptions;
  const periodLabel = dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : '—';
  const generatedAt = useMemo(() => new Date().toLocaleString(), [reportExport.previewOpen]);

  const rozPrintPreview = useMemo(() => {
    if (!data?.summary) return null;
    return {
      summaryStats: buildRoznamchaSummaryStats(data.summary, formatCurrency),
      rows: buildRoznamchaPrintRows(filteredRows, roznamchaDetailsForDisplay),
      openingBalance: formatCurrency(data.summary.openingBalance),
      closingBalance: formatCurrency(data.summary.closingBalance),
    };
  }, [data?.summary, filteredRows, formatCurrency]);

  const exportData = {
    title: `Roznamcha ${dateFrom} to ${dateTo} – ${selectedBranchLabel}`,
    headers: ['Date & Time', 'Ref / Journal', 'Details', 'Account', 'Cash In', 'Cash Out', 'Balance'],
    rows: data
      ? [
          ['Opening', '—', 'Opening Balance', '—', '', '', data.summary.openingBalance],
          ...filteredRows.map((r: RoznamchaRowWithBalance) => {
            const meta = [r.referenceDisplay, r.partyLine, r.createdBy ? `by ${r.createdBy}` : ''].filter(Boolean).join(' • ');
            const jeSub = roznamchaJournalSubtitle(r);
            const refCol = jeSub ? `${roznamchaRefDisplay(r)}\n${jeSub}` : roznamchaRefDisplay(r);
            return [
            rowDateTime(r),
            refCol,
            meta ? `${roznamchaDetailsForDisplay(r)}\n${meta}` : roznamchaDetailsForDisplay(r),
            (r.accountName ?? r.accountLabel) || '—',
            r.cashIn || '',
            r.cashOut || '',
            r.runningBalance,
          ];
          }),
        ]
      : [],
  };

  return (
    <div
      className="space-y-6 animate-in slide-in-from-bottom-2 duration-300"
      data-roznamcha-main-loader={mainLoaderSource}
      data-roznamcha-preview-compare-source={unifiedPreviewEnabled ? previewCompareSource : undefined}
    >
      <ReportBasisBanner
        basis={includeVoidedReversed ? 'audit_full' : 'effective_party'}
        detail="Operational cash book — payments and rental_payments only (not full GL). Toggle voided rows for audit view."
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
            Unified engine preview (compare only)
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleLoadDinChinaPeriodHint}
          >
            Load DIN CHINA period
          </Button>
        </div>
      ) : null}

      {unifiedPreviewEnabled && showUnifiedPreviewTools ? (
        <RoznamchaUnifiedPreviewPanel
          dateFrom={dateFrom}
          dateTo={dateTo}
          branchLabel={selectedBranchLabel}
          accountFilter={accountFilter}
          includeVoidedReversed={includeVoidedReversed}
          paymentAccountFilterActive={paymentAccountFilterActive}
          previewResult={previewResult}
          diff={previewDiff}
          loading={previewLoading}
          error={previewError}
          engineState={engineState}
          previewBasis={previewBasis}
          onPreviewBasisChange={setPreviewBasis}
          displayFiltersActive={displayFiltersActive}
          previewCompareSource={previewCompareSource}
        />
      ) : null}

      <p className="text-xs text-muted-foreground border border-border/80 rounded-lg px-3 py-2 bg-input-background/40 max-w-3xl">
        Cash / bank / wallet receive &amp; pay only — from <strong className="text-muted-foreground">payments</strong> and{' '}
        <strong className="text-muted-foreground">rental_payments</strong> (not rental journal vouchers). One row per actual
        movement. Incoming receipts (sale, rental, manual) show as <strong className="text-muted-foreground">RCV-*</strong>;{' '}
        <strong className="text-muted-foreground">JE-*</strong> appears as a subtitle when linked.{' '}
        <span className="text-muted-foreground">
          Match header date range to payment_date; use All Branches and All accounts if a line is missing.
        </span>
      </p>
      <div className="no-print">
        <ReportActions
          title="Roznamcha"
          onPrint={() => void handleOpenPdfPreview()}
          onOpenPdfPreview={() => void handleOpenPdfPreview()}
          onExcel={() => exportToExcel(exportData, 'Roznamcha')}
          pdfLoading={reportExport.loadingBrand}
          onWhatsapp={() => {
            const s = data?.summary;
            reportExport.shareViaWhatsApp({
              title: 'Roznamcha (Daily Cash Book)',
              period: `${dateFrom} to ${dateTo}`,
              message: [
                'Roznamcha (Daily Cash Book)',
                `Period: ${dateFrom} to ${dateTo}`,
                s
                  ? `Opening: ${s.openingBalance.toLocaleString()} · In: ${s.cashIn.toLocaleString()} · Out: ${s.cashOut.toLocaleString()} · Closing: ${s.closingBalance.toLocaleString()}`
                  : '',
                `Rows shown: ${filteredRows.length}`,
              ]
                .filter(Boolean)
                .join('\n'),
            });
          }}
          previewContentRef={reportExport.printRef}
          previewDocumentType="ledger"
          previewReference={dateFrom && dateTo ? `Roznamcha-${dateFrom}-${dateTo}` : 'Roznamcha'}
        />
      </div>

      {reportExport.previewOpen && reportExport.brand && rozPrintPreview ? (
        <PdfPreviewModal
          open={reportExport.previewOpen}
          onClose={reportExport.closePreview}
          title="Roznamcha (Daily Cash Book)"
          documentType="ledger"
          reference={dateFrom && dateTo ? `Roznamcha-${dateFrom}-${dateTo}` : 'Roznamcha'}
          format={reportExport.printFormat}
          orientation={printOrientation}
          showOrientationToggle
          onOrientationChange={setPrintOrientation}
          pageNumbers={printOpts.showFooter}
        >
          <CashBookReportPreview
            brand={reportExport.brand}
            title="Roznamcha (Daily Cash Book)"
            periodLabel={periodLabel}
            branchScopeLabel={selectedBranchLabel}
            generatedAt={generatedAt}
            columns={ROZNAMCHA_PRINT_COLUMNS}
            rows={rozPrintPreview.rows}
            summaryStats={rozPrintPreview.summaryStats}
            openingBalance={rozPrintPreview.openingBalance}
            closingBalance={rozPrintPreview.closingBalance}
            fieldVisibility={printOpts.fieldVisibility}
            showHeader={printOpts.showHeader}
            showFooter={printOpts.showFooter}
            orientation={printOrientation}
            fontSize={printOpts.fontSize}
            fontFamily={printOpts.fontFamily}
            margins={printOpts.margins}
          />
        </PdfPreviewModal>
      ) : null}

      <div ref={reportExport.printRef} className="sr-only">
        {reportExport.brand && rozPrintPreview ? (
          <CashBookReportPreview
            brand={reportExport.brand}
            title="Roznamcha (Daily Cash Book)"
            periodLabel={periodLabel}
            branchScopeLabel={selectedBranchLabel}
            generatedAt={generatedAt}
            columns={ROZNAMCHA_PRINT_COLUMNS}
            rows={rozPrintPreview.rows}
            summaryStats={rozPrintPreview.summaryStats}
            openingBalance={rozPrintPreview.openingBalance}
            closingBalance={rozPrintPreview.closingBalance}
            fieldVisibility={printOpts.fieldVisibility}
            showHeader={printOpts.showHeader}
            showFooter={printOpts.showFooter}
            orientation={printOrientation}
            fontSize={printOpts.fontSize}
            fontFamily={printOpts.fontFamily}
            margins={printOpts.margins}
          />
        ) : null}
      </div>

      <div className="space-y-6">

      {/* 1. FILTERS */}
      <div className="no-print rounded-xl border border-border bg-muted/40 p-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-5 items-start">
          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date range</Label>
            {useGlobalRange ? (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Header: {globalStartDate?.slice(0, 10)} → {globalEndDate?.slice(0, 10)}
                  {!overrideGlobalDates ? ' (active)' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Switch
                    id="roznamcha-override-global-dates"
                    checked={overrideGlobalDates}
                    onCheckedChange={setOverrideGlobalDates}
                  />
                  <Label htmlFor="roznamcha-override-global-dates" className="text-sm text-muted-foreground cursor-pointer">
                    Custom start / end (override)
                  </Label>
                </div>
                {overrideGlobalDates && (
                  <>
                    <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Start & end (or one day)" />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Today', days: 0, single: true },
                        { label: 'Yesterday', days: 1, single: true },
                        { label: 'Last 5 days', days: 4, single: false },
                        { label: 'Last 7 days', days: 6, single: false },
                        { label: 'Last 30 days', days: 29, single: false },
                        { label: 'This month', days: -1, single: false },
                      ].map(({ label, days, single }) => (
                        <Button
                          key={label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-border text-muted-foreground hover:bg-muted"
                          onClick={() => {
                            const t = new Date(); t.setHours(0,0,0,0);
                            if (days === -1) {
                              const from = new Date(t.getFullYear(), t.getMonth(), 1);
                              setDateRange({ from, to: t });
                            } else if (single) {
                              const d = new Date(t); d.setDate(d.getDate() - days);
                              setDateRange({ from: d, to: d });
                            } else {
                              const from = new Date(t); from.setDate(from.getDate() - days);
                              setDateRange({ from, to: t });
                            }
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Start & end (same day = single date)" />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Today', days: 0, single: true },
                    { label: 'Yesterday', days: 1, single: true },
                    { label: 'Last 5 days', days: 4, single: false },
                    { label: 'Last 7 days', days: 6, single: false },
                    { label: 'Last 30 days', days: 29, single: false },
                    { label: 'This month', days: -1, single: false },
                  ].map(({ label, days, single }) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-border text-muted-foreground hover:bg-muted"
                      onClick={() => {
                        const t = new Date(); t.setHours(0,0,0,0);
                        if (days === -1) {
                          const from = new Date(t.getFullYear(), t.getMonth(), 1);
                          setDateRange({ from, to: t });
                        } else if (single) {
                          const d = new Date(t); d.setDate(d.getDate() - days);
                          setDateRange({ from: d, to: d });
                        } else {
                          const from = new Date(t); from.setDate(from.getDate() - days);
                          setDateRange({ from, to: t });
                        }
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Branch</Label>
            <BranchSelector variant="inline" showAllBranchesOption />
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Liquidity</Label>
            <Select value={accountFilter} onValueChange={(v: AccountFilter) => setAccountFilter(v)}>
              <SelectTrigger className="w-full max-w-[200px] bg-input-background border-border text-foreground">
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

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Ledger account</Label>
            <Select
              value={paymentLedgerAccountId || '__all__'}
              onValueChange={(v) => setPaymentLedgerAccountId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-full min-w-0 max-w-[320px] bg-input-background border-border text-foreground">
                <SelectValue placeholder="All payment accounts" />
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
            <span className="text-xs text-muted-foreground">One Cash/Bank/Wallet GL book (optional).</span>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date order</Label>
            <Select value={dateSort} onValueChange={(v: 'asc' | 'desc') => setDateSort(v)}>
              <SelectTrigger className="w-full max-w-[200px] bg-input-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Oldest first</SelectItem>
                <SelectItem value="desc">Newest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Rows per page</Label>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-full max-w-[120px] bg-input-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 min-w-0 sm:col-span-2 lg:col-span-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ref, description, party, or amount…"
                className="pl-9 bg-input-background border-border text-foreground h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0 sm:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Switch
                id="roznamcha-include-voided"
                checked={includeVoidedReversed}
                onCheckedChange={setIncludeVoidedReversed}
              />
              <Label htmlFor="roznamcha-include-voided" className="text-sm text-muted-foreground cursor-pointer leading-snug">
                Include voided payments (audit)
              </Label>
            </div>
            <span className="text-xs text-muted-foreground">
              Off by default: reversed/voided receipts do not affect Roznamcha totals.
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/80">
          Date: {dateFrom} → {dateTo}
          {useGlobalRange && !overrideGlobalDates ? ' (from top bar)' : ''}
          {useGlobalRange && overrideGlobalDates ? ' (custom override)' : ''}
          {' · '}
          Branch: {selectedBranchLabel} · Liquidity:{' '}
          {accountFilter === 'all' ? 'All' : accountFilter === 'wallet' ? 'Wallet' : accountFilter}
          {paymentLedgerAccountId
            ? ` · Ledger: ${paymentAccountOptions.find((o) => o.id === paymentLedgerAccountId)?.label || paymentLedgerAccountId}`
            : ''}
          {' · '}
          Order: {dateSort === 'asc' ? 'oldest first' : 'newest first'} · {pageSize}/page
          {includeVoidedReversed ? ' · Voided rows shown' : ''}
        </p>
      </div>

      {loading && !data ? (
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
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cash Split</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between rounded-lg bg-input-background border border-border px-4 py-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Wallet size={18} /> Cash
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {data.cashSplit.cash.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-input-background border border-border px-4 py-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Building2 size={18} /> Bank
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {data.cashSplit.bank.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-input-background border border-border px-4 py-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Smartphone size={18} /> Wallet
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {data.cashSplit.wallet.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted border border-border px-4 py-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <CreditCard size={18} /> Total
                </span>
                <span className="font-mono font-bold text-foreground">
                  {data.cashSplit.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 4. ROZNAMCHA TABLE */}
          <div className="relative rounded-xl border border-border overflow-hidden bg-muted/40">
            {loading ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-input-background/70 backdrop-blur-sm pointer-events-none"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading roznamcha…</p>
              </div>
            ) : null}
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider p-4 border-b border-border">
              Roznamcha Table
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-base leading-snug">
                <thead className="bg-card text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-40">Date & Time</th>
                    <th className="px-4 py-3 text-left font-medium w-36">Ref / Journal</th>
                    <th className="px-4 py-3 text-left font-medium">Details</th>
                    <th className="px-4 py-3 text-left font-medium w-24">Account</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Cash In</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Cash Out</th>
                    <th className="px-4 py-3 text-right font-medium w-32">Balance</th>
                    {showRoznamchaActions ? (
                      <th className="px-2 py-3 text-left font-medium w-12">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="bg-muted/40">
                    <td className="px-4 py-3 text-muted-foreground">Opening</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-muted-foreground">Opening Balance</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {data.summary.openingBalance.toLocaleString()}
                    </td>
                    {showRoznamchaActions ? <td className="px-2 py-3 w-12" /> : null}
                  </tr>
                  {paginatedRows.map((r: RoznamchaRowWithBalance, i: number) => (
                    <tr
                      key={r.id}
                      className={cn(
                        'hover:bg-accent/30 transition-colors',
                        roznamchaRowHasActionTarget(r) ? 'cursor-pointer' : '',
                        i % 2 === 0 ? 'bg-muted/30' : 'bg-card/20'
                      )}
                      onClick={() => {
                        if (!roznamchaRowHasActionTarget(r) || actionBusy) return;
                        openFromRoznamchaRow(r);
                      }}
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {r.date && r.time ? (
                          <DateTimeDisplay
                            date={new Date(r.date + 'T' + (r.time.length === 5 ? r.time + ':00' : r.time))}
                          />
                        ) : (
                          rowDateTime(r)
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[7rem]">
                        <div className="font-mono text-muted-foreground">{roznamchaRefDisplay(r)}</div>
                        {roznamchaJournalSubtitle(r) ? (
                          <div className="text-xs text-muted-foreground mt-0.5 font-sans">{roznamchaJournalSubtitle(r)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="inline-flex items-start gap-1 max-w-full">
                          <div className="font-medium text-foreground min-w-0">{roznamchaDetailsForDisplay(r)}</div>
                          {roznamchaRowHasAttachments(r) ? (
                            <TransactionAttachmentIconButton
                              onClick={() => setAttachmentsDialogList(r.attachments ?? [])}
                            />
                          ) : null}
                        </div>
                        {(r.referenceDisplay || r.partyLine || r.createdBy) && (
                          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {[
                              journalDescriptionForDisplay(r.referenceDisplay, ''),
                              r.partyLine,
                              r.createdBy ? `by ${r.createdBy}` : '',
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AccountBadge accountLabel={r.accountName ?? r.accountLabel} liquidity={r.accountType} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--erp-money-positive)]">
                        {r.cashIn > 0 ? r.cashIn.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-400">
                        {r.cashOut > 0 ? r.cashOut.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {r.runningBalance.toLocaleString()}
                      </td>
                      {showRoznamchaActions ? (
                        <td className="px-2 py-3 align-top w-12" onClick={(e) => e.stopPropagation()}>
                          {roznamchaRowHasActionTarget(r) ? (
                            <RoznamchaRowTransactionActions
                              row={r}
                              busy={actionBusy}
                              allowUnifiedEdit={roznamchaAllowsUnifiedEdit(r)}
                              onView={() => openFromRoznamchaRow(r)}
                              onEdit={() => openFromRoznamchaRow(r, { autoEdit: true })}
                              onOpenSourceDocument={() =>
                                void handleOpenJournalSourceDocument(buildSyntheticAccountingEntryFromRoznamchaRow(r))
                              }
                              onUndoLastChange={handleJournalUndoLastChange}
                              onCancelPayment={(id) => handleJournalCancelPayment(id, false)}
                              onCancelOrphan={(id, paymentId) =>
                                handleJournalCancelOrphan(id, paymentId ?? r.sourcePaymentId)
                              }
                              onCancelEntry={handleJournalCancelEntry}
                              onViewTrace={() => openFromRoznamchaRow(r, { autoTrace: true })}
                              onViewAudit={() => openFromRoznamchaRow(r, { scrollAudit: true })}
                            />
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-card border-t-2 border-border">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-bold text-foreground">
                      Closing
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--erp-money-positive)]">
                      {data.summary.cashIn.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-400">
                      {data.summary.cashOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      {data.summary.closingBalance.toLocaleString()}
                    </td>
                    {showRoznamchaActions ? <td className="px-2 py-3 w-12" /> : null}
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border bg-card">
                <p className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRows)} of {totalRows}
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
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
                        <button
                          type="button"
                          className={cn(
                            'h-8 min-w-[2rem] rounded px-2 text-sm font-medium',
                            p === currentPage ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted'
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
            )}
          </div>
        </>
      ) : null}

      {!loading && (!data || orderedRows.length === 0) && (
        <div className="text-center py-16 rounded-xl border border-border bg-muted/30">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No cash transactions in this period</p>
          <p className="text-sm text-muted-foreground mt-1">Cash / Bank / Wallet receive &amp; pay only — one row per actual payment (not invoice totals).</p>
        </div>
      )}
      </div>

      {transactionReference ? (
        <TransactionDetailModal
          isOpen={!!transactionReference}
          onClose={clearTransactionDetail}
          referenceNumber={transactionReference}
          journalEntryIdHint={transactionJournalEntryIdHint ?? undefined}
          autoLaunchUnifiedEdit={transactionDetailAutoEdit}
          onAutoLaunchUnifiedEditConsumed={() => setTransactionDetailAutoEdit(false)}
          autoOpenPaymentTrace={transactionDetailAutoOpenTrace}
          onAutoOpenPaymentTraceConsumed={() => setTransactionDetailAutoOpenTrace(false)}
          autoScrollToAudit={transactionDetailScrollToAudit}
          onAutoScrollToAuditConsumed={() => setTransactionDetailScrollToAudit(false)}
        />
      ) : null}

      {pendingConfirm ? (
        <TransactionConfirmDialog
          open
          title={pendingConfirm.title}
          description={pendingConfirm.message}
          confirmLabel="Yes"
          cancelLabel="No"
          onConfirm={confirmPendingJournalAction}
          onCancel={dismissPendingConfirm}
        />
      ) : null}

      {attachmentsDialogList ? (
        <AttachmentViewer
          attachments={attachmentsDialogList}
          isOpen={!!attachmentsDialogList}
          onClose={() => setAttachmentsDialogList(null)}
        />
      ) : null}
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
        !variant && 'border-border bg-muted/40'
      )}
    >
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{title}</p>
      <p
        className={cn(
          'text-xl font-bold mt-1 font-mono',
          variant === 'in' && 'text-[var(--erp-money-positive)]',
          variant === 'out' && 'text-red-400',
          !variant && 'text-foreground'
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}
