/**
 * Trial Balance preview RPC scope helpers (Phase 2.5).
 */

export function normalizeTrialBalancePreviewBranch(branchId?: string): string | null {
  if (!branchId || branchId === 'all') return null;
  return branchId;
}

/** Admin compare parity: unified TB uses as-of end date, not period start. */
export function trialBalancePreviewAsOfDate(endDate: string): string {
  return endDate;
}

/** Legacy TB for unified as-of compare must be cumulative through as-of, not period-sliced. */
export const LEGACY_TRIAL_BALANCE_COMPARE_FROM = '1900-01-01';

export function legacyTrialBalanceCompareDateFrom(_periodFrom?: string | null): string {
  return LEGACY_TRIAL_BALANCE_COMPARE_FROM;
}

export function buildTrialBalancePreviewRpcScope(params: {
  startDate: string;
  endDate: string;
  branchId?: string;
}) {
  return {
    branchId: normalizeTrialBalancePreviewBranch(params.branchId),
    asOfDate: trialBalancePreviewAsOfDate(params.endDate),
    legacyPeriodFrom: params.startDate,
    legacyPeriodTo: params.endDate,
  };
}
