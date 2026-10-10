/**
 * Configurable calendar week for Roznamcha Prev/Next navigator.
 * weekStartsOn: 0=Sun … 6=Sat (JS getDay). Default Saturday (6).
 * Full week = start day + 6 days (Sat → Fri).
 */

import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/app/lib/safeBrowserStorage';

export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** v2 bumps past sticky Friday (5) default from the first navigator release. */
export const ROZNAMCHA_WEEK_STARTS_ON_KEY = 'erp-roznamcha-week-starts-on-v2';
export const DEFAULT_ROZNAMCHA_WEEK_STARTS_ON: WeekStartsOn = 6; // Saturday

export const WEEK_START_DAY_OPTIONS: Array<{ value: WeekStartsOn; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

/** Days since last `weekStartsOn` (0 = today is the start day). */
export function getDaysSinceWeekStart(dayOfWeek: number, weekStartsOn: WeekStartsOn): number {
  return (dayOfWeek - weekStartsOn + 7) % 7;
}

export function getWeekRangeContaining(
  anchorDate: Date = new Date(),
  weekStartsOn: WeekStartsOn = DEFAULT_ROZNAMCHA_WEEK_STARTS_ON,
): { startDate: Date; endDate: Date } {
  const anchor = new Date(anchorDate);
  anchor.setHours(0, 0, 0, 0);
  const startDate = new Date(anchor);
  startDate.setDate(anchor.getDate() - getDaysSinceWeekStart(anchor.getDay(), weekStartsOn));
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

export function shiftWeek(
  range: { startDate: Date; endDate: Date },
  deltaWeeks: number,
): { startDate: Date; endDate: Date } {
  const startDate = new Date(range.startDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() + deltaWeeks * 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

export function loadRoznamchaWeekStartsOn(): WeekStartsOn {
  const raw = safeLocalStorageGetItem(ROZNAMCHA_WEEK_STARTS_ON_KEY);
  if (raw == null || raw === '') return DEFAULT_ROZNAMCHA_WEEK_STARTS_ON;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 6) return DEFAULT_ROZNAMCHA_WEEK_STARTS_ON;
  return n as WeekStartsOn;
}

export function saveRoznamchaWeekStartsOn(weekStartsOn: WeekStartsOn): void {
  safeLocalStorageSetItem(ROZNAMCHA_WEEK_STARTS_ON_KEY, String(weekStartsOn));
}
