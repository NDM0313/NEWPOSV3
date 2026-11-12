/**
 * Canonical merchandise Sales Revenue account resolution.
 * Prefer COA code 4000 (live/native); fallback 4100 only when 4000 is absent (import compatibility).
 * Does not rewrite historical JEs or deactivate accounts.
 */

export const CANONICAL_SALES_REVENUE_CODE = '4000';
export const FALLBACK_SALES_REVENUE_CODE = '4100';

export type CanonicalSalesRevenueAccount = {
  id: string;
  code: typeof CANONICAL_SALES_REVENUE_CODE | typeof FALLBACK_SALES_REVENUE_CODE;
};

export class CanonicalSalesRevenueAccountError extends Error {
  constructor(companyId: string) {
    super(
      `Sales Revenue account missing for company ${companyId}: expected active code ${CANONICAL_SALES_REVENUE_CODE} or fallback ${FALLBACK_SALES_REVENUE_CODE}.`,
    );
    this.name = 'CanonicalSalesRevenueAccountError';
  }
}

/** Pure resolver for tests — pass active accounts with { id, code }. */
export function resolveCanonicalSalesRevenueFromAccounts(
  accounts: Array<{ id: string; code: string }>,
): CanonicalSalesRevenueAccount {
  const by4000 = accounts.find((a) => a.code === CANONICAL_SALES_REVENUE_CODE);
  if (by4000?.id) return { id: by4000.id, code: CANONICAL_SALES_REVENUE_CODE };
  const by4100 = accounts.find((a) => a.code === FALLBACK_SALES_REVENUE_CODE);
  if (by4100?.id) return { id: by4100.id, code: FALLBACK_SALES_REVENUE_CODE };
  throw new CanonicalSalesRevenueAccountError('unknown');
}

/**
 * Resolve active company Sales Revenue account for new sale/return postings.
 * 4000 first, 4100 fallback, clear error if neither exists.
 */
export async function getCanonicalSalesRevenueAccount(
  companyId: string,
): Promise<CanonicalSalesRevenueAccount> {
  const { accountHelperService } = await import('@/app/services/accountHelperService');
  const primary = await accountHelperService.getAccountByCode(CANONICAL_SALES_REVENUE_CODE, companyId);
  if (primary?.id) return { id: primary.id, code: CANONICAL_SALES_REVENUE_CODE };

  const fallback = await accountHelperService.getAccountByCode(FALLBACK_SALES_REVENUE_CODE, companyId);
  if (fallback?.id) return { id: fallback.id, code: FALLBACK_SALES_REVENUE_CODE };

  throw new CanonicalSalesRevenueAccountError(companyId);
}

/** Returns account id only — convenience for callers that need nullable legacy behavior. */
export async function getCanonicalSalesRevenueAccountId(companyId: string): Promise<string> {
  return (await getCanonicalSalesRevenueAccount(companyId)).id;
}
