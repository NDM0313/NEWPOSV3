/**
 * Web Scan Receipt — capture → OCR review → destination type → seed for AddEntryV2.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Camera, Loader2, ScanText, Upload } from 'lucide-react';
import { useReceiptOcrAfterAttach } from '../../hooks/useReceiptOcrAfterAttach';
import type { ReceiptOcrDraft } from '../../lib/ocr/receiptOcrTypes';
import { isImageFile } from '../../lib/ocr/receiptOcrTypes';
import type { ReceiptOcrRouteKind } from '../../lib/ocr/receiptOcrRouteSeed';
import { ReceiptOcrReviewSheet } from '../shared/ReceiptOcrReviewSheet';
import { prepareAttachmentFilesForUpload } from '../../utils/imageCompression';
import { MAX_FILE_SIZE_BYTES } from '../../utils/uploadTransactionAttachments';
import { pasteAttachmentFilesFromEvent } from '../../utils/pasteAttachmentFiles';

/** Mirrors AddEntryV2Type — kept local to avoid circular import. */
type ScanEntryType =
  | 'customer_receipt'
  | 'supplier_payment'
  | 'worker_payment'
  | 'courier_payment'
  | 'expense_payment'
  | 'pure_journal';

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp';

const DESTINATIONS: { kind: ReceiptOcrRouteKind; entryType: ScanEntryType; label: string; hint: string }[] = [
  { kind: 'client-payment', entryType: 'customer_receipt', label: 'Customer Receipt', hint: 'Money in from customer' },
  { kind: 'supplier-payment', entryType: 'supplier_payment', label: 'Supplier Payment', hint: 'Pay vendor / AP' },
  { kind: 'worker-payment', entryType: 'worker_payment', label: 'Worker Payment', hint: 'Commission / wages' },
  { kind: 'courier-payment', entryType: 'courier_payment', label: 'Courier Payment', hint: 'Delivery payout' },
  { kind: 'expense-entry', entryType: 'expense_payment', label: 'Expense', hint: 'Operating cost' },
  { kind: 'account-transfer', entryType: 'pure_journal', label: 'Transfer / Journal', hint: 'Bank transfer or JE' },
  { kind: 'general-entry', entryType: 'pure_journal', label: 'General Entry', hint: 'Manual journal' },
];

export interface WebReceiptScanResult {
  entryType: ScanEntryType;
  draft: ReceiptOcrDraft | null;
  files: File[];
}

interface WebReceiptScanFlowProps {
  onBack: () => void;
  onComplete: (result: WebReceiptScanResult) => void;
}

