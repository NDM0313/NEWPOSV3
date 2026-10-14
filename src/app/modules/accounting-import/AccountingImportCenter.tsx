/**
 * Universal Accounting Import Center — Phase 1: Fund Transfer CSV.
 * Workflow: select profile → upload → COA map/preview → dry run → commit.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  ArrowLeftRight,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import { CsvPreviewDataGrid } from '@/app/modules/csv-workbench';
import { serializeCsvMatrix } from '@/app/modules/csv-workbench/serializeCsv';
import type { CsvRowValidation } from '@/app/modules/csv-workbench/types';
import type { AccountingImportProfileId, AccountingImportStep } from './types';
import {
  buildFundTransfersBlankTemplate,
  buildFundTransfersSampleTemplate,
  commitFundTransferImport,
  dryRunFundTransferImport,
  fundTransferRowToPreviewRecord,
  parseFundTransfersCsvFile,
  rowErrorsMapForFundTransferPreview,
  validateFundTransfersStructural,
  type FundTransferImportSummary,
  type ParsedFundTransferRowWithIndex,
  type ResolvedFundTransferRow,
} from './profiles/fundTransfersProfile';

const PREVIEW_COLUMNS = [
  { key: 'entry_date', label: 'Date' },
  { key: 'amount', label: 'Amount', className: 'text-right' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'description', label: 'Description' },
  { key: 'external_ref', label: 'Ext ref' },
];

const PROFILES: {
  id: AccountingImportProfileId;
  title: string;
  blurb: string;
  implemented: boolean;
}[] = [
  {
    id: 'fund_transfers',
    title: 'Fund Transfers',
    blurb: 'Account-to-account (any active leaf COA codes). Posts JE- with type Fund Transfer.',
    implemented: true,
  },
];

interface AccountingImportCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Skip profile picker when opened for a specific template */
  initialProfile?: AccountingImportProfileId;
}

