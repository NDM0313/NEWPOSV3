/**
 * DIN business week: Saturday (start) through Friday, with "this week" ending today.
 * Matches web `src/app/utils/businessWeek.ts`.
 */

/** Days since last Saturday (0 = today is Saturday). JS getDay: 0=Sun … 6=Sat. */
export function getDaysSinceSaturday(dayOfWeek: number): number {
  return (dayOfWeek + 1) % 7;
}

export function getThisBusinessWeekRange(anchorDate: Date = new Date()): { startDate: Date; endDate: Date } {
  const today = new Date(anchorDate);
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - getDaysSinceSaturday(today.getDay()));
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

/** Previous full business week: Saturday through Friday immediately before this week's Saturday. */
export function getLastBusinessWeekRange(anchorDate: Date = new Date()): { startDate: Date; endDate: Date } {
  const { startDate: thisWeekStart } = getThisBusinessWeekRange(anchorDate);
  const startDate = new Date(thisWeekStart);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(thisWeekStart);
  endDate.setDate(endDate.getDate() - 1);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}
