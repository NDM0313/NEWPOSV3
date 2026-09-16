import type { ReceiptOcrDraft, ReceiptOcrFormPatch } from './receiptOcrTypes';

/** Map editable OCR draft → form field patch (only set fields with values). */
export function applyReceiptOcrDraft(draft: ReceiptOcrDraft): ReceiptOcrFormPatch {
  const patch: ReceiptOcrFormPatch = {};
  if (draft.amount != null && Number.isFinite(draft.amount) && draft.amount > 0) {
    patch.amount = draft.amount;
  }
  const date = String(draft.date ?? '').trim();
  if (date) patch.date = date;
  const time = String(draft.time ?? '').trim();
  if (/^\d{2}:\d{2}$/.test(time)) patch.time = time;
  const reference = String(draft.reference ?? '').trim();
  if (reference) patch.reference = reference;
  const notes = String(draft.notes ?? '').trim();
  if (notes) patch.notes = notes;
  const hint = String(draft.supplierHint ?? '').trim();
  if (hint) patch.supplierHint = hint;
  return patch;
}

/** Merge OCR notes into existing notes without wiping user text. */
export function mergeOcrNotes(existing: string, ocrNotes: string | null | undefined): string {
  const cur = String(existing ?? '').trim();
  const add = String(ocrNotes ?? '').trim();
  if (!add) return cur;
  if (!cur) return add;
  if (cur.includes(add)) return cur;
  return `${cur}\n${add}`;
}
