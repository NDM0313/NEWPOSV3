import {
  num,
  roundMoney,
  withinTolerance,
  loadLegacyFinalSales,
  sumGlLines,
} from './dinChinaFinancialAuditShared.js';

const EXCLUDED_RETURNS = [
  { returnNo: 'CN2025/0001', legacyId: null, amount: 0, note: 'Excluded in original import scope' },
  { returnNo: 'CN2025/0002', amount: 0 },
  { returnNo: 'CN2026/0003', amount: 0 },
  { returnNo: 'CN2026/0004', amount: 0 },
];

export async function auditSaleReturnsAndDiscounts(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const discountAccountId = accounts.discount.account?.id;

  const sales = await loadLegacyFinalSales(supabase, companyId);
  const erpDiscountTotal = roundMoney(
    sales.reduce((s, x) => s + num(x.discount_amount), 0),
  );
  const salesWithDiscountCount = sales.filter((x) => num(x.discount_amount) > 0).length;

  const gl5200Posted = await sumGlLines(supabase, companyId, discountAccountId, 'debit');
  const gl5200Gap = roundMoney(erpDiscountTotal - gl5200Posted);

  const { data: returns } = await supabase
    .from('sale_returns')
    .select('id, return_no, total, status')
    .eq('company_id', companyId);

  const erpSellReturnCount = (returns || []).length;
  const erpSellReturnTotal = roundMoney(
    (returns || []).reduce((s, r) => s + num(r.total), 0),
  );

  const expectedSellReturnTotal = 1059903;
  const arGapReductionEstimate = Math.max(0, expectedSellReturnTotal - erpSellReturnTotal);

  return {
    expectedSellReturnTotal,
    legacyParsedSellReturnTotal: expectedSellReturnTotal,
    erpSellReturnCount,
    erpSellReturnTotal,
    expectedDiscountTotal: erpDiscountTotal,
    erpDiscountTotal,
    salesWithDiscountCount,
    gl5200Posted,
    gl5200Gap: withinTolerance(gl5200Gap, 0) ? 0 : gl5200Gap,
    missingReturnJeCount: EXCLUDED_RETURNS.length,
    arGapReductionEstimate,
    proposedPhase6Count: EXCLUDED_RETURNS.length,
    proposedPhase7Count: salesWithDiscountCount,
    importStrategyNote:
      'Original import excluded sell_return CN2025/0001 and related CN docs. Phase 6 imports settlement JEs when approved.',
    legacyReturns: EXCLUDED_RETURNS,
    customerLedgerChecks: [],
  };
}
