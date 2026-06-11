/**
 * Financial year utilities - derive date ranges from company.financial_year_start.
 * No hardcoded Jan–Dec assumptions.
 *
 * @param financialYearStart - Date string (YYYY-MM-DD) or Date for first day of fiscal year
 * @returns { start: Date, end: Date } for current financial year
 */
export function getFinancialYearRange(
  financialYearStart: string | Date | null | undefined,
  anchorDate: Date = new Date()
): { start: Date; end: Date } {
  const now = new Date(anchorDate);
  const defaultStart = new Date(now.getFullYear(), 0, 1); // Jan 1 if not set

  if (!financialYearStart) {
    return {
      start: new Date(defaultStart.getFullYear(), defaultStart.getMonth(), defaultStart.getDate()),
      end: new Date(defaultStart.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  const fyDate =
    typeof financialYearStart === 'string'
      ? new Date(financialYearStart)
      : financialYearStart;

  if (Number.isNaN(fyDate.getTime())) {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  const fyMonth = fyDate.getMonth();
  const fyDay = fyDate.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // Determine which FY we're in: if today is before FY start this year, we're in last year's FY
  let fyStartYear: number;
  if (currentMonth < fyMonth || (currentMonth === fyMonth && currentDay < fyDay)) {
    fyStartYear = currentYear - 1;
  } else {
    fyStartYear = currentYear;
  }

  const start = new Date(fyStartYear, fyMonth, fyDay, 0, 0, 0, 0);
  const end = new Date(fyStartYear + 1, fyMonth, fyDay, 23, 59, 59, 999);
  end.setDate(end.getDate() - 1); // Last day before next FY start

  return { start, end };
}

/** Current FY start through anchor day end (for rolling report filters). */
export function getFinancialYearRangeToToday(
  financialYearStart: string | Date | null | undefined,
  anchorDate: Date = new Date()
): { start: Date; end: Date } {
  const { start } = getFinancialYearRange(financialYearStart, anchorDate);
  const today = new Date(anchorDate);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Full prior completed financial year. */
export function getLastFinancialYearRange(
  financialYearStart: string | Date | null | undefined,
  anchorDate: Date = new Date()
): { start: Date; end: Date } {
  const current = getFinancialYearRange(financialYearStart, anchorDate);
  const start = new Date(current.start);
  start.setFullYear(start.getFullYear() - 1);
  const end = new Date(current.start);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatFinancialYearLabel(start: Date, end: Date): string {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  if (startYear === endYear) return `FY ${startYear}`;
  return `FY ${startYear}-${String(endYear).slice(-2)}`;
}

/**
 * Get financial year label (e.g. "FY 2024-25")
 */
export function getFinancialYearLabel(
  financialYearStart: string | Date | null | undefined,
  anchorDate: Date = new Date()
): string {
  const { start, end } = getFinancialYearRange(financialYearStart, anchorDate);
  return formatFinancialYearLabel(start, end);
}

/** Label for the financial year immediately before the current one. */
export function getLastFinancialYearLabel(
  financialYearStart: string | Date | null | undefined,
  anchorDate: Date = new Date()
): string {
  const { start, end } = getLastFinancialYearRange(financialYearStart, anchorDate);
  return formatFinancialYearLabel(start, end);
}
