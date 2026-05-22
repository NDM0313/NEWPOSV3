/**
 * Calendar dates in the browser's local timezone (not UTC).
 * Avoid `toISOString().slice(0, 10)` on Date pickers — it uses UTC and shifts the day.
 */

export function formatLocalDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localNowDateString(): string {
  return formatLocalDateYYYYMMDD(new Date());
}

export function parseLocalDateInput(value: string | null | undefined): Date {
  const s = String(value ?? '').trim();
  if (!s) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(s);
}

export function toLocalDateString(value: string | Date | null | undefined): string {
  if (!value) return localNowDateString();
  if (value instanceof Date) return formatLocalDateYYYYMMDD(value);
  const s = String(value).trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (dateOnly) return dateOnly[1];
  return formatLocalDateYYYYMMDD(parseLocalDateInput(s));
}

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
