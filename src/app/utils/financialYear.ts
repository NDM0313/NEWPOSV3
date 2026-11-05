/**
 * Financial year utilities — derive date ranges from business fiscal start/end settings.
 * No hardcoded Jan–Dec assumptions when config is present.
 */

import { formatLocalDateYYYYMMDD, parseLocalDateInput } from '@/app/utils/localDate';

export interface FiscalYearConfig {
  start: string;
  end?: string | null;
}

export const FISCAL_YEAR_CONFIG_UPDATED_EVENT = 'erp:fiscal-year-config-updated';

export function normalizeFiscalYearConfig(
  start?: string | null,
  end?: string | null,
): FiscalYearConfig | null {
  const s = start ? String(start).split('T')[0].trim() : '';
  if (!s) return null;
  const e = end ? String(end).split('T')[0].trim() : null;
  return { start: s, end: e || null };
}

type FiscalYearInput = string | Date | FiscalYearConfig | null | undefined;

function resolveConfig(input: FiscalYearInput): FiscalYearConfig | null {
  if (!input) return null;
  if (typeof input === 'object' && 'start' in input) {
    return normalizeFiscalYearConfig(input.start, input.end);
  }
  if (input instanceof Date) {
    return normalizeFiscalYearConfig(formatLocalDateYYYYMMDD(input), null);
  }
  return normalizeFiscalYearConfig(String(input), null);
}

function endDateFromTemplates(
  fyStartYear: number,
  startTemplate: Date,
  endTemplate: Date | null,
  fyMonth: number,
  fyDay: number,
): Date {
  if (!endTemplate) {
    const end = new Date(fyStartYear + 1, fyMonth, fyDay, 23, 59, 59, 999);
    end.setDate(end.getDate() - 1);
    return end;
  }
  const startYear = startTemplate.getFullYear();
  const endYearOffset = endTemplate.getFullYear() - startYear;
  const end = new Date(
    fyStartYear + endYearOffset,
    endTemplate.getMonth(),
    endTemplate.getDate(),
    23,
    59,
    59,
    999,
  );
  if (end < new Date(fyStartYear, fyMonth, fyDay)) {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

/**
 * @param financialYearInput - Fiscal config or legacy start-only string/date
 * @param anchorDate - Date used to locate the current financial year window
 */
export function getFinancialYearRange(
  financialYearInput: FiscalYearInput,
  anchorDate?: Date,
): { start: Date; end: Date } {
  const now = anchorDate ?? new Date();
  const config = resolveConfig(financialYearInput);
  const defaultStart = new Date(now.getFullYear(), 0, 1);

  if (!config) {
    return {
      start: new Date(defaultStart.getFullYear(), defaultStart.getMonth(), defaultStart.getDate()),
      end: new Date(defaultStart.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  const fyDate = parseLocalDateInput(config.start);
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

  let fyStartYear: number;
  if (currentMonth < fyMonth || (currentMonth === fyMonth && currentDay < fyDay)) {
    fyStartYear = currentYear - 1;
  } else {
    fyStartYear = currentYear;
  }

  const start = new Date(fyStartYear, fyMonth, fyDay, 0, 0, 0, 0);
  const endTemplate = config.end ? parseLocalDateInput(config.end) : null;
  const end = endDateFromTemplates(fyStartYear, fyDate, endTemplate, fyMonth, fyDay);

  return { start, end };
}

/** Prior financial year range (immediately before current FY). */
export function getLastFinancialYearRange(
  financialYearInput: FiscalYearInput,
  anchorDate?: Date,
): { start: Date; end: Date } {
  const current = getFinancialYearRange(financialYearInput, anchorDate);
  const lastEnd = new Date(current.start);
  lastEnd.setDate(lastEnd.getDate() - 1);
  lastEnd.setHours(23, 59, 59, 999);

  const lastStart = new Date(current.start);
  lastStart.setFullYear(lastStart.getFullYear() - 1);
  lastStart.setHours(0, 0, 0, 0);

  return { start: lastStart, end: lastEnd };
}

/** Get financial year label (e.g. "FY 2024-25"). */
export function getFinancialYearLabel(
  financialYearInput: FiscalYearInput,
  anchorDate?: Date,
): string {
  const { start, end } = getFinancialYearRange(financialYearInput, anchorDate);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  if (startYear === endYear) return `FY ${startYear}`;
  return `FY ${startYear}-${String(endYear).slice(-2)}`;
}

/** Human-readable range for filter chips (e.g. "1 Oct 2025 – 30 Sep 2026"). */
export function formatFinancialYearRangeLabel(
  financialYearInput: FiscalYearInput,
  anchorDate?: Date,
): string {
  const { start, end } = getFinancialYearRange(financialYearInput, anchorDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Human-readable range for last financial year. */
export function formatLastFinancialYearRangeLabel(
  financialYearInput: FiscalYearInput,
  anchorDate?: Date,
): string {
  const { start, end } = getLastFinancialYearRange(financialYearInput, anchorDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}
