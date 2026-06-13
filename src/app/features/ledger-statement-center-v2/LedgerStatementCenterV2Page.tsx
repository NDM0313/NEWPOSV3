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
import { TransactionDetailModal } from '@/app/components/accounting/TransactionDetailModal';
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
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import { LedgerDocumentComparisonPanel } from './LedgerDocumentComparisonPanel';
import { LedgerRowLoadingOverlay } from './LedgerRowLoadingOverlay';
import type {
  LedgerDocumentComparisonResult,
  LedgerEntityOption,
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
}: {
  embedded?: boolean;
  initialLedgerEntity?: {
    entityId: string;
    statementType: 'customer' | 'supplier';
    entityLabel?: string;
  } | null;
  onInitialLedgerConsumed?: () => void;
}) {
  const { companyId, userRole } = useSupabase();
  const globalFilter = useGlobalFilter();
  const { startDate: fromDate, endDate: toDate, getDateRangeLabel, setCurrentModule } = globalFilter;
  const showDiagnosticTools = canAccessDeveloperIntegrityLab(userRole);
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

  const printRef = useRef<HTMLDivElement>(null);
  const mergedPrintRef = reportExport.printRef;

  useEffect(() => {
    setCurrentModule('reports');
  }, [setCurrentModule]);

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
    await reportExport.preparePrint();
    window.print();
  }, [reportExport]);

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
      const data = await getLedgerStatementV2(
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

  const dateRangeLabel = getDateRangeLabel();
  const periodLabel = formatLedgerPeriodLabel(fromDate, toDate, formatDate);
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
          return row.paymentMethod;
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
        periodLabel={periodLabel}
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
          paymentMethod: r.paymentMethod,
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
    periodLabel,
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
      className={
        embedded
          ? 'text-white space-y-5'
          : 'min-h-full bg-[#0A0E14] text-white p-4 md:p-6 space-y-5'
      }
    >
      <LedgerRowLoadingOverlay open={rowActionBusy} />

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
              Ledger & Statement Center V2
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Posted GL statements — same engine as Accounting → Account Statements.
            </p>
          </div>
        </div>
      </div>

      <ReportBasisBanner
        basis="official_gl"
        detail="Posted GL statements — same engine as Accounting → Account Statements (official journal basis)."
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

      <LedgerFilterBar
        statementType={statementType}
        onStatementTypeChange={setStatementType}
        entities={entities}
        entityId={entityId}
        onEntityChange={handleEntityChange}
        entitiesLoading={entitiesLoading}
        dateRangeLabel={dateRangeLabel}
        transactionType={transactionType}
        onTransactionTypeChange={setTransactionType}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
      />

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
                periodLabel,
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
                period: periodLabel,
                message,
              });
            }}
            pdfLoading={reportExport.loadingBrand}
          />

          <LedgerSummaryCards statementType={statementType} summary={summary} />

          {showDocComparison && showDiagnosticTools ? (
            <LedgerDocumentComparisonPanel comparison={docComparison} loading={docComparisonLoading} />
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

      <AttachmentPreviewDialog
        attachments={attachmentPreview}
        isOpen={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
      />
    </div>
  );
}

export default LedgerStatementCenterV2Page;
