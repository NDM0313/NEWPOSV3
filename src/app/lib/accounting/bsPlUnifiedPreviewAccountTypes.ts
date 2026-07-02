/**
 * Phase 3A — account type helpers mirrored from accountingReportsService (preview-only).
 * Do not change legacy COGS / section rules without finance sign-off.
 */

/** PF-06: Production/studio/shipping — P&L Cost of Sales. Excludes 5200/5300. */
export const COST_OF_PRODUCTION_CODES = new Set(['5000', '5010', '5100', '5110']);

const REVENUE_TYPES = ['revenue', 'income'];
const EXPENSE_TYPES = ['expense', 'cost of sales', 'cogs'];
const ASSET_TYPES = ['asset', 'cash', 'bank', 'mobile_wallet', 'receivable', 'inventory'];
const LIABILITY_TYPES = ['liability', 'payable'];
const EQUITY_TYPES = ['equity'];

export function accountTypeCategory(type: string): 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' {
  const t = (type || '').toLowerCase();
  if (REVENUE_TYPES.some((x) => t.includes(x))) return 'revenue';
  if (EXPENSE_TYPES.some((x) => t.includes(x))) return 'expense';
  if (ASSET_TYPES.some((x) => t.includes(x))) return 'asset';
  if (LIABILITY_TYPES.some((x) => t.includes(x))) return 'liability';
  if (EQUITY_TYPES.some((x) => t.includes(x))) return 'equity';
  return 'expense';
}

export function isCostOfProductionAccount(code: string | undefined, accountType: string): boolean {
  const codeTrim = String(code ?? '').trim();
  const typeLower = (accountType || '').toLowerCase();
  return (
    COST_OF_PRODUCTION_CODES.has(codeTrim) ||
    typeLower.includes('cogs') ||
    typeLower.includes('cost')
  );
}
