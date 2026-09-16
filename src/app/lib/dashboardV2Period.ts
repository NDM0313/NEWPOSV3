/**
 * Dashboard V2 — date range helpers (prior period comparison).
 */

export interface DateRangeYmd {
  from: string;
  to: string;
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
