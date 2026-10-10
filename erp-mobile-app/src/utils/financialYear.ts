/**
 * Financial year utilities — mobile mirror of web financialYear.ts
 */

import { formatLocalDateYYYYMMDD, parseLocalDateInput } from '../utils/localDate';

export interface FiscalYearConfig {
  start: string;
  end?: string | null;
}

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
