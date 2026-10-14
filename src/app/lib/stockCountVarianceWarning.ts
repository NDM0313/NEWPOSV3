/**
 * Soft overage / shortage cues for physical count vs as-of baseline.
 * Never blocks submit/approve — operators may still accept after recheck.
 */

import { roundCountQty } from './stockCountMath';

export type StockCountVarianceKind = 'ok' | 'over' | 'short';

export type StockCountVarianceWarning = {
  kind: StockCountVarianceKind;
  variance: number;
  /** Compact badge text */
  badgeLabel: string | null;
  /** Longer hint for review sheets */
  hint: string | null;
  /** Tailwind-ish intent for Diff number color */
  diffTone: 'neutral' | 'over' | 'short';
};

const EPS = 0.0000001;

export function stockCountVarianceWarning(
  physicalQty: number | null | undefined,
  systemQtyBaseline: number | null | undefined,
  epsilon = EPS
): StockCountVarianceWarning {
  if (physicalQty == null || Number.isNaN(Number(physicalQty))) {
    return {
      kind: 'ok',
      variance: 0,
      badgeLabel: null,
      hint: null,
      diffTone: 'neutral',
    };
  }
  const physical = roundCountQty(Number(physicalQty) || 0);
  const baseline = roundCountQty(Number(systemQtyBaseline) || 0);
  const variance = roundCountQty(physical - baseline);

  if (Math.abs(variance) <= epsilon) {
    return {
      kind: 'ok',
      variance: 0,
      badgeLabel: null,
      hint: null,
      diffTone: 'neutral',
    };
  }

  if (variance > 0) {
    const x = roundCountQty(variance);
    return {
      kind: 'over',
      variance: x,
      badgeLabel: `Over +${x} — recheck`,
      hint: `Physical is ${x} more than as-of system. High chance of miscount — recheck this item before submit.`,
      diffTone: 'over',
    };
  }

  const x = roundCountQty(Math.abs(variance));
  return {
    kind: 'short',
    variance: roundCountQty(variance),
    badgeLabel: `Short −${x}`,
    hint: `Physical is ${x} less than as-of system.`,
    diffTone: 'short',
  };
}

export function summarizeVarianceWarnings(
  lines: Array<{
    physical_qty?: number | null;
    system_qty_baseline?: number | null;
    count_status?: string | null;
  }>
): { over: number; short: number; ok: number; overs: StockCountVarianceWarning[] } {
  let over = 0;
  let short = 0;
  let ok = 0;
  const overs: StockCountVarianceWarning[] = [];
  for (const l of lines) {
    if (l.count_status === 'uncounted' || l.physical_qty == null) continue;
    const w = stockCountVarianceWarning(l.physical_qty, l.system_qty_baseline);
    if (w.kind === 'over') {
      over += 1;
      overs.push(w);
    } else if (w.kind === 'short') short += 1;
    else ok += 1;
  }
  overs.sort((a, b) => b.variance - a.variance);
  return { over, short, ok, overs };
}
