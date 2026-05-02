import type { StudioOrder } from './StudioDashboard';

export const STUDIO_PROFIT_PCT_STORAGE_PREFIX = 'studio:profitPct:';

/** Sum of internal (production) costs across all stages — customer/pricing neutral. */
export function getTotalInternalProductionCost(order: StudioOrder): number {
  return order.stages.reduce((sum, stage) => sum + stage.internalCost, 0);
}

export function computeStudioCustomerPricing(order: StudioOrder, profitPct: number) {
  const totalInternalCost = getTotalInternalProductionCost(order);
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

export function writeStudioProfitPctToStorage(orderId: string, profitPct: number): void {
  if (!Number.isFinite(profitPct)) return;
  try {
    localStorage.setItem(`${STUDIO_PROFIT_PCT_STORAGE_PREFIX}${orderId}`, String(profitPct));
  } catch {
    /* ignore */
  }
}
