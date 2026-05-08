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

/** User-facing date+time string using device locale (not UTC ISO). */
export function formatLocalDateTimeDisplay(d: Date = new Date(), locale = 'en-PK'): string {
  try {
    return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
