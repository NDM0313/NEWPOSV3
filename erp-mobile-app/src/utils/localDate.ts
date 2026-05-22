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
  const hasTime =
    String(value ?? '').includes('T') ||
    (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0 || dateObj.getSeconds() !== 0);

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
