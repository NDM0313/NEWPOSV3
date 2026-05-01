import type { StudioOrder } from './StudioDashboard';

export const STUDIO_PROFIT_PCT_STORAGE_PREFIX = 'studio:profitPct:';

export function computeStudioCustomerPricing(order: StudioOrder, profitPct: number) {
  const totalInternalCost = order.stages.reduce((sum, stage) => sum + stage.internalCost, 0);
  const totalStageCustomerCharge = order.stages.reduce((sum, stage) => sum + stage.customerCharge, 0);
  const suggestedCustomerCharge = Math.round(totalInternalCost * (1 + profitPct / 100));
  /** Markup is the floor; per-stage customer sums can only raise the bill, not lower it. */
  const effectiveCustomerCharge = Math.max(suggestedCustomerCharge, totalStageCustomerCharge);
  return {
    totalInternalCost,
    totalStageCustomerCharge,
    suggestedCustomerCharge,
    effectiveCustomerCharge,
  };
}

/** Same key as StudioOrderDetail local profit input. */
export function readStudioProfitPctFromStorage(orderId: string): number | null {
  try {
    const s = localStorage.getItem(`${STUDIO_PROFIT_PCT_STORAGE_PREFIX}${orderId}`);
    if (s === null) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
