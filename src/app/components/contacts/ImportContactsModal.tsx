import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import {
  CsvPreviewDataGrid,
  buildContactsBlankTemplate,
  buildContactsSampleTemplate,
  commitContactImport,
  contactRowToPreviewRecord,
  parseContactsCsvFile,
  rowErrorsMapForContactPreview,
  validateContactsRawTypes,
  validateContactsStructuralIndexed,
  type ContactImportSummary,
  type ParsedContactRowWithIndex,
} from '@/app/modules/csv-workbench';
import type { CsvRowValidation, ParsedCsv } from '@/app/modules/csv-workbench/types';
import { serializeCsvMatrix } from '@/app/modules/csv-workbench/serializeCsv';

const PREVIEW_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'opening_balance', label: 'Opening', className: 'text-right' },
];

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportContactsModal = ({ isOpen, onClose, onSuccess }: ImportContactsModalProps) => {
  const { companyId } = useSupabase();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedContactRowWithIndex[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [summary, setSummary] = useState<ContactImportSummary | null>(null);
  const [previewValidations, setPreviewValidations] = useState<CsvRowValidation[]>([]);
  const [lastParsedCsv, setLastParsedCsv] = useState<ParsedCsv | null>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setParsedRows([]);
    setImportStatus('idle');
    setImportError(null);
    setImportedCount(0);
    setSummary(null);
    setPreviewValidations([]);
    setLastParsedCsv(null);
  }, []);

  const blockingErrorCount = useMemo(
    () => previewValidations.filter((v) => v.severity === 'error').length,
    [previewValidations]
  );

  const previewRowErrors = useMemo(
    () => rowErrorsMapForContactPreview(parsedRows, previewValidations),
    [parsedRows, previewValidations]
  );

  const previewRecords = useMemo(() => parsedRows.map(contactRowToPreviewRecord), [parsedRows]);

  useEffect(() => {
    if (parsedRows.length === 0) {
      setPreviewValidations([]);
      return;
    }
    const structural = validateContactsStructuralIndexed(parsedRows);
    const rawTypes = lastParsedCsv ? validateContactsRawTypes(lastParsedCsv) : [];
    const byKey = new Map<string, CsvRowValidation>();
    for (const v of [...structural, ...rawTypes]) {
      const k = `${v.rowIndex}:${v.field ?? 'general'}`;
      if (!byKey.has(k)) byKey.set(k, v);
    }
    setPreviewValidations(Array.from(byKey.values()));
  }, [parsedRows, lastParsedCsv]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const result = parseContactsCsvFile(text);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? 'Could not parse CSV');
        return;
      }
      if (result.data.rows.length === 0) {
        setParsedRows([]);
        setLastParsedCsv(result.data.parsed);
        toast.error('No valid rows found. CSV must have a header row and at least one row with "name".');
        return;
      }
      setSelectedFile(file);
      setParsedRows(result.data.rows);
      setLastParsedCsv(result.data.parsed);
      setSummary(null);
      setImportStatus('idle');
      setImportError(null);
    };
    reader.readAsText(file);
  }, []);

  const downloadTemplate = (blank: boolean) => {
    const content = blank ? buildContactsBlankTemplate() : buildContactsSampleTemplate();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = blank ? 'contacts_import_template.csv' : 'contacts_import_sample.csv';
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

    try {
      const result = await commitContactImport(parsedRows, companyId);
      setImportedCount(result.created);
      setSummary(result);
      setImportStatus(
        result.created > 0 && result.failed === 0 && result.skipped === 0 ? 'success' : 'error'
      );
      if (result.created > 0) {
        toast.success(
          `Imported ${result.created} contact(s)` +
            (result.failed + result.skipped > 0 ? `; ${result.skipped} skipped, ${result.failed} failed` : '')
        );
        onSuccess?.();
      }
      if (result.failed > 0 || result.skipped > 0) {
        setImportError(
          `${result.created} created, ${result.skipped} skipped, ${result.failed} failed. See summary.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setImportError(msg);
      setImportStatus('error');
      toast.error('Import failed: ' + msg);
    }
  };

  const downloadErrorReport = useCallback(() => {
    if (!summary?.errors.length) return;
    const headers = ['Row', 'Contact', 'Type', 'Error'];
    const rows = summary.errors.map((e) => [
      String(e.rowIndex),
      e.contactName,
      e.type,
      e.message,
    ]);
    const csv = serializeCsvMatrix([headers, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contact_import_errors_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Error report downloaded');
  }, [summary]);

  const handleClose = () => {
    onClose();
    resetState();
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]" onClick={handleClose} role="presentation" />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
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
                <h2 className="text-lg font-bold text-white">Import Contacts</h2>
                <p className="text-xs text-gray-400">CSV workbench — validate in preview, then import</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
              <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                <li><strong>name</strong> required; <strong>type</strong>: customer, supplier, both, or worker.</li>
                <li>Optional: email, phone, mobile, address, opening_balance, worker fields.</li>
                <li>Each row imports independently — one failure does not stop the rest.</li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-2">Step 1: Download template</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-11 bg-gray-800 border-gray-700 text-white gap-2" onClick={() => downloadTemplate(true)}>
                  <Download size={16} /> Blank template
                </Button>
                <Button type="button" variant="outline" className="flex-1 h-11 bg-gray-800 border-gray-700 text-white gap-2" onClick={() => downloadTemplate(false)}>
                  <Download size={16} /> Sample with examples
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-2">Step 2: Upload file</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
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
                    <button type="button" onClick={() => { setSelectedFile(null); setParsedRows([]); setLastParsedCsv(null); }} className="text-xs text-red-400 mt-2 hover:text-red-300">Remove file</button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={32} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-white mb-2">Drag and drop CSV here</p>
                    <label className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg cursor-pointer">
                      Browse
                      <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} className="hidden" />
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
                caption={`Preview (${parsedRows.length} row(s)) — fix [E] errors before import`}
                maxHeightClass="max-h-[min(360px,45vh)]"
              />
            )}

            {summary && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-2">
                <p className="font-semibold text-white text-sm">Summary</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-400">Created: {summary.created}</span>
                  <span className="text-amber-400">Skipped: {summary.skipped}</span>
                  <span className="text-red-400">Failed: {summary.failed}</span>
                </div>
                {summary.errors.length > 0 && (
                  <>
                    <ul className="text-xs text-gray-300 max-h-24 overflow-y-auto space-y-0.5">
                      {summary.errors.slice(0, 8).map((e, i) => (
                        <li key={i}>Row {e.rowIndex}: {e.contactName} — {e.message}</li>
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
                {importStatus === 'success' && (<><CheckCircle2 size={18} /><span>Imported {importedCount} contact(s)</span></>)}
                {importStatus === 'error' && (<><AlertCircle size={18} /><span>{importError ?? 'Import finished with issues'}</span></>)}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
            <Button onClick={handleClose} variant="outline" className="h-10 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white">
              {importStatus === 'success' ? 'Close' : 'Cancel'}
            </Button>
            {importStatus !== 'success' && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || parsedRows.length === 0 || importStatus === 'processing' || blockingErrorCount > 0}
                className="h-10 bg-blue-600 hover:bg-blue-500 text-white gap-2 disabled:opacity-50"
              >
                {importStatus === 'processing' ? 'Importing…' : `Import ${parsedRows.length} Contact(s)`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};
