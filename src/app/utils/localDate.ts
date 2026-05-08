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
