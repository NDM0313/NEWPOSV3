/**
 * Shared wide date-range clamp for Dashboard / Day Book list fetches.
 * Does not change Global Filter meaning for Statements or other modules.
 */

/** Wider than this → fetch window is clamped (From start ≈ 10y times out). */
export const WIDE_DATE_RANGE_MAX_SPAN_DAYS = 366;

export type WideDateRangeClampResult = {
  dateFrom: string;
  dateTo: string;
  clamped: boolean;
  requestedDateFrom: string;
  requestedDateTo: string;
};

/**
 * Cap RPC/list range when Global Filter From start (or any span > 366 days)
 * would hit Postgres statement timeout.
 */
export function clampWideDateRange(
  dateFrom: string,
  dateTo: string,
): WideDateRangeClampResult {
  const from = dateFrom.slice(0, 10);
  const to = dateTo.slice(0, 10);
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      dateFrom: from,
      dateTo: to,
      clamped: false,
      requestedDateFrom: from,
      requestedDateTo: to,
    };
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  if (days <= WIDE_DATE_RANGE_MAX_SPAN_DAYS) {
    return {
      dateFrom: from,
      dateTo: to,
      clamped: false,
      requestedDateFrom: from,
      requestedDateTo: to,
    };
  }
  const yearStart = `${end.getFullYear()}-01-01`;
  return {
    dateFrom: yearStart,
    dateTo: to,
    clamped: true,
    requestedDateFrom: from,
    requestedDateTo: to,
  };
}

export function wideDateRangeClampLimitation(
  clamp: WideDateRangeClampResult,
  surface: string,
): string {
  return (
    `${surface} capped to ${clamp.dateFrom} → ${clamp.dateTo} ` +
    `(requested ${clamp.requestedDateFrom}… is too wide for this view).`
  );
}

export function isStatementTimeoutMessage(message: string | null | undefined): boolean {
  const m = String(message || '').toLowerCase();
  return m.includes('57014') || m.includes('statement timeout') || m.includes('canceling statement');
}
