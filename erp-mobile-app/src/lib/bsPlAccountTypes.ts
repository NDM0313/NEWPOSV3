/** Mirrors web bsPlUnifiedPreviewAccountTypes.ts */

export const COST_OF_PRODUCTION_CODES = new Set(['5000', '5010', '5100', '5110']);

export function accountTypeCategory(type: string): 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' {
  const t = (type || '').toLowerCase();
  if (['revenue', 'income'].some((x) => t.includes(x))) return 'revenue';
  if (['expense', 'cost of sales', 'cogs'].some((x) => t.includes(x))) return 'expense';
  if (['asset', 'cash', 'bank', 'mobile_wallet', 'receivable', 'inventory'].some((x) => t.includes(x))) {
    return 'asset';
  }
  if (['liability', 'payable'].some((x) => t.includes(x))) return 'liability';
  if (['equity'].some((x) => t.includes(x))) return 'equity';
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
