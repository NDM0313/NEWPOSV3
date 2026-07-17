import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ScanText, X } from 'lucide-react';
import type { ReceiptOcrDraft } from '../../lib/ocr/receiptOcrTypes';
import { revokeReceiptOcrPreview } from '../../lib/ocr/receiptOcrEngine';
import { enrichDraftFromRaw, notesLookWeak } from '../../lib/ocr/parsePakBankReceipt';
import { enrichSupplierBillFromRaw } from '../../lib/ocr/parsePakSupplierBill';
import { DateInputField } from './DateTimePicker';

export interface ReceiptOcrReviewSheetProps {
  open: boolean;
  /** Loading OCR */
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

  // Fill missing date/notes from raw as soon as OCR draft lands (before Confirm).
  useEffect(() => {
    if (!open || !draft?.rawText?.trim()) return;
    const raw = draft.rawText.trim();
    if (lastEnrichedRawRef.current === raw) return;
    if (draft.date && !notesLookWeak(draft.notes) && draft.documentKind !== 'supplier_bill') {
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
    <div className="fixed inset-0 z-[220] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={() => closeAndRevoke(onSkip)}
      />
      <div className="relative bg-[#1F2937] border-t border-[#374151] rounded-t-2xl max-h-[90vh] flex flex-col safe-area-pb">
        <div className="flex items-center justify-between p-4 border-b border-[#374151] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ScanText className="w-5 h-5 text-[#3B82F6] shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">Receipt OCR</h3>
                {kindLabel ? (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      draft?.documentKind === 'supplier_bill'
                        ? 'bg-[#F59E0B]/20 text-[#FBBF24]'
                        : 'bg-[#3B82F6]/20 text-[#93C5FD]'
                    }`}
                  >
                    {kindLabel}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] text-[#9CA3AF] truncate">
                Edit fields, then Confirm apply — or Skip to keep attach only
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeAndRevoke(onSkip)}
            className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151]"
            aria-label="Skip"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1 min-h-0">
          {loading || !draft ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#9CA3AF]">
              <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
              <p className="text-sm">Reading receipt…</p>
              <p className="text-xs text-center text-[#6B7280]">First run may take a few seconds</p>
            </div>
          ) : (
            <>
              {draft.previewUrl && (
                <div className="rounded-lg overflow-hidden border border-[#374151] bg-[#111827]">
                  <img
                    src={draft.previewUrl}
                    alt="Receipt preview"
                    className="w-full max-h-40 object-contain bg-[#0B1220]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Amount</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.amount ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    patch({ amount: v === '' ? null : Number(v) || 0 });
                  }}
                  placeholder="0"
                  className="w-full h-11 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>

              <DateInputField
                label="Date"
                value={draft.date ?? ''}
                onChange={(v) => patch({ date: v || null })}
              />
              {draft.date ? (
                <p className="text-[10px] text-[#6B7280] -mt-1" data-testid="ocr-date-hint">
                  Parsed date: {draft.date}
                </p>
              ) : null}

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Time (optional)</label>
                <input
                  type="time"
                  value={draft.time ?? ''}
                  onChange={(e) => patch({ time: e.target.value || null })}
                  className="w-full h-11 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6] [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Reference</label>
                <input
                  type="text"
                  value={draft.reference ?? ''}
                  onChange={(e) => patch({ reference: e.target.value || null })}
                  placeholder="Bill No / S. No / bank ref"
                  className="w-full h-11 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>

              {(draft.documentKind === 'supplier_bill' || draft.supplierHint) && (
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                    Supplier hint (for search)
                  </label>
                  <input
                    type="text"
                    value={draft.supplierHint ?? ''}
                    onChange={(e) => patch({ supplierHint: e.target.value || null })}
                    placeholder="ERP supplier name hint"
                    className="w-full h-11 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  />
                  <p className="text-[10px] text-[#6B7280] mt-1">
                    Suggestions only — you still confirm the supplier on the next screen.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Description add-on</label>
                <textarea
                  value={draft.notes ?? ''}
                  onChange={(e) => patch({ notes: e.target.value || null })}
                  rows={3}
                  placeholder="From / To / extra notes (auto-filled from OCR — editable)"
                  className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none text-sm"
                />
                <p className="text-[10px] text-[#6B7280] mt-1">
                  Auto-filled from receipt text when possible. Party/account pickers stay manual.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs font-medium text-[#3B82F6] hover:underline"
              >
                {showRaw ? 'Hide raw OCR text' : 'Show raw OCR text'}
              </button>
              {showRaw && (
                <textarea
                  value={draft.rawText}
                  onChange={(e) => patch({ rawText: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[#374151] text-[#9CA3AF] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-y"
                />
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-[#374151] flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => closeAndRevoke(onSkip)}
            className="flex-1 py-3 rounded-xl font-semibold text-[#D1D5DB] bg-[#374151] hover:bg-[#4B5563]"
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
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#2563EB] disabled:opacity-50"
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
