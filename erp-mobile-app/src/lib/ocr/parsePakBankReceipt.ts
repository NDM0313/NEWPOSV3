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
    // Meezan: Reference Number (STAN): 648910
    /Reference\s*Number\s*\(\s*STAN\s*\)\s*[:#]?\s*([0-9]{4,})/i,
    /\bSTAN\s*[:#]?\s*([0-9]{4,})\b/i,
    // Faysal / generic: Transaction ID: 868613
    /Transaction\s*ID\s*[:#]?\s*([A-Za-z0-9\-]{4,})/i,
    /Txn\s*ID\s*[:#]?\s*([A-Za-z0-9\-]{4,})/i,
    // Classic Reference Number: 434570 (must consume "Number" before capture)
    /Reference\s+Number\s*[:#]\s*([A-Za-z0-9\-]{3,})/i,
    /Reference\s+Number\s+([0-9]{4,})\b/i,
    /Ref(?:erence)?\s*(?:No\.?|#)\s*[:#]?\s*([A-Za-z0-9\-]{3,})/i,
    /Txn\s*(?:No\.?|#)\s*[:#]?\s*([A-Za-z0-9\-]{3,})/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && m[1].length >= 3 && !/^(number|ref|stan|id)$/i.test(m[1])) {
      return m[1].trim();
    }
  }
  return null;
}

const SKIP_NOTE_LINE =
  /^(transaction\s+successful|meezan\s+bank|successful|status|from\s*account\s*:?|to\s*account\s*:?)$/i;

function lineAfterLabel(text: string, label: RegExp): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (label.test(lines[i])) {
      // Don't treat "From Account:" as bare "From:"
      if (/^From\s*:?/i.test(lines[i]) && /^From\s*Account/i.test(lines[i]) && !/Account/i.test(label.source)) {
        continue;
      }
      const same = lines[i].replace(label, '').replace(/^[:\s]+/, '').trim();
      if (same.length > 2 && !/^Account\s*:?/i.test(same)) {
        const clipped = clipPartyCapture(same);
        const cleaned = cleanPartyValue(clipped);
        if (cleaned) return cleaned;
        if (isCleanPartyName(clipped)) return clipped;
      }
      // Prefer next line if it looks like a party name (not overlay / account mask / chrome)
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const cand = lines[j];
        if (isAccountMaskLine(cand) || isBankChromeLine(cand)) continue;
        if (/^(from|to)\s*(account)?\s*:?/i.test(cand)) break;
        const stripped = cand.replace(/^[a-z]{1,3}[)\].:\-]+\s*/i, '').trim();
        // Calc overlays are never party names — skip and keep looking
        if (looksLikeCalcOverlay(stripped)) continue;
        const cleaned = cleanPartyValue(cand) ?? cleanPartyValue(stripped);
        if (cleaned) return cleaned;
        if (isCleanPartyName(stripped)) return clipPartyCapture(stripped);
        // Shop-style overlay after we already passed a candidate slot
        if (looksLikeScreenshotAnnotation(stripped) && j > i + 1) break;
      }
    }
  }
  const flat = normalizeOcrText(text);
  const m = flat.match(
    new RegExp(label.source + '\\s*[:]?\\s*(.+?)(?=\\s+To\\s+Account|\\s+To\\s*:|$)', 'i')
  );
  if (m?.[1] && m[1].trim().length > 2) {
    const clipped = clipPartyCapture(m[1].trim());
    return (cleanPartyValue(clipped) ?? clipped).slice(0, 120);
  }
  return null;
}

/** Masked / numeric account lines e.g. 0819xxx2478, PK**FAYS***3721 */
export function isAccountMaskLine(line: string): boolean {
  const s = String(line || '').trim();
  if (/^\d{3,}x+\d+$/i.test(s)) return true;
  if (/^\d{6,}$/.test(s.replace(/[\s\-]/g, ''))) return true;
  if (/^\d{2,4}[\dx*]{2,}\d{2,4}$/i.test(s)) return true;
  // IBAN / bank masked: PK**FAYS***3721, 08***********00
  if (/^PK[\d*A-Z]{6,}$/i.test(s.replace(/\s/g, ''))) return true;
  if (/^\d{2}\*{4,}\d{0,4}$/.test(s)) return true;
  if (/\*{4,}/.test(s) && /[\dA-Z]/i.test(s) && s.length >= 8) return true;
  return false;
}

