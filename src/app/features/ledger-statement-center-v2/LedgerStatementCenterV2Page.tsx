'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import {
  applyLedgerV2DisplayFilters,
  deriveLedgerV2Opening,
  getLedgerAttachmentsV2,
  getLedgerStatementV2,
  listLedgerEntitiesV2,
  summarizeLedgerV2Rows,
} from '@/app/services/ledgerStatementCenterV2Service';
import { prefetchLedgerRowTransaction } from '@/app/services/ledgerStatementCenterV2TransactionOpen';
import { shareLedgerRowViaWhatsApp } from '@/app/services/ledgerStatementCenterV2WhatsApp';
import { compareGlWithDocumentsV2 } from '@/app/services/ledgerStatementCenterV2Diagnostic';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';
import { canAccessLedgerV2UnifiedPreview } from '@/app/lib/ledgerV2UnifiedPreviewAccess';
import { shortenLedgerPaymentLabel } from '@/app/lib/ledgerStatementV2Enrichment';
import { useUnifiedLedgerEngineState } from '@/app/hooks/useUnifiedLedgerEngineState';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_CONTACT_NAME,
} from '@/app/lib/unifiedLedgerGoldenFixtures';
import {
  compareLedgerV2UnifiedPreview,
  defaultUnifiedBasisForV2Type,
  type LedgerV2UnifiedPreviewDiff,
} from '@/app/lib/ledgerStatementV2UnifiedPreviewDiff';
import {
  buildLedgerV2PreviewCompareRows,
  resolveLedgerV2PreviewCompareSource,
  type LedgerV2PreviewCompareSource,
} from '@/app/lib/resolveLedgerV2PreviewCompareSource';
import {
  loadLedgerV2UnifiedPreview,
  type LedgerV2UnifiedPreviewResult,
} from '@/app/services/ledgerStatementCenterV2UnifiedPreviewService';
import { loadLedgerV2LegacyShadowPreview } from '@/app/services/ledgerStatementCenterV2LegacyShadowPreviewService';
import { TransactionDetailModal } from '@/app/components/accounting/TransactionDetailModal';
import { AddEntryV2Host } from '@/app/components/accounting/AddEntryV2Host';
import { ReportActions } from '@/app/components/reports/ReportActions';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { LedgerStatementReportPreview } from '@/app/components/reports/shared/LedgerStatementReportPreview';
import { buildTabularPrintSnapshot } from '@/app/components/reports/shared/buildTabularPrintSnapshot';
import { LEDGER_EXPORT_COLUMNS } from '@/app/components/reports/shared/ledgerExportColumns';
import { buildLedgerStatementShareMessage } from '@/app/components/reports/shared/buildLedgerStatementShareMessage';
import type { PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';
import { useReportExport } from '@/app/components/reports/shared/useReportExport';
import { PdfPreviewModal } from '@/app/components/shared/PdfPreviewModal';
import { exportToCSV, exportToExcel, type ExportData } from '@/app/utils/exportUtils';
import { Button } from '@/app/components/ui/button';
import { LedgerFilterBar } from './LedgerFilterBar';
import { LedgerSummaryCards } from './LedgerSummaryCards';
import { LedgerTable } from './LedgerTable';
import { PartyLedgerDiscountModal } from './PartyLedgerDiscountModal';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import { LedgerDocumentComparisonPanel } from './LedgerDocumentComparisonPanel';
import { LedgerV2UnifiedPreviewPanel } from './LedgerV2UnifiedPreviewPanel';
import { LedgerRowLoadingOverlay } from './LedgerRowLoadingOverlay';
import type {
  LedgerDocumentComparisonResult,
  LedgerEntityOption,
  LedgerStatementV2Initial,
  LedgerStatementV2Result,
  LedgerStatementV2Row,
  LedgerStatementV2Type,
  LedgerTransactionTypeFilter,
} from './types';

const LEDGER_PDF_TITLES: Record<LedgerStatementV2Type, string> = {
  customer: 'Customer Ledger',
  supplier: 'Supplier Ledger',
  worker: 'Worker Ledger',
  account: 'Account Ledger',
};

const ROW_LOAD_ERROR = 'Unable to load transaction details. Please try again.';

function formatLedgerPeriodLabel(from: string, to: string, formatDate: (d: string) => string): string {
  return `${formatDate(from)} → ${formatDate(to)}`;
}

export function LedgerStatementCenterV2Page({
  embedded = false,
  initialLedgerEntity = null,
  onInitialLedgerConsumed,
  moduleContext = 'reports',
  /** When embedded in Accounting → Account Statements, use the tab period (same as Advanced). */
  periodStart,
  periodEnd,
  periodLabel,
}: {
  embedded?: boolean;
  initialLedgerEntity?: LedgerStatementV2Initial | null;
  onInitialLedgerConsumed?: () => void;
  /** Global filter module label when embedded in Accounting vs Reports. */
  moduleContext?: 'accounting' | 'reports';
  periodStart?: string;
  periodEnd?: string;
  /** Human-readable period when tab dates override the global header filter. */
  periodLabel?: string;
}) {
  const { companyId, userRole, branchId, user } = useSupabase();
  const globalFilter = useGlobalFilter();
  const {
    startDate: globalFromDate,
    endDate: globalToDate,
    getDateRangeLabel,
    setCurrentModule,
  } = globalFilter;
  const fromDate = periodStart?.trim() || globalFromDate;
  const toDate = periodEnd?.trim() || globalToDate;
  const usesLocalPeriod = Boolean(periodStart?.trim() && periodEnd?.trim());
  const showDiagnosticTools = canAccessDeveloperIntegrityLab(userRole);
  const showUnifiedPreviewTools = canAccessLedgerV2UnifiedPreview(userRole);
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const reportExport = useReportExport({ companyId, documentType: 'ledger', reportKind: 'ledger' });

  const [statementType, setStatementType] = useState<LedgerStatementV2Type>('customer');
  const [entities, setEntities] = useState<LedgerEntityOption[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [transactionType, setTransactionType] = useState<LedgerTransactionTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LedgerStatementV2Result | null>(null);
  const [pdfOrientation, setPdfOrientation] = useState<PdfPreviewOrientation>('portrait');

  const [rowActionBusy, setRowActionBusy] = useState(false);

  const rowActionLockRef = useRef(false);
  const pendingInitialEntityRef = useRef<typeof initialLedgerEntity>(null);

  useEffect(() => {
    if (initialLedgerEntity?.entityId) {
      pendingInitialEntityRef.current = initialLedgerEntity;
      setStatementType(initialLedgerEntity.statementType);
    }
  }, [initialLedgerEntity]);

  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  const [journalEntryIdHint, setJournalEntryIdHint] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{ url: string; name: string }[]>([]);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [showDocComparison, setShowDocComparison] = useState(false);
  const [docComparison, setDocComparison] = useState<LedgerDocumentComparisonResult | null>(null);
  const [docComparisonLoading, setDocComparisonLoading] = useState(false);
  const [unifiedPreviewEnabled, setUnifiedPreviewEnabled] = useState(false);
  const [previewBasis, setPreviewBasis] = useState<UnifiedLedgerBasis>('effective_party');
  const [previewResult, setPreviewResult] = useState<LedgerV2UnifiedPreviewResult | null>(null);
  const [previewDiff, setPreviewDiff] = useState<LedgerV2UnifiedPreviewDiff | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [mainLoaderSource, setMainLoaderSource] = useState<'legacy' | 'unified'>('legacy');
  const [discountModalOpen, setDiscountModalOpen] = useState(false);

  const previewCompareSource: LedgerV2PreviewCompareSource = useMemo(
    () => resolveLedgerV2PreviewCompareSource(mainLoaderSource),
    [mainLoaderSource],
  );

  const { state: engineState } = useUnifiedLedgerEngineState(companyId, {
    screenId: UNIFIED_LEDGER_SCREEN_IDS.LEDGER_V2,
    screenPreview: unifiedPreviewEnabled,
  });

  useEffect(() => {
    setPreviewBasis(defaultUnifiedBasisForV2Type(statementType));
  }, [statementType]);

  const loadPreviewCompare = useCallback(async () => {
    if (!companyId || !entityId || !result || !unifiedPreviewEnabled) {
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

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const compareSource = resolveLedgerV2PreviewCompareSource(mainLoaderSource);

      if (compareSource === 'legacy_shadow') {
        const shadow = await loadLedgerV2LegacyShadowPreview({
          companyId,
          statementType,
          entityId,
          fromDate,
          toDate,
          entityLabel: result.entityLabel || entityId,
        });
        setPreviewResult({
          rows: shadow.rows,
          closingBalance: shadow.closingBalance,
          basis: previewBasis,
          meta: {
            engine: 'legacy_gl',
            basis: previewBasis,
            featureFlagEnabled: true,
            shadowForce: true,
            queryDurationMs: 0,
            rowCount: shadow.rows.length,
            periodOpeningBalance: 0,
            message: 'Legacy shadow compare — main table uses unified loader.',
          },
        });
        const { legacyRows, previewRows } = buildLedgerV2PreviewCompareRows({
          compareSource,
          mainRows: result.rows,
          shadowRows: shadow.rows,
        });
        setPreviewDiff(
          compareLedgerV2UnifiedPreview({
            legacyRows,
            previewRows,
            statementType,
            entityId,
          }),
        );
      } else {
        const preview = await loadLedgerV2UnifiedPreview({
          companyId,
          statementType,
          entityId,
          fromDate,
          toDate,
          basis: previewBasis,
        });
        setPreviewResult(preview);
        const { legacyRows, previewRows } = buildLedgerV2PreviewCompareRows({
          compareSource,
          mainRows: result.rows,
          shadowRows: preview.rows,
        });
        setPreviewDiff(
          compareLedgerV2UnifiedPreview({
            legacyRows,
            previewRows,
            statementType,
            entityId,
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
    entityId,
    result,
    unifiedPreviewEnabled,
    engineState.killSwitchActive,
    mainLoaderSource,
    previewCompareSource,
    statementType,
    fromDate,
    toDate,
    previewBasis,
  ]);

  useEffect(() => {
    if (!unifiedPreviewEnabled) {
      setPreviewResult(null);
      setPreviewDiff(null);
      setPreviewError(null);
      return;
    }
    void loadPreviewCompare();
  }, [unifiedPreviewEnabled, loadPreviewCompare, mainLoaderSource]);

  const handleLoadMrJalilGolden = useCallback(() => {
    setStatementType('customer');
    setEntityId(MR_JALIL_CONTACT_ID);
    pendingInitialEntityRef.current = {
      entityId: MR_JALIL_CONTACT_ID,
      statementType: 'customer',
      entityLabel: MR_JALIL_CONTACT_NAME,
    };
  }, []);
  const printRef = useRef<HTMLDivElement>(null);
  const mergedPrintRef = reportExport.printRef;

  useEffect(() => {
    setCurrentModule(moduleContext);
  }, [setCurrentModule, moduleContext]);

  useEffect(() => {
    if (!companyId) return;
    void reportExport.ensureBrand();
  }, [companyId, reportExport.ensureBrand]);

  useEffect(() => {
    setPdfOrientation(reportExport.ledgerPrintOptions.orientation);
  }, [reportExport.ledgerPrintOptions.orientation]);

  const handleOpenPdfPreview = useCallback(async () => {
    await reportExport.preparePrint();
    await reportExport.openPreview();
  }, [reportExport]);

  const handlePrint = useCallback(async () => {
    await handleOpenPdfPreview();
  }, [handleOpenPdfPreview]);

  useEffect(() => {
    if (!companyId) return;
    setEntitiesLoading(true);
    const pending = pendingInitialEntityRef.current;
    if (!pending || pending.statementType !== statementType) {
      setEntityId('');
    }
    setResult(null);
    listLedgerEntitiesV2(companyId, statementType)
      .then((list) => {
        setEntities(list);
        if (pending && pending.statementType === statementType && pending.entityId) {
          const found = list.some((e) => e.id === pending.entityId);
          if (found) {
            setEntityId(pending.entityId);
          }
          pendingInitialEntityRef.current = null;
          onInitialLedgerConsumed?.();
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load parties / accounts');
        setEntities([]);
      })
      .finally(() => setEntitiesLoading(false));
  }, [companyId, statementType, onInitialLedgerConsumed]);

  const entityLabel = useMemo(
    () => entities.find((e) => e.id === entityId)?.label || result?.entityLabel || '',
    [entities, entityId, result?.entityLabel],
  );

  const loadStatement = useCallback(async () => {
    if (!companyId || !entityId) return;

    setLoading(true);
    try {
      const statementFilters = {
        statementType,
        entityId,
        fromDate,
        toDate,
        branchId: 'all' as const,
        transactionType: 'all' as const,
        search: '',
      };
      const { resolveLedgerV2MainLoaderSource, effectiveLedgerV2MainLoaderSource } = await import(
        '@/app/lib/resolveLedgerV2MainLoaderSource'
      );
      const resolved = await resolveLedgerV2MainLoaderSource(companyId);
      const mainSource = effectiveLedgerV2MainLoaderSource(resolved);
      setMainLoaderSource(mainSource);

      const data =
        mainSource === 'unified'
          ? await (
              await import('@/app/services/ledgerStatementCenterV2UnifiedMainService')
            ).getLedgerStatementV2UnifiedMain(
              companyId,
              statementFilters,
              entityLabel || entityId,
            )
          : await getLedgerStatementV2(
              companyId,
              statementFilters,
              entityLabel || entityId,
            );
      setResult(data);
      setDocComparison(null);
      if (showDocComparison && showDiagnosticTools) {
        setDocComparisonLoading(true);
        compareGlWithDocumentsV2(
          companyId,
          {
            statementType,
            entityId,
            fromDate,
            toDate,
            branchId: 'all',
            transactionType: 'all',
            search: '',
          },
          entityLabel || entityId,
          data.rows,
          data.summary,
        )
          .then(setDocComparison)
          .catch((err) => {
            console.error(err);
            toast.error('Document comparison failed');
          })
          .finally(() => setDocComparisonLoading(false));
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to load statement');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, entityId, entityLabel, statementType, fromDate, toDate, showDocComparison, showDiagnosticTools]);

  const handleEntityChange = useCallback((id: string) => {
    setEntityId(id);
    if (!id) setResult(null);
  }, []);

  useEffect(() => {
    if (!companyId || !entityId) return;
    void loadStatement();
  }, [companyId, entityId, statementType, fromDate, toDate, loadStatement]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ ledgerType?: string; entityId?: string }>).detail;
      if (!detail?.entityId || detail.entityId !== entityId) return;
      const type = detail.ledgerType;
      if (
        (statementType === 'customer' && type === 'customer') ||
        (statementType === 'supplier' && type === 'supplier')
      ) {
        void loadStatement();
      }
    };
    window.addEventListener('ledgerUpdated', handler);
    return () => window.removeEventListener('ledgerUpdated', handler);
  }, [entityId, statementType, loadStatement]);

  const beginRowAction = useCallback((rowId: string): boolean => {
    if (rowActionLockRef.current) return false;
    rowActionLockRef.current = true;
    setRowActionBusy(true);
    return true;
  }, []);

  const endRowAction = useCallback(() => {
    rowActionLockRef.current = false;
    setRowActionBusy(false);
  }, []);

  const handleOpenRowDetail = useCallback(
    async (row: LedgerStatementV2Row) => {
      if (!companyId) return;
      if (!beginRowAction(row.id)) return;
      try {
        const pref = await prefetchLedgerRowTransaction(companyId, row);
        if (!pref.ok) {
          toast.error(ROW_LOAD_ERROR);
          return;
        }
        setTransactionReference(pref.referenceNumber);
        setJournalEntryIdHint(pref.journalEntryIdHint ?? null);
      } catch (err) {
        console.error(err);
        toast.error(ROW_LOAD_ERROR);
      } finally {
        endRowAction();
      }
    },
    [companyId, beginRowAction, endRowAction],
  );

  const handlePreviewAttachments = useCallback(
    async (row: LedgerStatementV2Row) => {
      if (!beginRowAction(row.id)) return;
      try {
        const att = await getLedgerAttachmentsV2(row);
        if (!att.length) {
          toast.info('No attachments on this row');
          return;
        }
        setAttachmentPreview(att);
        setAttachmentOpen(true);
      } catch {
        toast.error('Could not load attachments');
      } finally {
        endRowAction();
      }
    },
    [beginRowAction, endRowAction],
  );

  const handleWhatsAppRow = useCallback(
    async (row: LedgerStatementV2Row) => {
      if (!beginRowAction(row.id)) return;
      try {
        const brand = reportExport.brand ?? (await reportExport.ensureBrand());
        await shareLedgerRowViaWhatsApp(row, {
          businessName: brand?.name || 'Company',
          partyLabel: entityLabel || entityId,
          formatCurrency,
          formatDate,
        });
      } catch (err) {
        console.error(err);
        toast.error('Could not share on WhatsApp');
      } finally {
        endRowAction();
      }
    },
    [beginRowAction, endRowAction, reportExport, entityLabel, entityId, formatCurrency, formatDate],
  );

  const allRows = result?.rows ?? [];
  const openingAll = useMemo(() => deriveLedgerV2Opening(allRows), [allRows]);
  const rows = useMemo(
    () => applyLedgerV2DisplayFilters(allRows, transactionType, search),
    [allRows, transactionType, search],
  );
  const summary = useMemo(
    () => (allRows.length ? summarizeLedgerV2Rows(rows, openingAll, statementType) : null),
    [rows, openingAll, statementType, allRows.length],
  );

  const dateRangeLabel = periodLabel?.trim() || getDateRangeLabel();
  const periodDisplayLabel = formatLedgerPeriodLabel(fromDate, toDate, formatDate);
  const reportPdfTitle = LEDGER_PDF_TITLES[statementType];
  const generatedAt = new Date().toLocaleString('en-GB');
  const ledgerPrint = reportExport.ledgerPrintOptions;
  const printOpening = summary?.openingBalance ?? openingAll;

  const cellValue = useCallback(
    (row: LedgerStatementV2Row, key: string): string | number => {
      switch (key) {
        case 'date':
          return row.date ? formatDate(row.date) : '';
        case 'reference':
          return row.referenceNo;
        case 'type':
          return row.transactionType;
        case 'description':
          return row.description;
        case 'branch':
          return row.branch;
        case 'debit':
          return row.debit || '';
        case 'credit':
          return row.credit || '';
        case 'balance':
          return row.runningBalance;
        case 'payment':
          return shortenLedgerPaymentLabel(row.paymentMethod);
        case 'createdBy':
          return row.createdBy;
        default:
          return '';
      }
    },
    [formatDate],
  );

  const buildExportData = useCallback((): ExportData => {
    const snap = buildTabularPrintSnapshot({
      allColumns: LEDGER_EXPORT_COLUMNS,
      visibleColumns: {},
      rows,
      cellValue,
    });
    const summaryLines: (string | number)[][] = summary
      ? [
          ['Opening balance', summary.openingBalance],
          ['Closing balance', summary.closingBalance],
          ['Total debit', summary.totalDebit],
          ['Total credit', summary.totalCredit],
          [],
        ]
      : [];
    return {
      title: `${reportPdfTitle} — ${entityLabel}`,
      headers: snap.columns.map((c) => c.label),
      rows: [...summaryLines, ...snap.rows],
    };
  }, [rows, cellValue, summary, reportPdfTitle, entityLabel]);

  const pdfPreviewNode = useMemo(() => {
    if (!reportExport.brand || !summary) return null;
    return (
      <LedgerStatementReportPreview
        brand={reportExport.brand}
        title={reportPdfTitle}
        partyName={entityLabel}
        periodLabel={periodDisplayLabel}
        branchScopeLabel="All branches (GL scope)"
        generatedAt={generatedAt}
        openingBalance={printOpening}
        closingBalance={summary.closingBalance}
        totalDebit={summary.totalDebit}
        totalCredit={summary.totalCredit}
        rows={rows.map((r) => ({
          date: r.date,
          referenceNo: r.referenceNo,
          transactionType: r.transactionType,
          description: r.description,
          branch: r.branch,
          debit: r.debit,
          credit: r.credit,
          runningBalance: r.runningBalance,
          paymentMethod: shortenLedgerPaymentLabel(r.paymentMethod),
          createdBy: r.createdBy,
        }))}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        fieldVisibility={ledgerPrint.fieldVisibility}
        showHeader={ledgerPrint.showHeader}
        showFooter={ledgerPrint.showFooter}
        orientation={pdfOrientation}
        fontSize={ledgerPrint.fontSize}
        fontFamily={ledgerPrint.fontFamily}
        margins={ledgerPrint.margins}
      />
    );
  }, [
    reportExport.brand,
    ledgerPrint,
    summary,
    reportPdfTitle,
    entityLabel,
    periodDisplayLabel,
    generatedAt,
    printOpening,
    rows,
    formatCurrency,
    formatDate,
    pdfOrientation,
  ]);

  const handleBack = () => {
    window.history.back();
  };

  const runDocComparison = useCallback(async () => {
    if (!companyId || !entityId || !result) return;
    setDocComparisonLoading(true);
    try {
      const cmp = await compareGlWithDocumentsV2(
        companyId,
        {
          statementType,
          entityId,
          fromDate,
          toDate,
          branchId: 'all',
          transactionType: 'all',
          search: '',
        },
        entityLabel || entityId,
        result.rows,
        result.summary,
      );
      setDocComparison(cmp);
    } catch (err) {
      console.error(err);
      toast.error('Document comparison failed');
    } finally {
      setDocComparisonLoading(false);
    }
  }, [companyId, entityId, result, statementType, fromDate, toDate, entityLabel]);

  useEffect(() => {
    if (!showDocComparison) setDocComparison(null);
  }, [showDocComparison]);

  return (
    <div
      data-ledger-v2-main-loader={mainLoaderSource}
      className={
        embedded
          ? 'text-white space-y-5'
          : 'min-h-full bg-[#0A0E14] text-white p-4 md:p-6 space-y-5'
      }
    >
      <LedgerRowLoadingOverlay open={rowActionBusy} />

      {!(embedded && moduleContext === 'accounting') && (
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {!embedded && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="text-gray-400 hover:text-white mt-0.5">
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <h1 className={`font-bold flex items-center gap-2 ${embedded ? 'text-lg' : 'text-xl'}`}>
              <BookOpen className="text-blue-500" size={embedded ? 20 : 22} />
              Ledger & Statement Center
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Posted GL statements — print, PDF, and share.
            </p>
          </div>
        </div>
      </div>
      )}

      <ReportBasisBanner
        basis="official_gl"
        detail={
          moduleContext === 'accounting'
            ? 'Official posted GL — customer, supplier, worker, and account statements.'
            : 'Posted GL statements — official journal basis.'
        }
      />

      {showDiagnosticTools ? (
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={showDocComparison}
            onChange={(e) => {
              const on = e.target.checked;
              setShowDocComparison(on);
              if (!on) {
                setDocComparison(null);
                return;
              }
              if (result && companyId && entityId) {
                void runDocComparison();
              }
            }}
            className="rounded border-gray-600"
          />
          Show document comparison (diagnostic)
        </label>
      ) : null}

      {showUnifiedPreviewTools ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer w-fit">
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
            onClick={handleLoadMrJalilGolden}
          >
            Load MR JALIL
          </Button>
        </div>
      ) : null}

      <LedgerFilterBar
        statementType={statementType}
        onStatementTypeChange={setStatementType}
        entities={entities}
        entityId={entityId}
        onEntityChange={handleEntityChange}
        entitiesLoading={entitiesLoading}
        dateRangeLabel={dateRangeLabel}
        periodSource={usesLocalPeriod ? 'tab' : 'header'}
        transactionType={transactionType}
        onTransactionTypeChange={setTransactionType}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
        showPartyDiscount={statementType === 'customer' || statementType === 'supplier'}
        partyDiscountDisabled={!entityId || loading}
        onApplyPartyDiscount={() => setDiscountModalOpen(true)}
      />

      {companyId && entityId && (statementType === 'customer' || statementType === 'supplier') ? (
        <PartyLedgerDiscountModal
          open={discountModalOpen}
          onClose={() => setDiscountModalOpen(false)}
          onSuccess={() => {
            toast.success(
              statementType === 'customer' ? 'Customer discount posted' : 'Supplier discount posted'
            );
            void loadStatement();
          }}
          companyId={companyId}
          branchId={branchId}
          createdBy={user?.id ?? null}
          partyType={statementType}
          contactId={entityId}
          partyName={entityLabel || entityId}
        />
      ) : null}

      {result && (
        <>
          <ReportActions
            title={`${reportPdfTitle} — ${entityLabel}`}
            onPrint={() => void handlePrint()}
            onOpenPdfPreview={() => void handleOpenPdfPreview()}
            onExcel={() => exportToExcel(buildExportData(), 'Ledger_Statement_V2')}
            onCsv={() => exportToCSV(buildExportData(), 'Ledger_Statement_V2')}
            onWhatsapp={() => {
              if (!summary || !reportExport.brand) return;
              const message = buildLedgerStatementShareMessage({
                businessName: reportExport.brand.name,
                reportTitle: reportPdfTitle,
                partyLabel: entityLabel,
                periodLabel: periodDisplayLabel,
                branchScopeLabel: 'All branches (GL scope)',
                openingBalance: summary.openingBalance,
                totalDebit: summary.totalDebit,
                totalCredit: summary.totalCredit,
                closingBalance: summary.closingBalance,
                formatCurrency,
                generatedAt,
              });
              reportExport.shareViaWhatsApp({
                title: reportPdfTitle,
                reference: entityLabel,
                period: periodDisplayLabel,
                message,
              });
            }}
            pdfLoading={reportExport.loadingBrand}
          />

          <LedgerSummaryCards statementType={statementType} summary={summary} />

          {showDocComparison && showDiagnosticTools ? (
            <LedgerDocumentComparisonPanel comparison={docComparison} loading={docComparisonLoading} />
          ) : null}

          {unifiedPreviewEnabled && showUnifiedPreviewTools ? (
            <LedgerV2UnifiedPreviewPanel
              statementType={statementType}
              entityLabel={entityLabel || entityId}
              previewResult={previewResult}
              diff={previewDiff}
              loading={previewLoading}
              error={previewError}
              engineState={engineState}
              previewBasis={previewBasis}
              onPreviewBasisChange={setPreviewBasis}
              displayFiltersActive={transactionType !== 'all' || Boolean(search.trim())}
              compareSource={previewCompareSource}
              legacyEngineLabel={
                statementType === 'customer'
                  ? 'Legacy V2 (hybrid customer loader)'
                  : 'Legacy V2 (posted GL)'
              }
            />
          ) : null}

          <div ref={printRef}>
            <LedgerTable
              rows={rows}
              loading={loading}
              rowActionsDisabled={rowActionBusy}
              onOpenRow={handleOpenRowDetail}
              onWhatsAppRow={handleWhatsAppRow}
              onPreviewAttachments={handlePreviewAttachments}
            />
          </div>

          <div ref={mergedPrintRef} className="sr-only">
            {pdfPreviewNode}
          </div>

          {reportExport.previewOpen && pdfPreviewNode ? (
            <PdfPreviewModal
              open={reportExport.previewOpen}
              onClose={reportExport.closePreview}
              title={reportPdfTitle}
              documentType="ledger"
              reference={entityLabel}
              format={reportExport.printFormat}
              orientation={pdfOrientation}
              showOrientationToggle
              onOrientationChange={setPdfOrientation}
              fitSinglePage={rows.length <= 40}
              pageNumbers={ledgerPrint.showFooter}
            >
              {pdfPreviewNode}
            </PdfPreviewModal>
          ) : null}
        </>
      )}

      {transactionReference && (
        <TransactionDetailModal
          isOpen={!!transactionReference}
          onClose={() => {
            setTransactionReference(null);
            setJournalEntryIdHint(null);
          }}
          referenceNumber={transactionReference}
          journalEntryIdHint={journalEntryIdHint ?? undefined}
          autoLaunchUnifiedEdit={false}
        />
      )}

      <AddEntryV2Host />

      <AttachmentPreviewDialog
        attachments={attachmentPreview}
        isOpen={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
      />
    </div>
  );
}

export default LedgerStatementCenterV2Page;
