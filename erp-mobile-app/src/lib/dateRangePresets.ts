/**
 * Central date-range presets for mobile ERP (reports, dashboard, rentals, etc.).
 * Aligned with web TopHeader / GlobalFilterContext business-week rules.
 */
import { formatLocalDateYYYYMMDD, localNowDateString, inputHasTime, toLocalDateString, normalizeDateRangeInput } from '../utils/localDate';
import { getLastBusinessWeekRange, getThisBusinessWeekRange } from '../utils/businessWeek';
import {
  getFinancialYearRangeToToday,
  getLastFinancialYearRange,
} from '../utils/financialYear';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last15'
  | 'last30'
  | 'week'
  | 'lastWeek'
  | 'month'
  | 'currentFy'
  | 'lastFy'
  | 'fromStart'
  | 'quarter'
  | 'year'
  | 'all'
  | 'custom';

export interface DateRangeValue {
  from: string;
  to: string;
  preset: DateRangePreset;
}

export const DATE_RANGE_PRESET_CHIPS: { id: DateRangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last15', label: 'Last 15 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'week', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'month', label: 'This month' },
  { id: 'currentFy', label: 'Current financial year' },
  { id: 'lastFy', label: 'Last financial year' },
  { id: 'fromStart', label: 'From start' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

function toIso(d: Date): string {
  return formatLocalDateYYYYMMDD(d);
}

function todayIso(anchor: Date = new Date()): string {
  return toIso(anchor);
}

/** Resolve preset → { from, to } YMD (inclusive). */
export function buildDateRange(
  preset: DateRangePreset,
  anchorDate: Date = new Date(),
  fiscalYearStart?: string | null
): DateRangeValue {
  const today = new Date(anchorDate);
  today.setHours(0, 0, 0, 0);
  const to = todayIso(today);
  const from = new Date(today);

  switch (preset) {
    case 'today':
      return { from: to, to, preset };
    case 'yesterday': {
      from.setDate(from.getDate() - 1);
      const y = toIso(from);
      return { from: y, to: y, preset };
    }
    case 'last7':
      from.setDate(from.getDate() - 6);
      return { from: toIso(from), to, preset };
    case 'last15':
      from.setDate(from.getDate() - 14);
      return { from: toIso(from), to, preset };
    case 'last30':
      from.setDate(from.getDate() - 29);
      return { from: toIso(from), to, preset };
    case 'week': {
      const { startDate } = getThisBusinessWeekRange(today);
      return { from: toIso(startDate), to, preset };
    }
    case 'lastWeek': {
      const { startDate, endDate } = getLastBusinessWeekRange(today);
      return { from: toIso(startDate), to: toIso(endDate), preset };
    }
    case 'month':
      from.setDate(1);
      return { from: toIso(from), to, preset };
    case 'currentFy': {
      const { start, end } = getFinancialYearRangeToToday(fiscalYearStart ?? undefined, today);
      return { from: toIso(start), to: toIso(end), preset };
    }
    case 'lastFy': {
      const { start, end } = getLastFinancialYearRange(fiscalYearStart ?? undefined, today);
      return { from: toIso(start), to: toIso(end), preset };
    }
    case 'fromStart': {
      const start = new Date(today.getFullYear() - 10, 0, 1);
      return { from: toIso(start), to, preset };
    }
    case 'quarter': {
      const m = from.getMonth();
      from.setMonth(m - (m % 3), 1);
      return { from: toIso(from), to, preset };
    }
    case 'year':
      from.setMonth(0, 1);
      return { from: toIso(from), to, preset };
    case 'all':
      return { from: '', to: '', preset };
    case 'custom':
    default:
      return { from: to, to, preset: 'custom' };
  }
}

export function makeInitialDateRange(preset: DateRangePreset = 'month'): DateRangeValue {
  return buildDateRange(preset);
}

/** Human label for active range (subtitle / PDF). */
export function dateRangePresetLabel(value: DateRangeValue): string {
  const chip = DATE_RANGE_PRESET_CHIPS.find((c) => c.id === value.preset);
  if (value.preset !== 'custom' && chip) return chip.label;
  if (!value.from && !value.to) return 'All time';
  const fmt = (v: string) => {
    if (inputHasTime(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
      }
    }
    return toLocalDateString(v);
  };
  if (value.from === value.to) return fmt(value.from);
  return `${fmt(value.from)} → ${fmt(value.to)}`;
}

/** Query bounds for API filters from a DateRangeValue. */
export function queryBoundsFromRange(value: DateRangeValue) {
  return normalizeDateRangeInput(value.from, value.to);
}

/** Default "now" string for custom range init. */
export function defaultRangeToday(): string {
  return localNowDateString();
}