export function WebReceiptScanFlow({ onBack, onComplete }: WebReceiptScanFlowProps) {
  const inputId = useId();
  const [step, setStep] = useState<'capture' | 'type'>('capture');
  const [files, setFiles] = useState<File[]>([]);
  const [confirmedDraft, setConfirmedDraft] = useState<ReceiptOcrDraft | null>(null);
  const [selected, setSelected] = useState<(typeof DESTINATIONS)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLLabelElement>(null);
  const processingLock = useRef(false);

  const ocr = useReceiptOcrAfterAttach({
    enabled: true,
    onApply: () => {
      /* Confirm handled via custom onConfirm on the sheet */
    },
  });

  const startOcrRef = useRef(ocr.startOcrForFiles);
  const rememberRef = useRef(ocr.rememberImageFromFiles);
  startOcrRef.current = ocr.startOcrForFiles;
  rememberRef.current = ocr.rememberImageFromFiles;

  const processFiles = useCallback(async (picked: File[]) => {
    if (!picked.length || processingLock.current) return;
    processingLock.current = true;
    setError(null);
    setIsProcessing(true);
    try {
      const images = picked.filter(isImageFile);
      if (!images.length) {
        setError('OCR needs a PNG or JPG screenshot.');
        return;
      }
      const { files: processed, skippedMessages } = await prepareAttachmentFilesForUpload(
        images.slice(0, 1),
        MAX_FILE_SIZE_BYTES
      );
      if (skippedMessages.length) setError(skippedMessages[0] ?? null);
      if (!processed.length) {
        if (!skippedMessages.length) setError('Could not read that image. Try another PNG/JPG.');
        return;
      }
      setFiles(processed);
      setConfirmedDraft(null);
      rememberRef.current(processed);
      void startOcrRef.current(processed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process image';
      setError(msg);
    } finally {
      processingLock.current = false;
      setIsProcessing(false);
    }
  }, []);

  // Paste must work even when drop zone is not focused (Ctrl+V anywhere while scanning).
  useEffect(() => {
    if (step !== 'capture') return;

    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, [contenteditable="true"]')) return;

      const pasted = pasteAttachmentFilesFromEvent(e, {
        maxBytes: MAX_FILE_SIZE_BYTES,
        accept: /^image\//i,
      });
      if (!pasted.length) return;
      e.preventDefault();
      e.stopPropagation();
      void processFiles(pasted);
    };

    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
  }, [step, processFiles]);

  useEffect(() => {
    if (step === 'capture') {
      // Focus label so keyboard paste also hits the zone as a fallback.
      dropRef.current?.focus();
    }
  }, [step]);

  const openFilePicker = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const el = inputRef.current;
    if (!el || isProcessing) return;
    el.value = '';
    el.click();
  };

  const onDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const list = e.dataTransfer?.files;
    if (!list?.length) return;
    void processFiles(Array.from(list));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === 'type') setStep('capture');
            else onBack();
          }}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ScanText className="w-5 h-5 text-primary" />
            Scan Receipt
          </h2>
          <p className="text-sm text-muted-foreground">
            {step === 'capture'
              ? 'Upload or paste a bank receipt screenshot'
              : 'Choose where this receipt should go'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === 'capture' && (
        <>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const list = e.target.files;
              const picked = list?.length ? Array.from(list) : [];
              // Defer clear so some browsers finish delivering FileList.
              window.setTimeout(() => {
                e.target.value = '';
              }, 0);
              if (picked.length) void processFiles(picked);
            }}
          />

          <label
            ref={dropRef}
            htmlFor={inputId}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFilePicker();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={onDropZone}
            className={`block border-2 border-dashed rounded-xl p-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            } ${isProcessing ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {isProcessing ? (
              <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin mb-3" />
            ) : (
              <Camera className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            )}
            <p className="text-sm text-foreground mb-1">Drop, paste (Ctrl+V), or choose image</p>
            <p className="text-xs text-muted-foreground mb-4">PNG / JPG — OCR fills amount, date, reference</p>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium pointer-events-none">
              <Upload className="w-4 h-4" />
              Choose screenshot
            </span>
          </label>

          {files.length > 0 && !ocr.sheetOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground truncate max-w-[220px]">{files[0].name}</span>
              <button
                type="button"
                onClick={() => void ocr.rescanLastImage()}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
              >
                Open OCR review
              </button>
              <button
                type="button"
                onClick={() => setStep('type')}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm"
              >
                Continue without OCR edits
              </button>
            </div>
          )}
        </>
      )}

      {step === 'type' && (
        <div className="space-y-2">
          {(confirmedDraft?.amount != null || confirmedDraft?.reference || confirmedDraft?.date) && (
            <div className="p-3 rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground">
              OCR:{' '}
              {confirmedDraft.amount != null ? `Rs. ${confirmedDraft.amount.toLocaleString()}` : '—'}
              {confirmedDraft.date ? ` · ${confirmedDraft.date}` : ''}
              {confirmedDraft.reference ? ` · Ref ${confirmedDraft.reference}` : ''}
            </div>
          )}
          {DESTINATIONS.map((d) => (
            <button
              key={d.kind}
              type="button"
              onClick={() => setSelected(d)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selected?.kind === d.kind
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40 bg-card'
              }`}
            >
              <div className="font-medium text-foreground text-sm">{d.label}</div>
              <div className="text-xs text-muted-foreground">{d.hint}</div>
            </button>
          ))}
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onComplete({
                entryType: selected.entryType,
                draft: confirmedDraft,
                files,
              });
            }}
            className="w-full mt-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            Continue to form
          </button>
        </div>
      )}

      <ReceiptOcrReviewSheet
        open={ocr.sheetOpen}
        loading={ocr.loading}
        draft={ocr.draft}
        onChangeDraft={ocr.setDraft}
        onConfirm={(d) => {
          setConfirmedDraft(d);
          ocr.handleSkip();
          setStep('type');
        }}
        onSkip={() => {
          ocr.handleSkip();
          if (files.length > 0) setStep('type');
        }}
      />
    </div>
  );
}

/** Apply OCR draft into Add Entry description (notes + reference). */
export function buildDescriptionFromOcrDraft(draft: ReceiptOcrDraft | null): string {
  if (!draft) return '';
  const parts: string[] = [];
  if (draft.notes?.trim()) parts.push(draft.notes.trim());
  if (draft.reference?.trim()) parts.push(`Ref: ${draft.reference.trim()}`);
  return parts.join('\n');
}
