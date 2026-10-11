/**
 * Minimal calendar grid helpers (no date-fns). All dates use local timezone.
 */

import { formatLocalDateYYYYMMDD } from './localDate';

export function parseYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Monday as first day of week. */
export function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), diff);
}

export function eachDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

export function differenceInDays(a: Date, b: Date): number {
  const ms = 86400000;
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da - db) / ms);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayHeader(d: Date): { weekday: string; day: string } {
  return { weekday: WEEKDAYS_SHORT[d.getDay()], day: String(d.getDate()) };
}

export function formatYmdLong(ymd: string): string {
  const d = parseYmd(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function dateToYmd(d: Date): string {
  return formatLocalDateYYYYMMDD(d);
}

/** True when booking [startYmd, endYmd] overlaps the calendar day (inclusive). */
export function bookingOverlapsDay(startYmd: string, endYmd: string, day: Date): boolean {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= d && d <= end;
}
