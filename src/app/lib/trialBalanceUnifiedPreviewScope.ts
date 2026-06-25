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
