/**
 * Move a selected calendar date onto a new view month/year (month/year dropdowns).
 * Clamps day for short months; preserves hours/minutes when present.
 */
export function retargetDateToMonth(selected: Date, viewMonth: Date): Date {
  const maxDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const day = Math.min(selected.getDate(), maxDay);
  return new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    day,
    selected.getHours(),
    selected.getMinutes(),
    selected.getSeconds(),
    selected.getMilliseconds(),
  );
}
