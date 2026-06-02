import { formatLocalDateYYYYMMDD, localNowDateString } from './localDate';

export type RentalDatePreset = 'today' | '7d' | '30d' | 'custom';

export function getRentalDateRange(
  preset: RentalDatePreset,
  custom?: { from?: string; to?: string }
): { dateFrom: string; dateTo: string } {
  const today = localNowDateString();
  if (preset === 'today') {
    return { dateFrom: today, dateTo: today };
  }
  if (preset === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { dateFrom: formatLocalDateYYYYMMDD(d), dateTo: today };
  }
  if (preset === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return { dateFrom: formatLocalDateYYYYMMDD(d), dateTo: today };
  }
  const from = custom?.from?.trim() || today;
  const to = custom?.to?.trim() || today;
  return { dateFrom: from <= to ? from : to, dateTo: from <= to ? to : from };
}
