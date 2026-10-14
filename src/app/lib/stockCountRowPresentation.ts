/**
 * Count list row presentation — what belongs on the card vs History/Review.
 * Pure helpers; no I/O.
 */

export type CountRowPresentation = {
  /** Live movement balance label on the card */
  currentStockLabel: string;
  /** As-of posting baseline label (historical closing qty) */
  systemAsOfLabel: string;
  physicalLabel: string;
  differenceLabel: string;
  /** Difference only when a physical count is confirmed (incl. zero) */
  showDifference: boolean;
  /**
   * Mid-count drift only (live now vs live_qty_at_capture).
   * Never derived from live vs as-of baseline.
   */
  showStockChangedBadge: boolean;
  stockChangedBadgeLabel: string;
  /** Uncounted shows em dash, not numeric 0 */
  physicalDisplayIsBlank: boolean;
  isConfirmedZero: boolean;
};

export function countRowPresentation(opts: {
  physicalQty: number | null | undefined;
  countStatus?: string | null;
  /** Explicit mid-count drift flag from enrich (live capture vs live now) */
  baselineDrifted?: boolean | null;
  currentSystemQty?: number | null;
  systemQtyBaseline?: number | null;
  asOfDate?: string | null;
}): CountRowPresentation {
  const uncounted =
    opts.countStatus === 'uncounted' ||
    opts.physicalQty == null ||
    Number.isNaN(Number(opts.physicalQty));
  const confirmedZero =
    !uncounted && (opts.countStatus === 'counted_zero' || Number(opts.physicalQty) === 0);
  const asOf = opts.asOfDate ? String(opts.asOfDate).slice(0, 10) : null;

  return {
    currentStockLabel: 'Live now',
    systemAsOfLabel: asOf ? `System (as of ${asOf})` : 'System (as of)',
    physicalLabel: 'Physical Count',
    differenceLabel: 'Difference',
    showDifference: !uncounted,
    showStockChangedBadge: opts.baselineDrifted === true,
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
