/**
 * Count list row presentation — what belongs on the card vs History/Review.
 * Pure helpers; no I/O.
 */

export type CountRowPresentation = {
  /** Live movement balance label on the card */
  currentStockLabel: string;
  physicalLabel: string;
  differenceLabel: string;
  /** Difference only when a physical count is confirmed (incl. zero) */
  showDifference: boolean;
  /** Compact badge only — never long baseline essays on the card */
  showStockChangedBadge: boolean;
  stockChangedBadgeLabel: string;
  /** Uncounted shows em dash, not numeric 0 */
  physicalDisplayIsBlank: boolean;
  isConfirmedZero: boolean;
};

export function countRowPresentation(opts: {
  physicalQty: number | null | undefined;
  countStatus?: string | null;
  baselineDrifted?: boolean | null;
  currentSystemQty?: number | null;
  systemQtyBaseline?: number | null;
}): CountRowPresentation {
  const uncounted =
    opts.countStatus === 'uncounted' ||
    opts.physicalQty == null ||
    Number.isNaN(Number(opts.physicalQty));
  const confirmedZero =
    !uncounted && (opts.countStatus === 'counted_zero' || Number(opts.physicalQty) === 0);
  const drifted =
    opts.baselineDrifted === true ||
    (opts.currentSystemQty != null &&
      opts.systemQtyBaseline != null &&
      Math.abs(Number(opts.currentSystemQty) - Number(opts.systemQtyBaseline)) > 0.0000001);

  return {
    currentStockLabel: 'Current Stock',
    physicalLabel: 'Physical Count',
    differenceLabel: 'Difference',
    showDifference: !uncounted,
    showStockChangedBadge: drifted,
    stockChangedBadgeLabel: 'Stock changed',
    physicalDisplayIsBlank: uncounted,
    isConfirmedZero: confirmedZero,
  };
}

/** True when long baseline/drift copy must not appear on the count card. */
export function countCardOmitsBaselineEssay(): boolean {
  return true;
}

/** Mobile workflow order for the active count session (documentation + tests). */
export const MOBILE_COUNT_WORKFLOW_ORDER = [
  'session_branch',
  'search',
  'progress_summary',
  'product_cards',
  'review_post',
] as const;

/** Minimum touch target in CSS pixels for primary count controls. */
export const COUNT_TOUCH_TARGET_PX = 44;