export function AccountingImportCenter({
  isOpen,
  onClose,
  onSuccess,
  initialProfile = 'fund_transfers',
}: AccountingImportCenterProps) {
  const { companyId, branchId, user } = useSupabase();
  const [step, setStep] = useState<AccountingImportStep>('select_profile');
  const [profileId, setProfileId] = useState<AccountingImportProfileId | null>(initialProfile);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedFundTransferRowWithIndex[]>([]);
  const [resolvedRows, setResolvedRows] = useState<ResolvedFundTransferRow[]>([]);
  const [previewValidations, setPreviewValidations] = useState<CsvRowValidation[]>([]);
  const [dryRunDone, setDryRunDone] = useState(false);
  const [busy, setBusy] = useState<'idle' | 'mapping' | 'dry_run' | 'committing'>('idle');
  const [summary, setSummary] = useState<FundTransferImportSummary | null>(null);
  const [importProgress, setImportProgress] = useState<{ completed: number; total: number } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const isBusy = busy !== 'idle';

  const resetState = useCallback(() => {
    setStep(initialProfile ? 'upload' : 'select_profile');
    setProfileId(initialProfile ?? null);
    setIsDragging(false);
    setSelectedFile(null);
    setParsedRows([]);
    setResolvedRows([]);
    setPreviewValidations([]);
    setDryRunDone(false);
    setBusy('idle');
    setSummary(null);
    setImportProgress(null);
    setCommitError(null);
  }, [initialProfile]);

  useEffect(() => {
    if (isOpen) {
      setStep(initialProfile ? 'upload' : 'select_profile');
      setProfileId(initialProfile ?? null);
    } else {
      resetState();
    }
  }, [isOpen, initialProfile, resetState]);

  const blockingErrorCount = useMemo(
    () => previewValidations.filter((v) => v.severity === 'error').length,
    [previewValidations]
  );

  const previewSourceRows = resolvedRows.length > 0 ? resolvedRows : parsedRows;

  const previewRowErrors = useMemo(
    () => rowErrorsMapForFundTransferPreview(parsedRows, previewValidations),
    [parsedRows, previewValidations]
  );

  const previewRecords = useMemo(
    () => previewSourceRows.map(fundTransferRowToPreviewRecord),
    [previewSourceRows]
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      if (!companyId) {
        toast.error('No company selected');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const text = String(reader.result ?? '');
        const result = parseFundTransfersCsvFile(text);
        if (!result.ok || !result.data) {
          toast.error(result.error ?? 'Could not parse CSV');
          return;
        }
        if (result.data.rows.length === 0) {
          setParsedRows([]);
          setResolvedRows([]);
          setPreviewValidations([]);
          toast.error('No data rows found. Need header + at least one transfer row.');
          return;
        }
        setSelectedFile(file);
        setParsedRows(result.data.rows);
        setSummary(null);
        setDryRunDone(false);
        setCommitError(null);
        setBusy('mapping');
        try {
          const dry = await dryRunFundTransferImport(result.data.rows, companyId);
          setResolvedRows(dry.resolved);
          setPreviewValidations(dry.validations);
          setStep('preview');
          if (dry.errorCount > 0) {
            toast.warning(
              `${dry.errorCount} blocking error(s)` +
                (dry.warningCount ? `, ${dry.warningCount} warning(s)` : '') +
                ` — ${dry.readyCount} row(s) ready`
            );
          } else if (dry.warningCount > 0) {
            toast.success(`${dry.readyCount} transfer(s) mapped (${dry.warningCount} warning(s) — review before commit)`);
          } else {
            toast.success(`${dry.readyCount} transfer(s) mapped to Chart of Accounts`);
          }
        } catch (e) {
          const structural = validateFundTransfersStructural(result.data.rows);
          setResolvedRows([]);
          setPreviewValidations(structural);
          setStep('preview');
          toast.error(e instanceof Error ? e.message : 'COA mapping failed');
        } finally {
          setBusy('idle');
        }
      };
      reader.readAsText(file);
    },
    [companyId]
  );

  const downloadTemplate = (blank: boolean) => {
    const content = blank ? buildFundTransfersBlankTemplate() : buildFundTransfersSampleTemplate();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = blank ? 'fund_transfers_import_template.csv' : 'fund_transfers_import_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(blank ? 'Blank template downloaded' : 'Sample template downloaded');
  };

  const runDryRun = async () => {
    if (!companyId || parsedRows.length === 0) return;
    setBusy('dry_run');
    setCommitError(null);
    try {
      const dry = await dryRunFundTransferImport(parsedRows, companyId);
      setResolvedRows(dry.resolved);
      setPreviewValidations(dry.validations);
      setDryRunDone(true);
      setStep('dry_run');
      if (dry.errorCount > 0) {
        toast.error(
          `Dry run: ${dry.errorCount} blocking error(s), ${dry.readyCount} ready` +
            (dry.warningCount ? ` (${dry.warningCount} warning(s))` : '')
        );
      } else if (dry.warningCount > 0) {
        toast.success(
          `Dry run OK with ${dry.warningCount} warning(s) — ${dry.readyCount} transfer(s) ready (JE- Fund Transfers)`
        );
      } else {
        toast.success(`Dry run OK — ${dry.readyCount} transfer(s) ready to post as JE- Fund Transfers`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dry run failed');
    } finally {
      setBusy('idle');
    }
  };

  const handleCommit = async () => {
    if (!companyId || resolvedRows.length === 0 || blockingErrorCount > 0) {
      toast.error('Fix blocking errors before commit');
      return;
    }
    if (!dryRunDone) {
      toast.error('Run Dry Run first');
      return;
    }
    setBusy('committing');
    setCommitError(null);
    setImportProgress({ completed: 0, total: resolvedRows.length });
    try {
      const result = await commitFundTransferImport(resolvedRows, companyId, {
        branchId: branchId ?? null,
        createdBy: user?.id ?? null,
        onProgress: (completed, total) => setImportProgress({ completed, total }),
      });
      setImportProgress(null);
      setSummary(result);
      setStep('done');
      if (result.created > 0) {
        toast.success(
          `Posted ${result.created} fund transfer(s)` +
            (result.createdEntryNos[0] ? ` (${result.createdEntryNos[0]}${result.created > 1 ? '…' : ''})` : '')
        );
        onSuccess?.();
      }
      if (result.failed > 0) {
        setCommitError(`${result.created} created, ${result.failed} failed. See summary.`);
      }
    } catch (err: unknown) {
      setImportProgress(null);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setCommitError(msg);
      toast.error('Import failed: ' + msg);
    } finally {
      setBusy('idle');
    }
  };

  const downloadErrorReport = useCallback(() => {
    if (!summary?.errors.length) return;
    const headers = ['Row', 'Transfer', 'Type', 'Error'];
    const rows = summary.errors.map((e) => [String(e.rowIndex), e.label, e.type, e.message]);
    const csv = serializeCsvMatrix([headers, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fund_transfer_import_errors_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Error report downloaded');
  }, [summary]);

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]"
        onClick={() => {
          if (!isBusy) handleClose();
        }}
        role="presentation"
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl pointer-events-auto max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ArrowLeftRight size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Accounting Import</h2>
                <p className="text-xs text-muted-foreground">
                  Universal Import Center — Fund Transfer (JE- + type Transfer)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative p-6 space-y-5 overflow-y-auto flex-1">
            {isBusy && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-input-background/70 rounded-b-2xl px-6 text-center max-w-md mx-auto"
                aria-busy="true"
                aria-live="polite"
              >
                <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
                <p className="text-lg md:text-xl font-semibold text-blue-300">
                  {busy === 'mapping' && 'Mapping Chart of Accounts…'}
                  {busy === 'dry_run' && 'Running dry run…'}
                  {busy === 'committing' && 'Posting fund transfers…'}
                </p>
                {importProgress && importProgress.total > 0 ? (
                  <p className="text-base md:text-lg text-muted-foreground">
                    {importProgress.completed} / {importProgress.total}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">Please wait — do not close this window</p>
              </div>
            )}

            <div className={cn('space-y-5', isBusy && 'pointer-events-none select-none opacity-60')}>
              {step === 'select_profile' && (
                <div className="grid gap-3 sm:grid-cols-1">
                  {PROFILES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.implemented}
                      onClick={() => {
                        setProfileId(p.id);
                        setStep('upload');
                      }}
                      className={cn(
                        'text-left rounded-xl border p-4 transition-colors',
                        p.implemented
                          ? 'border-border bg-muted/40 hover:border-blue-500/50 hover:bg-blue-500/5'
                          : 'border-border/50 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <p className="font-semibold text-foreground">{p.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{p.blurb}</p>
                      {!p.implemented && (
                        <p className="text-[10px] text-amber-400 mt-2">Coming in a later phase</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {profileId === 'fund_transfers' && step !== 'select_profile' && (
                <>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
                    <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>
                        Required: <strong>entry_date</strong>, <strong>amount</strong>,{' '}
                        <strong>from_account_code</strong>, <strong>to_account_code</strong>
                      </li>
                      <li>Optional: description, external_ref (unique in file; stored as [IMP:…] in JE description)</li>
                      <li>
                        Both codes must be <strong>active leaf COA accounts</strong> (any leaf — cash/bank/wallet preferred;
                        custom codes like 1190 / 1062 allowed)
                      </li>
                      <li>
                        Negative amounts flip direction (e.g. −600 from A→B posts as B→A for 600). Use numeric codes only —
                        not labels like &quot;Opening Balance&quot;. Dates: YYYY-MM-DD or Excel M/D/YYYY
                      </li>
                      <li>
                        Each row posts one balanced journal: <strong>JE-</strong> number, entry type{' '}
                        <strong>Fund Transfer</strong> — not a separate FT- sequence
                      </li>
                      <li>Re-uploading the same file creates new JE rows unless you stop after seeing duplicates</li>
                    </ul>
                  </div>

                  {(step === 'upload' || step === 'preview' || step === 'dry_run') && (
                    <>
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-2">Step 1: Download template</p>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isBusy}
                            className="flex-1 h-11 bg-muted border-border text-foreground gap-2"
                            onClick={() => downloadTemplate(true)}
                          >
                            <Download size={16} /> Blank template
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isBusy}
                            className="flex-1 h-11 bg-muted border-border text-foreground gap-2"
                            onClick={() => downloadTemplate(false)}
                          >
                            <Download size={16} /> Sample with examples
                          </Button>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-foreground mb-2">Step 2: Upload CSV</p>
                        <div
                          onDragOver={(e) => {
                            if (isBusy) return;
                            e.preventDefault();
                            setIsDragging(true);
                          }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={(e) => {
                            if (isBusy) return;
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files[0];
                            if (file) void handleFileSelect(file);
                          }}
                          className={cn(
                            'border-2 border-dashed rounded-xl p-8 transition-all',
                            isDragging
                              ? 'border-blue-500 bg-blue-500/10'
                              : selectedFile
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-border bg-accent/30'
                          )}
                        >
                          {selectedFile ? (
                            <div className="text-center">
                              <FileText size={32} className="text-green-500 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
                              <p className="text-xs text-[var(--erp-money-positive)] mt-1">
                                {parsedRows.length} row(s) · {resolvedRows.length} mapped OK
                                {blockingErrorCount > 0 ? ` · ${blockingErrorCount} error(s)` : ''}
                              </p>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setSelectedFile(null);
                                  setParsedRows([]);
                                  setResolvedRows([]);
                                  setPreviewValidations([]);
                                  setDryRunDone(false);
                                  setStep('upload');
                                }}
                                className="text-xs text-red-400 mt-2 hover:text-red-300 disabled:opacity-50"
                              >
                                Remove file
                              </button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload size={32} className="text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-foreground mb-2">Drag and drop CSV here</p>
                              <label
                                className={cn(
                                  'inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg',
                                  isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                )}
                              >
                                Browse
                                <input
                                  type="file"
                                  accept=".csv"
                                  disabled={isBusy}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handleFileSelect(file);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {parsedRows.length > 0 && step !== 'done' && (
                    <CsvPreviewDataGrid
                      columns={PREVIEW_COLUMNS}
                      rows={previewRecords}
                      rowErrors={previewRowErrors}
                      caption={`Preview (${parsedRows.length} row(s)) — fix [E] errors before dry run / commit`}
                      maxHeightClass="max-h-[min(360px,45vh)]"
                    />
                  )}

                  {dryRunDone && step === 'dry_run' && blockingErrorCount === 0 && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex gap-3 text-sm text-[var(--erp-money-positive)]">
                      <ClipboardCheck size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Dry run passed</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {resolvedRows.length} transfer(s) will post as JE- with reference_type transfer. No
                          writes yet — click Commit to post.
                        </p>
                      </div>
                    </div>
                  )}

                  {summary && step === 'done' && (
                    <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
                      <p className="font-semibold text-foreground text-sm">Import summary</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="text-[var(--erp-money-positive)]">Created: {summary.created}</span>
                        <span className="text-amber-400">Skipped: {summary.skipped}</span>
                        <span className="text-red-400">Failed: {summary.failed}</span>
                      </div>
                      {summary.createdEntryNos.length > 0 && (
                        <p className="text-xs text-muted-foreground font-mono">
                          JE numbers: {summary.createdEntryNos.slice(0, 12).join(', ')}
                          {summary.createdEntryNos.length > 12 ? '…' : ''}
                        </p>
                      )}
                      {summary.errors.length > 0 && (
                        <>
                          <ul className="text-xs text-muted-foreground max-h-24 overflow-y-auto space-y-0.5">
                            {summary.errors.slice(0, 8).map((e, i) => (
                              <li key={i}>
                                Row {e.rowIndex}: {e.label} — {e.message}
                              </li>
                            ))}
                          </ul>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={downloadErrorReport}
                          >
                            <Download size={12} className="mr-1" /> Download error report
                          </Button>
                        </>
                      )}
                      {commitError && (
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertCircle size={16} />
                          {commitError}
                        </div>
                      )}
                      {summary.created > 0 && summary.failed === 0 && (
                        <div className="flex items-center gap-2 text-sm text-[var(--erp-money-positive)]">
                          <CheckCircle2 size={16} />
                          Posted successfully — check Journal / Roznamcha
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
            <Button
              onClick={handleClose}
              disabled={isBusy}
              variant="outline"
              className="h-10 bg-muted border-border hover:bg-muted text-foreground disabled:opacity-50"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </Button>
            {step !== 'done' && profileId === 'fund_transfers' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy || parsedRows.length === 0}
                  className="h-10 gap-2"
                  onClick={() => void runDryRun()}
                >
                  <ClipboardCheck size={16} />
                  Dry Run
                </Button>
                <Button
                  onClick={() => void handleCommit()}
                  disabled={
                    isBusy ||
                    !dryRunDone ||
                    resolvedRows.length === 0 ||
                    blockingErrorCount > 0
                  }
                  className="h-10 bg-blue-600 hover:bg-blue-500 text-white gap-2 disabled:opacity-50"
                >
                  {busy === 'committing'
                    ? 'Posting…'
                    : `Commit ${resolvedRows.length || parsedRows.length} Transfer(s)`}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
