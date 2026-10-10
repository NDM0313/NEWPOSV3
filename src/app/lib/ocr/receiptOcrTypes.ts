/** Editable OCR draft for receipt / supplier bill → form apply. */

export type ReceiptOcrDocumentKind = 'bank' | 'supplier_bill' | 'unknown';

export interface ReceiptOcrDraft {
  amount: number | null;
  /** YYYY-MM-DD when parsed */
  date: string | null;
  /** HH:mm 24h when parsed from receipt time */
  time: string | null;
  reference: string | null;
  /** Description add-on / notes (From/To text, etc.) */
  notes: string | null;
  rawText: string;
  /** 0–1 heuristic confidence for amount parse */
  confidence: number;
  /** Detected document type for UI badge + re-enrich */
  documentKind?: ReceiptOcrDocumentKind;
  /** Fuzzy-match hint for ERP supplier (suggestions only) */
  supplierHint?: string | null;
  /** Object URL for preview thumb (revoke on close) */
  previewUrl?: string | null;
  sourceFileName?: string | null;
}

export interface ReceiptOcrFormPatch {
  amount?: number;
  date?: string;
  /** HH:mm for payment datetime-local */
  time?: string;
  reference?: string;
  notes?: string;
  supplierHint?: string;
}

export function emptyReceiptOcrDraft(rawText = ''): ReceiptOcrDraft {
  return {
    amount: null,
    date: null,
    time: null,
    reference: null,
    notes: null,
    rawText,
    confidence: 0,
    documentKind: 'unknown',
    supplierHint: null,
    previewUrl: null,
    sourceFileName: null,
  };
}

export function isImageFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  const n = file.name.toLowerCase();
  return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp');
}

/** Build datetime-local value from OCR date (+ optional time). */
export function ocrDateTimeLocal(date: string | null | undefined, time?: string | null): string | null {
  const d = String(date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = String(time ?? '').trim();
  const hhmm = /^\d{2}:\d{2}$/.test(t) ? t : '12:00';
  return `${d}T${hhmm}`;
}
