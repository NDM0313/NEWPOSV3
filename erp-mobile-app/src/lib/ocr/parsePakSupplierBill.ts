import type { ReceiptOcrDraft, ReceiptOcrDocumentKind } from './receiptOcrTypes';
import { emptyReceiptOcrDraft } from './receiptOcrTypes';
import { normalizeOcrText, parseDateFromReceiptText, parsePakBankReceipt } from './parsePakBankReceipt';

const BUYER_NOISE =
  /\b(din\s*collection|deen\s*collection|ansar\s*din|m\/?s\.?)\b/i;

/** Score text as bank transfer screenshot vs supplier cash-memo / bill. */
export function detectDocumentKind(rawText: string): ReceiptOcrDocumentKind {
  const t = String(rawText || '');
  const flat = normalizeOcrText(t).toLowerCase();

  let bankScore = 0;
  let billScore = 0;

  if (/\bpkr\b/.test(flat) && /\b(from\s*account|to\s*account|reference\s*number)\b/.test(flat)) {
    bankScore += 5;
  }
  if (/\btransaction\s*successful\b/.test(flat)) bankScore += 3;
  if (/\bmeezan\b/.test(flat)) bankScore += 2;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}.+\d{4}.+(am|pm)\b/i.test(flat)) {
    bankScore += 1;
  }

  if (/\b(s\.?\s*no\.?|sr\.?\s*no\.?|sr\s*#|cash\s*memo)\b/i.test(t)) billScore += 4;
  if (/نمبر|تاریخ|سابقہ|بقایا|ٹوٹل/.test(t)) billScore += 3;
  if (/\/-/.test(t)) billScore += 2;
  if (/\b(total\s*bal|previous\s*balance|sabiqa|baqaya)\b/i.test(flat)) billScore += 2;
  if (/\bdate\s*[:.]?\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/i.test(flat)) billScore += 1;
  if (/\b(no\.?|number)\s*[:.]?\s*\d{2,}\b/i.test(flat) && !/\breference\s*number\b/i.test(flat)) {
    billScore += 1;
  }

  if (bankScore === 0 && billScore === 0) return 'unknown';
  if (bankScore >= billScore + 2) return 'bank';
  if (billScore >= bankScore) return 'supplier_bill';
  return bankScore > billScore ? 'bank' : 'supplier_bill';
}

function expandTwoDigitYear(yy: number): number {
  // Business bills in this ERP era: 00–79 → 2000+, 80–99 → 1900+
  if (yy >= 100) return yy;
  return yy >= 80 ? 1900 + yy : 2000 + yy;
}

function toYmd(y: number, m: number, d: number): string | null {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Header date: Date / تاریخ + DD/MM/YY(YY). Prefer first match in top portion. */
export function parseSupplierBillDate(text: string): string | null {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const head = lines.slice(0, 12).join('\n');
  const labeled = head.match(
    /(?:Date|تاریخ)\s*[:.]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/i
  );
  if (labeled) {
    const d = Number(labeled[1]);
    const m = Number(labeled[2]);
    let y = Number(labeled[3]);
    if (String(labeled[3]).length <= 2) y = expandTwoDigitYear(y);
    const ymd = toYmd(y, m, d);
    if (ymd) return ymd;
  }
  // First DMY in header (not IRF lines)
  const dmy = head.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (String(dmy[3]).length <= 2) y = expandTwoDigitYear(y);
    const ymd = toYmd(y, m, d);
    if (ymd) return ymd;
  }
  return parseDateFromReceiptText(text);
}

/** Top bill number: S. No / Sr. No / No. / نمبر — not IRF/IC line codes. */
export function parseSupplierBillReference(text: string): string | null {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const head = lines.slice(0, 15).join('\n');

  const patterns: RegExp[] = [
    /S\.?\s*No\.?\s*[:.]?\s*(\d{1,6})\b/i,
    /Sr\.?\s*No\.?\s*[:.]?\s*(\d{1,6})\b/i,
    /Sr\s*#\s*[:.]?\s*(\d{1,6})\b/i,
    /نمبر\s*[:.]?\s*(\d{1,6})\b/,
    /\bNo\.?\s*[:.]?\s*(\d{2,6})\b/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseMoneyToken(raw: string): number | null {
  const cleaned = String(raw)
    .replace(/\/-/g, '')
    .replace(/[^\d.,]/g, '')
    .replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Current bill total: prefer labeled Total / ٹوٹل before سابقہ بقایا.
 * Never pick closing balance that includes previous AP.
 */
export function parseSupplierBillAmount(text: string): { amount: number | null; confidence: number } {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let baqayaIdx = lines.findIndex((l) =>
    /سابقہ|بقایا|previous\s*balance|sabiqa|baqaya/i.test(l)
  );
  if (baqayaIdx < 0) baqayaIdx = lines.length;

  const before = lines.slice(0, baqayaIdx);
  const searchRegion = before.length ? before : lines;

  // Labeled totals in region before previous balance
  const labeled: number[] = [];
  for (const line of searchRegion) {
    if (/سابقہ|بقایا|previous\s*balance/i.test(line)) continue;
    const m = line.match(
      /(?:ٹوٹل|Total(?:\s*Bal\.?)?|Grand\s*Total|Amount)\s*[:.]?\s*([0-9]{1,3}(?:,[0-9]{2,3})+|([0-9]{4,}))/i
    );
    if (m) {
      const n = parseMoneyToken(m[1] || m[2]);
      if (n != null && n >= 100) labeled.push(n);
    }
    // "=168,450=" style
    const eq = line.match(/=\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*=/);
    if (eq) {
      const n = parseMoneyToken(eq[1]);
      if (n != null && n >= 100) labeled.push(n);
    }
  }
  if (labeled.length) {
    // Prefer the smallest labeled total in the "before baqaya" region that looks like a bill total
    // (current bill usually smaller than ledger). If only one, use it.
    const sorted = [...labeled].sort((a, b) => a - b);
    return { amount: sorted[0], confidence: 0.8 };
  }

  // Fallback: money-like tokens ending with /- in before-baqaya region; take largest under a cap
  // relative to any baqaya line amount if present.
  const candidates: number[] = [];
  for (const line of searchRegion) {
    const re = /([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{5,})\s*\/-/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const n = parseMoneyToken(m[1]);
      if (n != null && n >= 1000) candidates.push(n);
    }
  }
  if (!candidates.length) {
    // Plain large numbers near bottom of before region
    for (const line of searchRegion.slice(-8)) {
      const m = line.match(/\b([0-9]{1,3}(?:,[0-9]{3}){1,}|[0-9]{5,7})\b/);
      if (m) {
        const n = parseMoneyToken(m[1]);
        if (n != null && n >= 1000 && n < 50_000_000) candidates.push(n);
      }
    }
  }
  if (!candidates.length) return { amount: null, confidence: 0 };

  candidates.sort((a, b) => b - a);
  // If we saw a previous-balance line with a huge number, prefer candidates much smaller than it
  let baqayaAmt: number | null = null;
  if (baqayaIdx < lines.length) {
    const bm = lines[baqayaIdx].match(/([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{6,})/);
    if (bm) baqayaAmt = parseMoneyToken(bm[1]);
  }
  if (baqayaAmt && baqayaAmt > 100000) {
    const under = candidates.filter((c) => c < baqayaAmt! * 0.85 && c < baqayaAmt!);
    if (under.length) return { amount: under[0], confidence: 0.7 };
  }
  return { amount: candidates[0], confidence: 0.55 };
}

const SHOP_LINE =
  /\b(silk|cotton|variety|banars|banarsi|collection|wholesale|cash\s*memo|factory|outlet)\b/i;

/** Heuristic supplier / shop name for fuzzy match (not DIN COLLECTION buyer). */
export function parseSupplierBillHint(text: string): string | null {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);

  for (const line of lines) {
    if (BUYER_NOISE.test(line) && !SHOP_LINE.test(line)) continue;
    if (/^(date|s\.?\s*no|sr\.?\s*no|no\.?|phone|cell|address)\b/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    // Printed shop headers tend to be Title Case / ALL CAPS English, length 6–60
    if (/^[A-Za-z0-9][A-Za-z0-9\s.&'\-]{4,58}$/.test(line) && /[A-Za-z]{3}/.test(line)) {
      if (BUYER_NOISE.test(line)) continue;
      if (SHOP_LINE.test(line) || line === line.toUpperCase() || /\b(M\.?\s*[A-Z]|SILK|SONS)\b/.test(line)) {
        return line.slice(0, 80);
      }
    }
  }

  // Parenthetical hint e.g. (SALEEM BHAI)
  const paren = String(text || '').match(/\(([A-Za-z][A-Za-z\s.]{2,40})\)/);
  if (paren?.[1] && !BUYER_NOISE.test(paren[1])) return paren[1].trim();

  return null;
}

export function buildSupplierBillNotes(params: {
  supplierHint: string | null;
  shopLine?: string | null;
  rawText: string;
}): string | null {
  const parts: string[] = [];
  if (params.supplierHint) parts.push(`Supplier hint: ${params.supplierHint}`);
  if (params.shopLine && params.shopLine !== params.supplierHint) {
    parts.push(`Shop: ${params.shopLine}`);
  }
  const snippet = String(params.rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('\n');
  if (snippet && parts.join('\n').length < 200) {
    parts.push(snippet.slice(0, 280));
  }
  const out = parts.join('\n').slice(0, 500).trim();
  return out || null;
}

export function parsePakSupplierBill(rawText: string): ReceiptOcrDraft {
  const draft = emptyReceiptOcrDraft(String(rawText || '').trim());
  draft.documentKind = 'supplier_bill';
  if (!draft.rawText) return draft;

  draft.reference = parseSupplierBillReference(draft.rawText);
  draft.date = parseSupplierBillDate(draft.rawText);
  const { amount, confidence } = parseSupplierBillAmount(draft.rawText);
  draft.amount = amount;
  draft.confidence = confidence;
  draft.time = null;
  const hint = parseSupplierBillHint(draft.rawText);
  draft.supplierHint = hint;
  draft.notes = buildSupplierBillNotes({ supplierHint: hint, rawText: draft.rawText });

  if (amount) {
    draft.confidence = Math.min(
      1,
      draft.confidence + (draft.date ? 0.05 : 0) + (draft.reference ? 0.05 : 0)
    );
  }
  return draft;
}

export function enrichSupplierBillFromRaw(draft: ReceiptOcrDraft): ReceiptOcrDraft {
  const raw = String(draft.rawText || '').trim();
  if (!raw) return draft;
  const parsed = parsePakSupplierBill(raw);
  const next: ReceiptOcrDraft = { ...draft, documentKind: 'supplier_bill' };
  if (next.amount == null || !(next.amount > 0)) next.amount = parsed.amount;
  if (!next.date) next.date = parsed.date;
  if (!next.reference) next.reference = parsed.reference;
  if (!next.supplierHint) next.supplierHint = parsed.supplierHint;
  if (!next.notes?.trim() || (parsed.notes && next.notes.length < 20)) {
    next.notes = parsed.notes ?? next.notes;
  }
  next.confidence = Math.max(next.confidence || 0, parsed.confidence || 0);
  return next;
}

/** Normalize name for fuzzy supplier matching. */
export function normalizeSupplierName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeSupplierName(s).split(' ').filter((t) => t.length > 1));
}

/** Simple score 0–1: token overlap + substring. */
export function scoreSupplierNameMatch(hint: string, candidate: string): number {
  const h = normalizeSupplierName(hint);
  const c = normalizeSupplierName(candidate);
  if (!h || !c) return 0;
  if (h === c) return 1;
  if (c.includes(h) || h.includes(c)) return 0.9;
  const ht = tokenSet(h);
  const ct = tokenSet(c);
  if (!ht.size || !ct.size) return 0;
  let inter = 0;
  for (const t of ht) if (ct.has(t)) inter += 1;
  return inter / Math.max(ht.size, ct.size);
}

export function fuzzyMatchSuppliers<T extends { id: string; name: string }>(
  hint: string | null | undefined,
  suppliers: T[],
  limit = 5
): Array<T & { matchScore: number }> {
  const h = String(hint ?? '').trim();
  if (!h || !suppliers.length) return [];
  return suppliers
    .map((s) => ({ ...s, matchScore: scoreSupplierNameMatch(h, s.name) }))
    .filter((s) => s.matchScore >= 0.35)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/** Route raw OCR text to bank or supplier-bill parser. */
export function parseReceiptOcrText(rawText: string): ReceiptOcrDraft {
  const kind = detectDocumentKind(rawText);
  if (kind === 'supplier_bill') return parsePakSupplierBill(rawText);
  const draft = parsePakBankReceipt(rawText);
  draft.documentKind = kind === 'unknown' ? (draft.amount ? 'bank' : 'unknown') : 'bank';
  return draft;
}
