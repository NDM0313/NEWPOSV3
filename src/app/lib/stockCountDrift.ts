/**
 * Baseline vs current system stock — pure helpers.
 * Posting still uses physical − baseline (preserves post-baseline movements).
 * UI must never label baseline as "current stock" when they differ.
 */

import { computeAdjustmentDelta, isZeroVariance, roundCountQty } from './stockCountMath';

export type DriftMovementLike = {
  id?: string;
  quantity?: number | null;
  created_at?: string | null;
  movement_type?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
};

export type BaselineCurrentSnapshot = {
  countBaseline: number;
  currentSystemStock: number;
  /** current − baseline (movement sum after baseline capture, if sources agree) */
  movementSinceBaseline: number;
  drifted: boolean;
};

export function compareBaselineToCurrent(
  countBaseline: number,
  currentSystemStock: number,
  epsilon = 0.0000001
): BaselineCurrentSnapshot {
  const baseline = roundCountQty(Number(countBaseline) || 0);
  const current = roundCountQty(Number(currentSystemStock) || 0);
  const movementSinceBaseline = roundCountQty(current - baseline);
  return {
    countBaseline: baseline,
    currentSystemStock: current,
    movementSinceBaseline,
    drifted: Math.abs(movementSinceBaseline) > epsilon,
  };
}

/** Sum signed quantities of movements with created_at strictly after baselineAt. */
export function sumMovementsAfterBaseline(
  movements: DriftMovementLike[],
  baselineAt: string | null | undefined
): number {
  if (!baselineAt) return 0;
  const t0 = new Date(baselineAt).getTime();
  if (!Number.isFinite(t0)) return 0;
  let sum = 0;
  for (const m of movements) {
    const t = new Date(m.created_at || 0).getTime();
    if (!Number.isFinite(t) || t <= t0) continue;
    sum += Number(m.quantity) || 0;
  }
  return roundCountQty(sum);
}

export function movementsAfterBaseline(
  movements: DriftMovementLike[],
  baselineAt: string | null | undefined
): DriftMovementLike[] {
  if (!baselineAt) return [];
  const t0 = new Date(baselineAt).getTime();
  if (!Number.isFinite(t0)) return [];
  return movements
    .filter((m) => {
      const t = new Date(m.created_at || 0).getTime();
      return Number.isFinite(t) && t > t0;
    })
    .sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
}

/**
 * Example case: baseline 3, ledger current 8 → both visible; variance posts vs baseline.
 * adjustment = physical − 3 (not physical − 8).
 */
export function explainBaseline3Current8Case(physicalCount: number | null): {
  snapshot: BaselineCurrentSnapshot;
  differenceVsBaseline: number | null;
  differenceVsCurrent: number | null;
  postingDeltaIfAccepted: number | null;
  labels: { current: string; baseline: string; variance: string };
} {
  const snapshot = compareBaselineToCurrent(3, 8);
  const differenceVsBaseline =
    physicalCount == null ? null : roundCountQty(physicalCount - snapshot.countBaseline);
  const differenceVsCurrent =
    physicalCount == null ? null : roundCountQty(physicalCount - snapshot.currentSystemStock);
  return {
    snapshot,
    differenceVsBaseline,
    differenceVsCurrent,
    postingDeltaIfAccepted:
      physicalCount == null
        ? null
        : computeAdjustmentDelta(physicalCount, snapshot.countBaseline),
    labels: {
      current: 'Current System Stock',
      baseline: 'Count Baseline',
      variance: 'Difference vs Count Baseline (posting basis)',
    },
  };
}

/**
 * Posting safety: drifted + already counted without recount/ack → block.
 * Uncounted lines with drift are OK (user still counting / can recount first).
 */
export function shouldBlockPostForDrift(opts: {
  drifted: boolean;
  countStatus: string;
  driftAcknowledged?: boolean;
  recountedAfterDrift?: boolean;
}): { block: boolean; reason: string | null } {
  if (!opts.drifted) return { block: false, reason: null };
  if (opts.countStatus === 'uncounted') return { block: false, reason: null };
  if (opts.recountedAfterDrift || opts.driftAcknowledged) {
    return { block: false, reason: null };
  }
  return {
    block: true,
    reason:
      'Stock moved after this line’s count baseline. Recount with a fresh baseline, or explicitly acknowledge posting against the old baseline (physical − baseline).',
  };
}

/** Zero variance vs baseline creates no movement — even if current ≠ baseline. */
export function postingCreatesMovement(
  physicalQty: number,
  countBaseline: number
): boolean {
  return !isZeroVariance(computeAdjustmentDelta(physicalQty, countBaseline));
}

/**
 * Running balance from movements (Full Stock Ledger style: start 0, sum all signed qty).
 * Same calculator the count history must use for Current System Stock.
 */
export function ledgerRunningBalanceFromMovements(
  movements: Array<{ quantity?: number | null }>
): number {
  let bal = 0;
  for (const m of movements) {
    bal += Number(m.quantity) || 0;
  }
  return roundCountQty(bal);
}
