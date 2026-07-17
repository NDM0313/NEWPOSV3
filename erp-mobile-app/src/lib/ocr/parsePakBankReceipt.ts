import type { ReceiptOcrDraft } from './receiptOcrTypes';
import { emptyReceiptOcrDraft } from './receiptOcrTypes';

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/** Common OCR / Unicode confusables → ASCII for month matching. */
const LOOKALIKE_MAP: Record<string, string> = {
  '\u0408': 'J', // Cyrillic Je
  '\u0458': 'j',
  '\u04AE': 'Y',
  '\u04AF': 'y',
  '\u0430': 'a',
  '\u0410': 'A',
  '\u0435': 'e',
  '\u0415': 'E',
  '\u043E': 'o',
  '\u041E': 'O',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0443': 'y',
  '\u0445': 'x',
  '\u0456': 'i',
  '\u0406': 'I',
  '\u0399': 'I',
  '\u03B9': 'i',
  '\uFF2A': 'J',
  '\uFF4A': 'j',
  '\uFF55': 'u',
  '\uFF4C': 'l',
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toYmd(y: number, m: number, d: number): string | null {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function mapLookalikes(s: string): string {
  let out = '';
  for (const ch of s) {
    out += LOOKALIKE_MAP[ch] ?? ch;
  }
  return out;
}

/** Soft-normalize noisy Tesseract output for matching. */
export function normalizeOcrText(text: string): string {
  let s = String(text || '');
  try {
    s = s.normalize('NFKD');
  } catch {
    /* ignore */
  }
  s = s.replace(/[\u0300-\u036f]/g, '');
  s = mapLookalikes(s);
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[|¦]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForDate(text: string): string {
  return normalizeOcrText(text)
    .replace(/\bJu[l1I|]\b/gi, 'Jul')
    .replace(/\bJuiy\b/gi, 'July')
    .replace(/\bJu\s*[l1I]\b/gi, 'Jul');
}

/** Parse 12h/24h time → HH:mm */
export function parseTimeFromReceiptText(text: string): string | null {
  const t = normalizeOcrText(text);
  const ampm = t.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const ap = ampm[3].toUpperCase();
    if (h < 1 || h > 12 || m > 59) return null;
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${pad2(h)}:${pad2(m)}`;
  }
  const h24 = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) {
    return `${pad2(Number(h24[1]))}:${h24[2]}`;
  }
  return null;
}

/** Parse PKR / Rs amounts from bank-style receipt text. */
export function parseAmountFromReceiptText(text: string): { amount: number | null; confidence: number } {
  const t = normalizeOcrText(text);
  const patterns: RegExp[] = [
    /PKR\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /Rs\.?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /PKR\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return { amount: n, confidence: 0.85 };
    }
  }
  return { amount: null, confidence: 0 };
}

const MONTH_NAME =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

/** Any short OCR separator between day and year (ASCII/Unicode comma, pipe, etc.). */
const DAY_YEAR_SEP = '[^\\dA-Za-z]{0,4}';

export function parseDateFromReceiptText(text: string): string | null {
  const t = normalizeForDate(text);
  // Jul 13, 2026 | 6:20 PM  OR  Jul 13 2026 OR Jul 13，2026 OR Jul 13,2026
  const monDayYear = t.match(
    new RegExp(`\\b(${MONTH_NAME})[.\\-\\s]+(\\d{1,2})${DAY_YEAR_SEP}(\\d{4})\\b`, 'i')
  );
  if (monDayYear) {
    const m = MONTHS[monDayYear[1].toLowerCase()];
    const ymd = toYmd(Number(monDayYear[3]), m, Number(monDayYear[2]));
    if (ymd) return ymd;
  }
  // 13 Jul 2026 / 13 July, 2026
  const dayMonYear = t.match(
    new RegExp(`\\b(\\d{1,2})[.\\-\\s]+(${MONTH_NAME})${DAY_YEAR_SEP}(\\d{4})\\b`, 'i')
  );
  if (dayMonYear) {
    const m = MONTHS[dayMonYear[2].toLowerCase()];
    const ymd = toYmd(Number(dayMonYear[3]), m, Number(dayMonYear[1]));
    if (ymd) return ymd;
  }
  // Jul-13-2026
  const monDash = t.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)-(\d{1,2})-(\d{4})\b/i
  );
  if (monDash) {
    const m = MONTHS[monDash[1].toLowerCase()];
    const ymd = toYmd(Number(monDash[3]), m, Number(monDash[2]));
    if (ymd) return ymd;
  }
  // 13/07/2026 or 13-07-2026 or 13.07.2026
  const dmy = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    const ymd = toYmd(y, m, d);
    if (ymd) return ymd;
  }
  // 2026-07-13
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return toYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  return null;
}

export function parseReferenceFromReceiptText(text: string): string | null {
  const t = normalizeOcrText(text);
  const patterns: RegExp[] = [
    /Reference\s*Number\s*[:#]?\s*([A-Za-z0-9\-]+)/i,
    /Ref(?:erence)?\s*(?:No\.?|Number|#)?\s*[:#]?\s*([A-Za-z0-9\-]+)/i,
    /Txn\s*(?:ID|No\.?|#)?\s*[:#]?\s*([A-Za-z0-9\-]+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && m[1].length >= 3) return m[1].trim();
  }
  return null;
}

function lineAfterLabel(text: string, label: RegExp): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (label.test(lines[i])) {
      const same = lines[i].replace(label, '').replace(/^[:\s]+/, '').trim();
      if (same.length > 2) return same;
      if (lines[i + 1] && lines[i + 1].length > 2) return lines[i + 1];
    }
  }
  const flat = normalizeOcrText(text);
  const m = flat.match(new RegExp(label.source + '\\s*[:]?\\s*(.+?)(?=\\s+To\\s+Account|\\s+To\\s*:|$)', 'i'));
  if (m?.[1] && m[1].trim().length > 2) {
    return m[1].trim().slice(0, 120);
  }
  return null;
}

/** Reject OCR garbage like "dh)" or very short tokens as party names. */
export function isCleanPartyName(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim();
  if (n.length < 3) return false;
  if (/^[a-z]{1,3}[)\].]/i.test(n)) return false;
  if (/^[)\].\d\s]+/.test(n) && n.length < 8) return false;
  // Must contain at least one letter run of length >= 2
  if (!/[A-Za-z]{2,}/.test(n)) return false;
  return true;
}

function cleanPartyValue(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  // Strip leading OCR junk: "dh) NAME" → "NAME"
  s = s.replace(/^[a-z]{1,3}[)\].:\-]+\s*/i, '').trim();
  s = s.replace(/^[:\-]+\s*/, '').trim();
  return isCleanPartyName(s) ? s : isCleanPartyName(raw) ? raw.trim() : null;
}

export function parsePartyNotesFromReceiptText(text: string): string | null {
  const fromRaw = lineAfterLabel(text, /^From\s*Account\s*:?/i) ?? lineAfterLabel(text, /^From\s*:?/i);
  const toRaw = lineAfterLabel(text, /^To\s*Account\s*:?/i) ?? lineAfterLabel(text, /^To\s*:?/i);
  const from = cleanPartyValue(fromRaw);
  const to = cleanPartyValue(toRaw);
  const parts: string[] = [];
  if (from) parts.push(`From: ${from}`);
  if (to) parts.push(`To: ${to}`);
  return parts.length ? parts.join('\n') : null;
}

const SKIP_NOTE_LINE =
  /^(transaction\s+successful|meezan\s+bank|successful|status|from\s*account\s*:?|to\s*account\s*:?)$/i;

/**
 * Build editable description add-on: clean From/To + remaining useful raw lines
 * (e.g. FAHAD LACE), never stop at garbage From alone.
 */
export function buildReceiptNotes(rawText: string): string | null {
  const structured = parsePartyNotesFromReceiptText(rawText);
  const structuredLower = (structured || '').toLowerCase();
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const keep: string[] = [];
  if (structured) keep.push(structured);

  for (const line of lines) {
    if (SKIP_NOTE_LINE.test(line)) continue;
    if (line.length < 3) continue;
    // Skip amount / date / ref lines already captured elsewhere
    if (/^PKR\s*[\d,]+/i.test(line)) continue;
    if (/^Rs\.?\s*[\d,]+/i.test(line)) continue;
    if (/reference\s*number/i.test(line)) continue;
    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(line) && /\d{4}/.test(line)) {
      continue;
    }
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(line)) continue;
    // Skip if already covered by structured From/To
    const low = line.toLowerCase();
    if (structuredLower && structuredLower.includes(low)) continue;
    if (fromToLineRedundant(line, structured)) continue;
    keep.push(line);
    if (keep.join('\n').length > 500) break;
  }

  const out = keep.join('\n').slice(0, 500).trim();
  return out || null;
}

function fromToLineRedundant(line: string, structured: string | null): boolean {
  if (!structured) return false;
  const cleaned = cleanPartyValue(line.replace(/^(From|To)\s*(Account)?\s*:?/i, '').trim());
  if (!cleaned) return false;
  return structured.toLowerCase().includes(cleaned.toLowerCase());
}

/** Fill missing draft fields from rawText (Confirm safety + lookalike recovery). */
export function enrichDraftFromRaw(draft: ReceiptOcrDraft): ReceiptOcrDraft {
  const raw = String(draft.rawText || '').trim();
  if (!raw) return draft;
  const next: ReceiptOcrDraft = { ...draft };

  if (next.amount == null || !(next.amount > 0)) {
    const { amount, confidence } = parseAmountFromReceiptText(raw);
    if (amount != null) {
      next.amount = amount;
      next.confidence = Math.max(next.confidence || 0, confidence);
    }
  }
  if (!next.date) {
    next.date = parseDateFromReceiptText(raw);
  }
  if (!next.time) {
    next.time = parseTimeFromReceiptText(raw);
  }
  if (!next.reference) {
    next.reference = parseReferenceFromReceiptText(raw);
  }

  const rebuilt = buildReceiptNotes(raw);
  if (rebuilt && notesLookWeak(next.notes)) {
    next.notes = rebuilt;
  }

  if (next.amount) {
    next.confidence = Math.min(
      1,
      Math.max(next.confidence || 0, 0.85) + (next.date ? 0.05 : 0) + (next.reference ? 0.05 : 0)
    );
  }
  return next;
}

/** Empty or OCR-garbage From-only notes that should be replaced from raw. */
export function notesLookWeak(notes: string | null | undefined): boolean {
  const n = String(notes ?? '').trim();
  if (!n) return true;
  // "From: dh) …" without To — classic bad OCR stop
  if (/^From:\s*[a-z]{0,3}[)\].]/i.test(n) && !/\bTo:/i.test(n)) return true;
  // From only, very short after label
  if (/^From:\s*.{0,8}$/i.test(n) && !/\bTo:/i.test(n)) return true;
  return false;
}

/** Pure parse — no OCR engine. */
export function parsePakBankReceipt(rawText: string): ReceiptOcrDraft {
  const draft = emptyReceiptOcrDraft(String(rawText || '').trim());
  draft.documentKind = 'bank';
  if (!draft.rawText) return draft;
  const { amount, confidence } = parseAmountFromReceiptText(draft.rawText);
  draft.amount = amount;
  draft.confidence = confidence;
  draft.date = parseDateFromReceiptText(draft.rawText);
  draft.time = parseTimeFromReceiptText(draft.rawText);
  draft.reference = parseReferenceFromReceiptText(draft.rawText);
  draft.notes = buildReceiptNotes(draft.rawText);
  if (amount) {
    draft.confidence = Math.min(
      1,
      draft.confidence + (draft.date ? 0.05 : 0) + (draft.reference ? 0.05 : 0)
    );
  }
  return enrichDraftFromRaw(draft);
}
