/**
 * Liquidity account detection — mirrors src/app/lib/liquidityPaymentAccount.ts for unified ledger tests/docs.
 */

export type LiquidityAccountRef = {
  code?: string | null;
  name?: string | null;
  type?: string | null;
};

function accountCodeDigits(code: string | null | undefined): string {
  return String(code ?? '')
    .trim()
    .replace(/\D/g, '');
}

function isBlockedFromLiquidityNameHeuristic(type: string): boolean {
  if (
    type === 'liability' ||
    type === 'equity' ||
    type === 'revenue' ||
    type === 'income' ||
    type === 'expense' ||
    type === 'cogs' ||
    type === 'cost_of_goods_sold' ||
    type === 'inventory' ||
    type === 'receivable' ||
    type === 'payable'
  ) {
    return true;
  }
  return type.includes('liability') || type.includes('payable');
}

function allowsLiquidityNameHeuristic(type: string): boolean {
  if (isBlockedFromLiquidityNameHeuristic(type)) return false;
  return (
    type === '' ||
    type === 'asset' ||
    type === 'other_asset' ||
    type === 'current_asset' ||
    type === 'other_current_asset' ||
    type === 'cash' ||
    type === 'bank' ||
    type === 'mobile_wallet' ||
    type === 'wallet' ||
    type === 'card' ||
    type === 'pos'
  );
}

export function isUnifiedLiquidityAccount(acc: LiquidityAccountRef | null | undefined): boolean {
  if (!acc) return false;
  const code = String(acc.code ?? '').trim();
  const digits = accountCodeDigits(code);
  const type = String(acc.type ?? '').toLowerCase();
  const name = String(acc.name ?? '').toLowerCase();
  if (['1000', '1010', '1020'].includes(code)) return true;
  if (digits.length >= 4 && digits.startsWith('100')) return true;
  if (digits.length >= 3 && digits.startsWith('101')) return true;
  if (digits.length >= 3 && digits.startsWith('102')) return true;
  if (['cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos'].includes(type)) return true;
  if (/cash|bank|mobile wallet|wallet|jazz|easypaisa|ndm|easy\s*paisa|mobicash|finja|upaisa|sadapay|nayapay/.test(name)) {
    return allowsLiquidityNameHeuristic(type);
  }
  return false;
}

export type LiquidityKind = 'cash' | 'bank' | 'wallet' | 'all';

export function liquidityKindMatchesAccount(kind: LiquidityKind, acc: LiquidityAccountRef): boolean {
  if (kind === 'all') return isUnifiedLiquidityAccount(acc);
  const type = String(acc.type ?? '').toLowerCase();
  const code = String(acc.code ?? '').trim();
  const digits = accountCodeDigits(code);
  if (kind === 'bank') {
    return type === 'bank' || type === 'card' || code === '1010' || digits.startsWith('101');
  }
  if (kind === 'wallet') {
    return (
      type === 'mobile_wallet' ||
      type === 'wallet' ||
      code === '1020' ||
      digits.startsWith('102') ||
      /wallet|jazz|easypaisa|sadapay|nayapay/.test(String(acc.name ?? '').toLowerCase())
    );
  }
  // cash
  return type === 'cash' || code === '1000' || digits.startsWith('100');
}
