/**
 * Calendar dates in the device's local timezone (not UTC).
 * Avoid `toISOString().slice(0, 10)` — it uses UTC and shifts the day near midnight.
 */

export function formatLocalDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function localNowDateString(): string {
  return formatLocalDateYYYYMMDD(new Date());
}

/** Current local date+time for `datetime-local` inputs (YYYY-MM-DDTHH:mm). */
export function localNowDateTimeString(): string {
  const now = new Date();
  return `${formatLocalDateYYYYMMDD(now)}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/** Split a `datetime-local` value into payment_date (YYYY-MM-DD) and timestamptz for created_at. */
export function parsePaymentDateTimeLocal(value: string): { paymentDate: string; paymentAt: string } {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    const now = new Date();
    return { paymentDate: formatLocalDateYYYYMMDD(now), paymentAt: toLocalISOString(now) };
  }
  const [datePart, timePart] = trimmed.split('T');
  const paymentDate = datePart || localNowDateString();
  const d = timePart ? new Date(trimmed) : new Date(`${paymentDate}T12:00:00`);
  const paymentAt = Number.isNaN(d.getTime()) ? getCurrentLocalTimestamp() : toLocalISOString(d);
  return { paymentDate, paymentAt };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Full ISO-8601 with local timezone offset (e.g. 2026-05-25T23:15:00+05:00).
 * Never emits trailing Z — use for timestamptz write payloads instead of toISOString().
 */
export function toLocalISOString(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offH = pad2(Math.floor(abs / 60));
  const offM = pad2(abs % 60);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}${sign}${offH}:${offM}`;
}

/** Alias for created_at / updated_at / voided_at write paths. */
export function getCurrentLocalTimestamp(): string {
  return toLocalISOString(new Date());
}

/** UTC midnight timestamps — hide bogus 05:00 local time in lists. */
function shouldSuppressTimeForDisplay(value: string): boolean {
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  if (/T00:00:00(\.\d+)?Z$/i.test(s)) return true;
  if (/T00:00:00(\.\d+)?\+00:00$/i.test(s)) return true;
  if (/\s00:00:00(\.\d+)?(\+00(:00)?(:00)?)?$/i.test(s)) return true;
  if (/\s00:00:00(\.\d+)?Z$/i.test(s)) return true;
  if (!/T/.test(s) && !/\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(s)) return true;
  return false;
}

function isUtcMidnightArtifact(raw: string, date: Date): boolean {
  const s = raw.trim();
  const isUtcSource = /Z$/i.test(s) || /\+00:00$/i.test(s) || /\+00$/i.test(s);
  if (!isUtcSource) return false;
  return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
}

function resolveEventTimeForDisplay(raw: string | null | undefined): Date | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (shouldSuppressTimeForDisplay(s)) return null;
  if (!/T/.test(s) && !/\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(s)) return null;
  const d = parseLocalDateInput(s);
  if (isUtcMidnightArtifact(s, d)) return null;
  return d;
}

/**
 * Parse date-only YYYY-MM-DD as local calendar midnight (not UTC).
 * Full ISO datetimes pass through to Date constructor.
 */
export function parseLocalDateInput(value: string | null | undefined): Date {
  const s = String(value ?? '').trim();
  if (!s) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(s);
}

/** YYYY-MM-DD from a date string or Date using local calendar fields. */
export function toLocalDateString(value: string | Date | null | undefined): string {
  if (!value) return localNowDateString();
  if (value instanceof Date) return formatLocalDateYYYYMMDD(value);
  const s = String(value).trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (dateOnly) return dateOnly[1];
  return formatLocalDateYYYYMMDD(parseLocalDateInput(s));
}

/** User-facing date+time string using device locale (not UTC ISO). */
export function formatLocalDateTimeDisplay(d: Date = new Date(), locale = 'en-PK'): string {
  try {
    return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}

/**
 * Relative list label: Today / Yesterday + time, or short date.
 * Uses parseLocalDateInput so invoice_date YYYY-MM-DD does not show as 05:00 PKT.
 */
export function formatRelativeListDateTime(
  value: string | null | undefined,
  locale = 'en-PK',
): string {
  const dateObj = parseLocalDateInput(value);
  const now = new Date();
  const isToday = dateObj.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = dateObj.toDateString() === yesterday.toDateString();
  const raw = String(value ?? '').trim();
  const hasTime =
    !shouldSuppressTimeForDisplay(raw) &&
    (raw.includes('T') ||
      dateObj.getHours() !== 0 ||
      dateObj.getMinutes() !== 0 ||
      dateObj.getSeconds() !== 0);

  let timeStr = '';
  if (hasTime) {
    timeStr = dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  if (isToday) return timeStr ? `Today, ${timeStr}` : 'Today';
  if (isYesterday) return timeStr ? `Yesterday, ${timeStr}` : 'Yesterday';
  if (timeStr) {
    return `${dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${timeStr}`;
  }
  return dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * List label: calendar day from documentDate + clock time from eventTimestamp.
 * e.g. "Yesterday · 24 May 2026, 2:30 pm"
 */
export function formatDocumentListDateTime(input: {
  documentDate?: string | null;
  eventTimestamp?: string | null;
  locale?: string;
}): string {
  const locale = input.locale ?? 'en-PK';
  const docYmd = input.documentDate ? toLocalDateString(input.documentDate) : null;
  const eventRaw = String(input.eventTimestamp ?? '').trim();

  const calendarDate = docYmd
    ? parseLocalDateInput(docYmd)
    : eventRaw
      ? parseLocalDateInput(eventRaw)
      : new Date();

  const timeDate = resolveEventTimeForDisplay(eventRaw);

  const now = new Date();
  const isToday = calendarDate.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = calendarDate.toDateString() === yesterday.toDateString();

  const fullDatePart = calendarDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let prefix = '';
  if (isToday) prefix = 'Today · ';
  else if (isYesterday) prefix = 'Yesterday · ';

  const datePart = `${prefix}${fullDatePart}`;

  if (!timeDate) return datePart;

  const timePart = timeDate.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart}, ${timePart}`;
}
