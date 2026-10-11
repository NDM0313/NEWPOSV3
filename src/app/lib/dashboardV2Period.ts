/**
 * Dashboard V2 — date range helpers (prior period comparison + From-start clamp).
 */

import {
  clampWideDateRange,
  isStatementTimeoutMessage,
  wideDateRangeClampLimitation,
  WIDE_DATE_RANGE_MAX_SPAN_DAYS,
  type WideDateRangeClampResult,
} from './wideDateRangeClamp';

export interface DateRangeYmd {
  from: string;
  to: string;
}

/** @deprecated Prefer WIDE_DATE_RANGE_MAX_SPAN_DAYS from wideDateRangeClamp */
export const DASHBOARD_V2_MAX_SPAN_DAYS = WIDE_DATE_RANGE_MAX_SPAN_DAYS;

export type DashboardV2DateClampResult = WideDateRangeClampResult;

export function clampDashboardV2DateRange(
  dateFrom: string,
  dateTo: string,
): DashboardV2DateClampResult {
  return clampWideDateRange(dateFrom, dateTo);
}

export function dashboardV2ClampLimitation(clamp: DashboardV2DateClampResult): string {
  return wideDateRangeClampLimitation(clamp, 'Dashboard');
}

export function isDashboardRpcTimeoutMessage(message: string | null | undefined): boolean {
  return isStatementTimeoutMessage(message);
}

export function priorComparablePeriod(from: string, to: string): DateRangeYmd {
  const start = new Date(`${from.slice(0, 10)}T12:00:00`);
  const end = new Date(`${to.slice(0, 10)}T12:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (days - 1));
  return {
    from: priorStart.toISOString().slice(0, 10),
    to: priorEnd.toISOString().slice(0, 10),
  };
}

export function formatPeriodLabel(from: string, to: string): string {
  const f = from.slice(0, 10);
  const t = to.slice(0, 10);
  if (f === t) return f;
  return `${f} → ${t}`;
}

export function trendPercent(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
}
