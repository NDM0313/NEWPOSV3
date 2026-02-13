/**
 * Financial year utilities - derive date ranges from company.financial_year_start.
 * No hardcoded Jan–Dec assumptions.
 *
 * @param financialYearStart - Date string (YYYY-MM-DD) or Date for first day of fiscal year
 * @returns { start: Date, end: Date } for current financial year
 */
export function getFinancialYearRange(
  financialYearStart: string | Date | null | undefined
): { start: Date; end: Date } {
  const now = new Date();
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

/**
 * Get financial year label (e.g. "FY 2024-25")
 */
export function getFinancialYearLabel(
  financialYearStart: string | Date | null | undefined
): string {
  const { start, end } = getFinancialYearRange(financialYearStart);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  if (startYear === endYear) return `FY ${startYear}`;
  return `FY ${startYear}-${String(endYear).slice(-2)}`;
}