function isBankChromeLine(line: string): boolean {
  const s = String(line || '').trim();
  if (!s) return true;
  if (SKIP_NOTE_LINE.test(s)) return true;
  if (/^PKR\s*[\d,]+/i.test(s)) return true;
  if (/^Rs\.?\s*[\d,]+/i.test(s)) return true;
  if (/reference\s*number/i.test(s)) return true;
  if (/^transaction\s*id\b/i.test(s)) return true;
  if (/^stan\b/i.test(s)) return true;
  if (/^(from|to)\s*(account)?\s*:?/i.test(s) && s.length < 24) return true;
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(s) && /\d{4}/.test(s)) {
    return true;
  }
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.](\d{2}|\d{4})\b/.test(s)) return true;
  if (/^(date|time)\s*:/i.test(s)) return true;
  if (/meezan|faysal\s*bank/i.test(s) && s.length < 40) return true;
  if (/^(current\s+account|savings?\s+account|bank\s+alfalah|purpose\s+of\s+payment)/i.test(s)) {
    return true;
  }
  if (/^transaction\s*type\s*:/i.test(s)) return true;
  if (/^mbl\s*-?\s*to\s*-?\s*mbl$/i.test(s)) return true;
  return false;
}

/** Calc / rate overlays e.g. RMB 7000x42.8, 7000 x 42.8 */
export function looksLikeCalcOverlay(line: string): boolean {
  const s = String(line || '').trim();
  if (s.length < 5 || s.length > 40) return false;
  if (/^(RMB|CNY|USD|EUR|GBP|PKR|AED|SAR)\s*[\d,]+(?:\.\d+)?\s*[x×*]\s*[\d,]+(?:\.\d+)?$/i.test(s)) {
    return true;
  }
  if (/^[\d,]+(?:\.\d+)?\s*[x×*]\s*[\d,]+(?:\.\d+)?$/i.test(s)) return true;
  return false;
}

const PERSON_NAME_MIDDLE =
  /\b(din|bin|binti|mohammad|muhammad|khan|ali|ahmed|ahmad|hussain|husain|saleem|sattar)\b/i;

/**
 * User text-box overlays on screenshots (e.g. FAHAD LACE, RMB 7000x42.8).
 */
export function looksLikeScreenshotAnnotation(line: string): boolean {
  const s = String(line || '').trim();
  if (s.length < 3 || s.length > 40) return false;
  if (isAccountMaskLine(s) || isBankChromeLine(s)) return false;
  if (/^(from|to)\s*:/i.test(s)) return false;
  if (looksLikeCalcOverlay(s)) return true;
  // Must be mostly letters / spaces
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  if (letters < 3) return false;
  if (letters / s.replace(/\s/g, '').length < 0.7) return false;
  // Prefer multi-word overlays or short ALL-CAPS shop-style tags
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return true;
  if (words.length === 1 && /^[A-Z][A-Z0-9&\-]{2,}$/.test(words[0])) return true;
  return false;
}

/** Strip account masks and trailing overlay text from a captured party value. */
export function clipPartyCapture(raw: string): string {
  let s = String(raw || '').trim();
  // Cut at masked account number
  s = s.split(/\s+(?=\d{2,4}[\dx*]{2,}\d)/i)[0]?.trim() || s;
  s = s.replace(/\s+\d{3,}x+\d+\s*$/i, '').trim();
  s = s.replace(/\s+PK[\d*A-Z]{6,}\s*$/i, '').trim();

  const parts = s.split(/\s{2,}|\s\|\s/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const first = parts[0];
    if (isCleanPartyName(first)) return first;
  }

  // Peel only clear overlays after a short head: "SAAD FAHAD LACE" or calc tail.
  // Never peel person-name continuations: "ASAL DIN KHAN", "NADEEM DIN MOHAMMAD".
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && !/[\/]/.test(s) && !PERSON_NAME_MIDDLE.test(s)) {
    const head = words[0];
    const tail = words.slice(1).join(' ');
    const headIsShortSingle = head.length <= 12 && /^[A-Za-z]+$/.test(head);
    if (
      headIsShortSingle &&
      (looksLikeCalcOverlay(tail) || looksLikeScreenshotAnnotation(tail)) &&
      isCleanPartyName(head)
    ) {
      return head;
    }
  }
  if (words.length >= 2 && looksLikeCalcOverlay(words.slice(1).join(' '))) {
    const head = words[0];
    if (head.length <= 12 && /^[A-Za-z]+$/.test(head) && isCleanPartyName(head)) {
      return head;
    }
  }
  return s.slice(0, 120);
}

