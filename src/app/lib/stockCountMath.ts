/**
 * Pure helpers for Physical Stock Count / Reconciliation.
 * Used by web UI now; reusable by Capacitor later. No I/O.
 */

export type StockCountLineStatus = 'uncounted' | 'counted_zero' | 'counted_qty';

export type StockCountEventType =
  | 'increment'
  | 'decrement'
  | 'set'
  | 'confirm_zero'
  | 'start_recount'
  | 'note';

/** Uncounted = null physical; counted zero = 0; counted qty = positive (or any entered number). */
export function classifyCountStatus(physicalQty: number | null | undefined): StockCountLineStatus {
  if (physicalQty == null || Number.isNaN(Number(physicalQty))) return 'uncounted';
  const n = Number(physicalQty);
  if (n === 0) return 'counted_zero';
  return 'counted_qty';
}

/** Difference vs saved baseline. Uncounted lines have no difference. */
export function computeDifference(
  physicalQty: number | null | undefined,
  systemQtyBaseline: number
): number | null {
  if (physicalQty == null || Number.isNaN(Number(physicalQty))) return null;
  return roundCountQty(Number(physicalQty) - Number(systemQtyBaseline || 0));
}

/**
 * Core posting rule: only the variance from the saved baseline is adjusted.
 * Post-baseline sales/purchases remain intact because we apply delta, not absolute set.
 */
export function computeAdjustmentDelta(
  acceptedPhysicalCount: number,
  systemQtyAtCountBaseline: number
): number {
  return roundCountQty(Number(acceptedPhysicalCount) - Number(systemQtyAtCountBaseline || 0));
}

export function roundCountQty(n: number): number {
  return Math.round(Number(n) * 10000) / 10000;
}

/** +1 accumulate; never invent a prefills from system qty. */
export function applyIncrement(currentPhysical: number | null | undefined, step = 1): number {
  const base = currentPhysical == null ? 0 : Number(currentPhysical);
  return roundCountQty(Math.max(0, base) + Math.abs(step));
}

/** -1 correct mistaken increment; floor at 0; if was uncounted, stay uncounted. */
export function applyDecrement(
  currentPhysical: number | null | undefined,
  step = 1
): number | null {
  if (currentPhysical == null) return null;
  return roundCountQty(Math.max(0, Number(currentPhysical) - Math.abs(step)));
}

export function applyDirectEntry(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Physical count must be a non-negative number');
  }
  return roundCountQty(n);
}

export function confirmZero(): number {
  return 0;
}

/**
 * Formal recount: new blank pass replaces prior physical (does not add passes).
 * Prior quantity is retained only for audit via events, not in the active physical field.
 */
export function startFormalRecount(priorPhysical: number | null | undefined): {
  nextPassNumber: (currentPass: number) => number;
  physicalQty: null;
  priorPhysical: number | null;
} {
  return {
    nextPassNumber: (currentPass: number) => Math.max(1, Number(currentPass) || 1) + 1,
    physicalQty: null,
    priorPhysical: priorPhysical == null ? null : Number(priorPhysical),
  };
}

export function isZeroVariance(delta: number): boolean {
  return Math.abs(roundCountQty(delta)) < 0.0000001;
}
