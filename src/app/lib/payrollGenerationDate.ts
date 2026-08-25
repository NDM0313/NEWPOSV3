/**
 * Resolve the calendar day-of-month when payroll should be prepared.
 * Default company setting is 30; short months use the last day.
 */
export const DEFAULT_PAYROLL_GENERATION_DAY = 30;

/** Last calendar day for a given year/month (1-based month). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Effective generation day for a month: min(configuredDay, lastDayOfMonth).
 * Examples: day 30 in Feb → 28/29; day 31 in April → 30.
 */
export function resolvePayrollGenerationDayForMonth(
  year: number,
  month: number,
  configuredDay: number = DEFAULT_PAYROLL_GENERATION_DAY,
): number {
  const clampedConfig = Math.min(31, Math.max(1, Math.floor(configuredDay)));
  const last = lastDayOfMonth(year, month);
  return Math.min(clampedConfig, last);
}

/** Full Date for generation day in a payroll period (month). */
export function resolvePayrollGenerationDate(
  year: number,
  month: number,
  configuredDay: number = DEFAULT_PAYROLL_GENERATION_DAY,
): Date {
  const day = resolvePayrollGenerationDayForMonth(year, month, configuredDay);
  return new Date(year, month - 1, day);
}

/** Human label e.g. "30 (or last day of month if shorter)" */
export function formatGenerationDayHint(configuredDay: number = DEFAULT_PAYROLL_GENERATION_DAY): string {
  const d = Math.min(31, Math.max(1, Math.floor(configuredDay)));
  if (d === 31) {
    return '31 (uses last day of month when the month has fewer days)';
  }
  if (d === 30) {
    return '30 (uses last day of month in February and other short months)';
  }
  return `${d} (never exceeds the last day of the month)`;
}