/**
 * Trailing / orphan user overlays from screenshot text boxes (must go into description).
 */
export function extractScreenshotAnnotations(rawText: string): string[] {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let lastPartyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(from|to)\s*(account)?\s*:?/i.test(lines[i])) lastPartyIdx = i;
    if (isAccountMaskLine(lines[i])) lastPartyIdx = Math.max(lastPartyIdx, i);
  }

  const found: string[] = [];
  const pushUnique = (line: string) => {
    const low = line.toLowerCase();
    if (found.some((f) => f.toLowerCase() === low)) return;
    found.push(line);
  };

  // Prefer lines after last From/To/account block
  const start = lastPartyIdx >= 0 ? lastPartyIdx + 1 : 0;
  for (let i = start; i < lines.length; i++) {
    if (looksLikeScreenshotAnnotation(lines[i])) pushUnique(lines[i]);
  }
  // Calc overlays anywhere (often sit next to To, not only after account mask)
  for (const line of lines) {
    if (looksLikeCalcOverlay(line)) pushUnique(line);
  }
  // Also scan earlier trailing-looking overlays if nothing found (overlay above footer)
  if (!found.length) {
    for (const line of lines) {
      if (looksLikeScreenshotAnnotation(line)) pushUnique(line);
    }
  }
  return found;
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
  let s = clipPartyCapture(raw.trim());
  // Strip leading OCR junk: "dh) NAME" → "NAME"
  s = s.replace(/^[a-z]{1,3}[)\].:\-]+\s*/i, '').trim();
  s = s.replace(/^[:\-]+\s*/, '').trim();
  return isCleanPartyName(s) ? s : isCleanPartyName(raw) ? clipPartyCapture(raw.trim()) : null;
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

/** Append annotation lines missing from notes (case-insensitive). */
export function mergeAnnotationsIntoNotes(
  notes: string | null | undefined,
  annotations: string[]
): string | null {
  let out = String(notes ?? '').trim();
  const lower = out.toLowerCase();
  for (const ann of annotations) {
    const a = ann.trim();
    if (!a) continue;
    if (lower.includes(a.toLowerCase()) || out.toLowerCase().includes(a.toLowerCase())) continue;
    out = out ? `${out}\n${a}` : a;
  }
  const capped = out.slice(0, 500).trim();
  return capped || null;
}

/**
 * Build editable description add-on: clean From/To + screenshot overlays
 * (e.g. FAHAD LACE), never stop at garbage From alone.
 */
export function buildReceiptNotes(rawText: string): string | null {
  const structured = parsePartyNotesFromReceiptText(rawText);
  const annotations = extractScreenshotAnnotations(rawText);
  const structuredLower = (structured || '').toLowerCase();
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const keep: string[] = [];
  if (structured) keep.push(structured);

  // Annotations first (user text boxes must not be crowded out by account masks)
  for (const ann of annotations) {
    if (structuredLower.includes(ann.toLowerCase())) continue;
    keep.push(ann);
  }

  for (const line of lines) {
    if (SKIP_NOTE_LINE.test(line)) continue;
    if (line.length < 3) continue;
    if (isAccountMaskLine(line)) continue;
    if (isBankChromeLine(line)) continue;
    if (looksLikeScreenshotAnnotation(line)) continue; // already added
    // Faysal Comment / Purpose free text
    const commentVal = line.match(/^(?:Comment|Purpose)\s*:?\s*(.+)$/i)?.[1]?.trim();
    if (commentVal && commentVal.length >= 2) {
      if (!keep.some((k) => k.toLowerCase().includes(commentVal.toLowerCase()))) {
        keep.push(commentVal);
      }
      continue;
    }
    // Skip if already covered by structured From/To
    const low = line.toLowerCase();
    if (structuredLower && structuredLower.includes(low)) continue;
    if (fromToLineRedundant(line, structured)) continue;
    if (annotations.some((a) => a.toLowerCase() === low)) continue;
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
  } else {
    // Even when notes look fine, always merge screenshot text-box overlays
    const annotations = extractScreenshotAnnotations(raw);
    next.notes = mergeAnnotationsIntoNotes(next.notes, annotations);
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
