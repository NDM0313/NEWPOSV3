/** Mobile mirror of web canonical Sales Revenue resolution (4100 → 4000 fallback). */

export const CANONICAL_SALES_REVENUE_CODE = '4100';
export const FALLBACK_SALES_REVENUE_CODE = '4000';

export function resolveCanonicalSalesRevenueAccountIdFromMap(
  byCode: Map<string, string>,
): string | null {
  return byCode.get(CANONICAL_SALES_REVENUE_CODE) || byCode.get(FALLBACK_SALES_REVENUE_CODE) || null;
}
