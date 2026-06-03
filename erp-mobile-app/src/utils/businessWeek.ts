/** DIN business week: Saturday (start) through today. JS getDay: 0=Sun … 6=Sat. */

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
