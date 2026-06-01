import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Upload, FileText, Download, AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { toast } from 'sonner';
import {
  CsvPreviewDataGrid,
  buildProductsBlankTemplate,
  buildProductsSampleTemplate,
  commitProductImport,
  loadProductCatalogContext,
  parseProductsCsvFile,
  productRowToPreviewRecord,
  rowErrorsMapForPreview,
  validateProductsCatalogForPreview,
  validateProductsStructuralIndexed,
  type ImportRowError,
  type ImportSummary,
  type ParsedProductRowWithIndex,
  type ProductImportProgress,
} from '@/app/modules/csv-workbench';
import type { CsvRowValidation } from '@/app/modules/csv-workbench/types';
import { serializeCsvMatrix } from '@/app/modules/csv-workbench/serializeCsv';
import { beginBulkImport, endBulkImport } from '@/app/lib/bulkImportSession';
import { dispatchDataInvalidated } from '@/app/lib/dataInvalidationBus';
import { notifyAccountingEntriesChanged } from '@/app/lib/accountingInvalidate';
import { isRealBranchUuid } from '@/app/utils/branchScope';

export type { ImportRowError, ImportSummary };

const PREVIEW_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category' },
  { key: 'variation_name', label: 'Variation' },
  { key: 'cost_price', label: 'Cost', className: 'text-right' },
  { key: 'selling_price', label: 'Price', className: 'text-right' },
  { key: 'opening_stock', label: 'Stock', className: 'text-right' },
];

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportProductsModal = ({ isOpen, onClose, onSuccess }: ImportProductsModalProps) => {
  const { companyId, branchId } = useSupabase();
  const { generateDocumentNumberSafe, incrementNextNumber } = useDocumentNumbering();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedProductRowWithIndex[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [autoGenerateSku, setAutoGenerateSku] = useState(false);
  const [autoCreateCatalog, setAutoCreateCatalog] = useState(true);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importProgress, setImportProgress] = useState<ProductImportProgress | null>(null);
  const [previewValidations, setPreviewValidations] = useState<CsvRowValidation[]>([]);
  const [validatingPreview, setValidatingPreview] = useState(false);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setParsedRows([]);
    setImportStatus('idle');
    setImportError(null);
    setImportedCount(0);
    setSummary(null);
    setImportProgress(null);
    setPreviewValidations([]);
    setValidatingPreview(false);
  }, []);

  const blockingErrorCount = useMemo(
    () => previewValidations.filter((v) => v.severity === 'error').length,
    [previewValidations]
  );

  const isImportBusy = importStatus === 'processing' || validatingPreview;

  const previewRowErrors = useMemo(
    () => rowErrorsMapForPreview(parsedRows, previewValidations),
    [parsedRows, previewValidations]
  );

  const previewRecords = useMemo(() => parsedRows.map(productRowToPreviewRecord), [parsedRows]);

  useEffect(() => {
    if (!companyId || parsedRows.length === 0) {
      setPreviewValidations([]);
      return;
    }
    let cancelled = false;
    setValidatingPreview(true);
    (async () => {
      const structural = validateProductsStructuralIndexed(parsedRows, autoGenerateSku);
      const catalog = await validateProductsCatalogForPreview(companyId, parsedRows, autoCreateCatalog);
      if (!cancelled) {
        setPreviewValidations([...structural, ...catalog]);
        setValidatingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, parsedRows, autoGenerateSku, autoCreateCatalog]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const result = parseProductsCsvFile(text);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? 'Could not parse CSV');
        return;
      }
      if (result.data.rows.length === 0) {
        toast.error('No valid rows found. CSV must have a header row and at least one row with "name".');
        return;
      }
      setSelectedFile(file);
      setParsedRows(result.data.rows);
      setSummary(null);
      setImportStatus('idle');
      setImportError(null);
    };
    reader.readAsText(file);
  }, []);

  const downloadTemplate = (blank: boolean) => {
    const content = blank ? buildProductsBlankTemplate() : buildProductsSampleTemplate();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = blank ? 'products_import_template.csv' : 'products_import_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(blank ? 'Blank template downloaded' : 'Sample template downloaded');
  };

  const handleImport = async () => {
    if (!selectedFile || !companyId || parsedRows.length === 0) return;
    if (blockingErrorCount > 0) {
      toast.error('Fix blocking errors in the preview before importing');
      return;
    }

    setImportStatus('processing');
    setImportError(null);
    setSummary(null);
    setImportProgress({ phase: 'groups', completed: 0, total: 0 });

    beginBulkImport();
    let shouldRefreshAfterImport = false;
    try {
      const catalog = await loadProductCatalogContext(companyId);
      const branchIdOrNull = isRealBranchUuid(branchId) ? branchId.trim() : null;
      const result = await commitProductImport(parsedRows, {
        companyId,
        branchIdOrNull,
        catalog,
        autoGenerateSku,
        autoCreateCatalog,
        generateDocumentNumberSafe,
        incrementNextNumber,
        onProgress: setImportProgress,
        deferOpeningBalanceGlSync: true,
      });
      setImportProgress(null);

      setImportedCount(result.created + result.updated);
      setSummary(result);
      const ok = (result.created + result.updated) > 0 && result.failed === 0 && result.skipped === 0;
      setImportStatus(ok ? 'success' : 'error');
      shouldRefreshAfterImport = result.created > 0 || result.updated > 0;
      if (shouldRefreshAfterImport) {
        const parts = [];
        if (result.created > 0) parts.push(`${result.created} created`);
        if (result.updated > 0) parts.push(`${result.updated} updated`);
        const glNote =
          (result.openingMovementsSynced ?? 0) > 0
            ? `; opening stock GL synced (${result.openingMovementsSynced})`
            : '';
        toast.success(
          `Imported: ${parts.join(', ')}` +
            glNote +
            (result.failed + result.skipped > 0 ? `; ${result.skipped} skipped, ${result.failed} failed` : '')
        );
        onSuccess?.();
      }
      if (result.failed > 0 || result.skipped > 0) {
        setImportError(
          `${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed. See summary.`
        );
      }
    } catch (err: unknown) {
      setImportProgress(null);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setImportError(msg);
      setImportStatus('error');
      setSummary({
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 1,
        errors: [{ groupKey: '', productName: '', rowIndex: 0, message: msg, type: 'failed' }],
      });
      toast.error('Import failed: ' + msg);
    } finally {
      endBulkImport();
      if (shouldRefreshAfterImport && companyId) {
        notifyAccountingEntriesChanged({
          companyId,
          branchId: isRealBranchUuid(branchId) ? branchId.trim() : null,
          reason: 'product-csv-import-complete',
        });
        dispatchDataInvalidated({
          domain: 'inventory',
          companyId,
          branchId: isRealBranchUuid(branchId) ? branchId.trim() : null,
          reason: 'product-csv-import-complete',
        });
      }
    }
  };

  const downloadErrorReport = useCallback(() => {
    if (!summary?.errors.length) return;
    const headers = ['Row', 'Product', 'SKU/Group', 'Type', 'Error'];
    const rows = summary.errors.map((e) => [
      String(e.rowIndex),
      e.productName,
      e.groupKey,
      e.type,
      e.message,
    ]);
    const csv = serializeCsvMatrix([headers, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Error report downloaded');
  }, [summary]);

  const handleClose = () => {
    if (importStatus === 'processing') return;
    onClose();
    resetState();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={() => { if (!isImportBusy) handleClose(); }}
        role="presentation"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl pointer-events-auto max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Upload size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Products</h2>
                <p className="text-xs text-gray-400">
                  CSV workbench — validate in preview, then import.
                  {isRealBranchUuid(branchId)
                    ? ' Opening stock is saved for the branch selected in the header.'
                    : ' Select a branch in the header to assign opening stock to that location (otherwise company-wide).'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isImportBusy}
              className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative p-6 space-y-5 overflow-y-auto flex-1">
            {isImportBusy && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-gray-950/70 rounded-b-2xl px-6 text-center max-w-md mx-auto"
                aria-busy="true"
                aria-live="polite"
              >
                <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
                <p className="text-lg md:text-xl font-semibold text-blue-300">
                  {importStatus === 'processing'
                    ? importProgress?.phase === 'gl'
                      ? 'Syncing opening stock to accounts…'
                      : 'Importing products…'
                    : 'Validating rows…'}
                </p>
                {importStatus === 'processing' && importProgress && importProgress.total > 0 ? (
                  <p className="text-base md:text-lg text-gray-300">
                    {importProgress.phase === 'groups'
                      ? `${importProgress.completed} / ${importProgress.total} product groups`
                      : `${importProgress.completed} / ${importProgress.total} opening stock entries`}
                  </p>
                ) : null}
                <p className="text-sm text-gray-400">Please wait — do not close this window</p>
              </div>
            )}
            <div className={cn('space-y-5', isImportBusy && 'pointer-events-none select-none opacity-60')}>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
              <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                <li><strong>name</strong> and <strong>selling_price</strong> required on every row.</li>
                <li>Matrix import: rows with the same <strong>name</strong> form one product; parent row has empty <strong>variation_name</strong>.</li>
                <li>
                  <strong>sku</strong> optional — blank cells use category + design code; numbers after <strong>/</strong> in the name
                  (e.g. <span className="font-mono">BRIDAL - 400 … /952</span> → SKU <span className="font-mono">BRD-952</span>).
                </li>
                <li>Enable auto-create catalog if sample categories, units, or brands are not in your system yet.</li>
                <li>
                  Downloaded templates include a <strong>branch note</strong> in row 2 (<strong>description</strong> column).
                  <strong>opening_stock</strong> is saved to the branch selected in the ERP header — not from the CSV.
                </li>
              </ul>
            </div>

            <label className={cn('flex items-center gap-2 text-sm text-gray-300', !isImportBusy && 'cursor-pointer')}>
              <input type="checkbox" checked={autoGenerateSku} onChange={(e) => setAutoGenerateSku(e.target.checked)} disabled={isImportBusy} className="rounded border-gray-600 bg-gray-800 text-blue-500 disabled:opacity-50" />
              Use ERP numbering for blank parent SKU (Settings → Numbering → Production)
            </label>

            <label className={cn('flex items-center gap-2 text-sm text-gray-300', !isImportBusy && 'cursor-pointer')}>
              <input type="checkbox" checked={autoCreateCatalog} onChange={(e) => setAutoCreateCatalog(e.target.checked)} disabled={isImportBusy} className="rounded border-gray-600 bg-gray-800 text-blue-500 disabled:opacity-50" />
              Create missing categories, units, and brands during import
            </label>

            <div>
              <p className="text-sm font-semibold text-white mb-2">Step 1: Download template</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" disabled={isImportBusy} className="flex-1 h-11 bg-gray-800 border-gray-700 text-white gap-2" onClick={() => downloadTemplate(true)}>
                  <Download size={16} /> Blank template
                </Button>
                <Button type="button" variant="outline" disabled={isImportBusy} className="flex-1 h-11 bg-gray-800 border-gray-700 text-white gap-2" onClick={() => downloadTemplate(false)}>
                  <Download size={16} /> Sample with examples
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-2">Step 2: Upload file</p>
              <div
                onDragOver={(e) => { if (isImportBusy) return; e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  if (isImportBusy) return;
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 transition-all',
                  isDragging ? 'border-blue-500 bg-blue-500/10' : selectedFile ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-gray-800/30'
                )}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <FileText size={32} className="text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                    <p className="text-xs text-green-400 mt-1">{parsedRows.length} row(s) parsed</p>
                    <button type="button" disabled={isImportBusy} onClick={() => { setSelectedFile(null); setParsedRows([]); }} className="text-xs text-red-400 mt-2 hover:text-red-300 disabled:opacity-50">Remove file</button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={32} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-white mb-2">Drag and drop CSV here</p>
                    <label className={cn('inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg', isImportBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
                      Browse
                      <input type="file" accept=".csv" disabled={isImportBusy} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} className="hidden" />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {parsedRows.length > 0 && (
              <CsvPreviewDataGrid
                columns={PREVIEW_COLUMNS}
                rows={previewRecords}
                rowErrors={previewRowErrors}
                caption={validatingPreview ? 'Validating rows…' : `Preview (${parsedRows.length} row(s)) — fix [E] errors before import`}
                maxHeightClass="max-h-[min(360px,45vh)]"
              />
            )}

            {summary && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-2">
                <p className="font-semibold text-white text-sm">Summary</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="text-green-400">Created: {summary.created}</span>
                  <span className="text-blue-400">Updated: {summary.updated}</span>
                  <span className="text-amber-400">Skipped: {summary.skipped}</span>
                  <span className="text-red-400">Failed: {summary.failed}</span>
                </div>
                {summary.errors.length > 0 && (
                  <>
                    <ul className="text-xs text-gray-300 max-h-24 overflow-y-auto space-y-0.5">
                      {summary.errors.slice(0, 8).map((e, i) => (
                        <li key={i}>Row {e.rowIndex}: {e.productName} — {e.message}</li>
                      ))}
                    </ul>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={downloadErrorReport}>
                      <Download size={12} className="mr-1" /> Download error report
                    </Button>
                  </>
                )}
              </div>
            )}

            {importStatus !== 'idle' && (
              <div className={cn(
                'p-4 rounded-xl border flex items-center gap-3 text-sm',
                importStatus === 'processing' && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                importStatus === 'success' && 'bg-green-500/10 border-green-500/30 text-green-400',
                importStatus === 'error' && 'bg-red-500/10 border-red-500/30 text-red-400'
              )}>
                {importStatus === 'processing' && <span>Processing import…</span>}
                {importStatus === 'success' && summary ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>
                      Done — {summary.created} created, {summary.updated} updated
                      {summary.skipped + summary.failed > 0
                        ? ` (${summary.skipped} skipped, ${summary.failed} failed)`
                        : ''}
                    </span>
                  </>
                ) : null}
                {importStatus === 'error' && (<><AlertCircle size={18} /><span>{importError ?? 'Import finished with issues'}</span></>)}
              </div>
            )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
            <Button onClick={handleClose} disabled={isImportBusy} variant="outline" className="h-10 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white disabled:opacity-50">
              {importStatus === 'success' ? 'Close' : 'Cancel'}
            </Button>
            {importStatus !== 'success' && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || parsedRows.length === 0 || isImportBusy || blockingErrorCount > 0}
                className="h-10 bg-blue-600 hover:bg-blue-500 text-white gap-2 disabled:opacity-50"
              >
                {importStatus === 'processing' ? 'Importing…' : `Import ${parsedRows.length} Product(s)`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
