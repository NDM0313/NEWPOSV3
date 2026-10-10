import { buildDateRange, type DateRangePreset } from '../lib/dateRangePresets';

/** Rental list date presets — subset of global presets. */
export type RentalDatePreset = 'today' | 'week' | 'lastWeek' | 'last30' | 'custom';

const RENTAL_PRESET_MAP: Record<Exclude<RentalDatePreset, 'custom'>, DateRangePreset> = {
  today: 'today',
  week: 'week',
  lastWeek: 'lastWeek',
  last30: 'last30',
};

export function getRentalDateRange(
  preset: RentalDatePreset,
  custom?: { from?: string; to?: string }
): { dateFrom: string; dateTo: string } {
  if (preset === 'custom') {
    const built = buildDateRange('custom');
    const from = custom?.from?.trim() || built.from;
    const to = custom?.to?.trim() || built.to;
    return { dateFrom: from <= to ? from : to, dateTo: from <= to ? to : from };
  }
  const range = buildDateRange(RENTAL_PRESET_MAP[preset]);
  return { dateFrom: range.from, dateTo: range.to };
}
