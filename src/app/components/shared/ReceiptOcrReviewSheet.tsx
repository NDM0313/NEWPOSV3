import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ScanText, X } from 'lucide-react';
import type { ReceiptOcrDraft } from '@/app/lib/ocr/receiptOcrTypes';
import { ocrDateTimeLocal } from '@/app/lib/ocr/receiptOcrTypes';
import { revokeReceiptOcrPreview } from '@/app/lib/ocr/receiptOcrEngine';
import { enrichDraftFromRaw, notesLookWeak } from '@/app/lib/ocr/parsePakBankReceipt';
import { enrichSupplierBillFromRaw } from '@/app/lib/ocr/parsePakSupplierBill';
import { DateTimePicker } from '@/app/components/ui/DateTimePicker';
import { formatLocalDateTimeYYYYMMDDHHmm } from '@/app/utils/localDate';

export interface ReceiptOcrReviewSheetProps {
  open: boolean;
  loading?: boolean;
  draft: ReceiptOcrDraft | null;
  onChangeDraft: (draft: ReceiptOcrDraft) => void;
  onConfirm: (draft: ReceiptOcrDraft) => void;
  onSkip: () => void;
}

function enrichByKind(draft: ReceiptOcrDraft): ReceiptOcrDraft {
  if (draft.documentKind === 'supplier_bill') return enrichSupplierBillFromRaw(draft);
  return enrichDraftFromRaw(draft);
}

export function ReceiptOcrReviewSheet({
  open,
  loading = false,
  draft,
  onChangeDraft,
  onConfirm,
  onSkip,
}: ReceiptOcrReviewSheetProps) {
  const [showRaw, setShowRaw] = useState(false);
  const lastEnrichedRawRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setShowRaw(false);
      lastEnrichedRawRef.current = null;
      return;
    }
    if (draft?.rawText?.trim()) setShowRaw(true);
  }, [open, draft?.rawText]);

  useEffect(() => {
    if (!open || !draft?.rawText?.trim()) return;
    const raw = draft.rawText.trim();
    if (lastEnrichedRawRef.current === raw) return;
    if (draft.date && !notesLookWeak(draft.notes, draft.rawText) && draft.documentKind !== 'supplier_bill') {
      lastEnrichedRawRef.current = raw;
      return;
    }
    if (
      draft.documentKind === 'supplier_bill' &&
      draft.date &&
      draft.amount != null &&
      draft.reference
    ) {
      lastEnrichedRawRef.current = raw;
      return;
    }
    const enriched = enrichByKind(draft);
    lastEnrichedRawRef.current = raw;
    if (
      enriched.date !== draft.date ||
      enriched.time !== draft.time ||
      enriched.notes !== draft.notes ||
      enriched.reference !== draft.reference ||
      enriched.amount !== draft.amount ||
      enriched.supplierHint !== draft.supplierHint
    ) {
      onChangeDraft(enriched);
    }
  }, [open, draft, onChangeDraft]);

  if (!open) return null;

  const patch = (partial: Partial<ReceiptOcrDraft>) => {
    if (!draft) return;
    onChangeDraft({ ...draft, ...partial });
  };

  const closeAndRevoke = (fn: () => void) => {
    revokeReceiptOcrPreview(draft);
    fn();
  };

  const kindLabel =
    draft?.documentKind === 'supplier_bill'
      ? 'Supplier bill'
      : draft?.documentKind === 'bank'
        ? 'Bank receipt'
        : null;

  const sheet = (
    <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={() => closeAndRevoke(onSkip)}
      />
      <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ScanText className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">Receipt OCR</h3>
                {kindLabel ? (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      draft?.documentKind === 'supplier_bill'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {kindLabel}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                Edit fields, then Confirm apply — or Skip to keep attach only
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeAndRevoke(onSkip)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Skip"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1 min-h-0">
          {loading || !draft ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-sm">Reading receipt…</p>
              <p className="text-xs text-center text-muted-foreground/80">First run may take a few seconds</p>
            </div>
          ) : (
            <>
              {draft.previewUrl && (
                <div className="rounded-lg overflow-hidden border border-border bg-muted/40">
                  <img
                    src={draft.previewUrl}
                    alt="Receipt preview"
                    className="w-full max-h-40 object-contain bg-background"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.amount ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    patch({ amount: v === '' ? null : Number(v) || 0 });
                  }}
                  placeholder="0"
                  className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <DateTimePicker
                label="Date & time"
                required
                value={
                  ocrDateTimeLocal(draft.date, draft.time) ??
                  (draft.date ? `${draft.date}T12:00` : formatLocalDateTimeYYYYMMDDHHmm(new Date()))
                }
                onChange={(v) => {
                  const [datePart, timePart] = v.split('T');
                  patch({
                    date: datePart || null,
                    time: timePart?.slice(0, 5) || null,
                  });
                }}
              />
              {draft.date ? (
                <p className="text-[10px] text-muted-foreground -mt-1" data-testid="ocr-date-hint">
                  Parsed date: {draft.date}
                  {draft.time ? ` ${draft.time}` : ''}
                </p>
              ) : null}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reference</label>
                <input
                  type="text"
                  value={draft.reference ?? ''}
                  onChange={(e) => patch({ reference: e.target.value || null })}
                  placeholder="Bill No / S. No / bank ref"
                  className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {(draft.documentKind === 'supplier_bill' || draft.supplierHint) && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Supplier hint (for search)
                  </label>
                  <input
                    type="text"
                    value={draft.supplierHint ?? ''}
                    onChange={(e) => patch({ supplierHint: e.target.value || null })}
                    placeholder="ERP supplier name hint"
                    className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description add-on</label>
                <textarea
                  value={draft.notes ?? ''}
                  onChange={(e) => patch({ notes: e.target.value || null })}
                  rows={3}
                  placeholder="From / To / extra notes (auto-filled from OCR — editable)"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs font-medium text-blue-400 hover:underline"
              >
                {showRaw ? 'Hide raw OCR text' : 'Show raw OCR text'}
              </button>
              {showRaw && (
                <textarea
                  value={draft.rawText}
                  onChange={(e) => patch({ rawText: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-muted-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => closeAndRevoke(onSkip)}
            className="flex-1 py-3 rounded-xl font-semibold text-muted-foreground bg-muted hover:bg-muted/80"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={loading || !draft}
            onClick={() => {
              if (!draft) return;
              const enriched = enrichByKind(draft);
              revokeReceiptOcrPreview(draft);
              onChangeDraft(enriched);
              onConfirm({ ...enriched, previewUrl: null });
            }}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 disabled:opacity-50"
          >
            Confirm apply
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}
