/** Cash / bank / wallet (liquidity) detection — mobile mirror of web liquidityPaymentAccount. */

export type LiquidityAccountRef = {
  code?: string | null;
  name?: string | null;
  type?: string | null;
};

function accountCodeDigits(code: string | null | undefined): string {
  return String(code ?? '').trim().replace(/\D/g, '');
}

export function isLiquidityPaymentAccount(acc: LiquidityAccountRef | null | undefined): boolean {
  if (!acc) return false;
  const code = String(acc.code ?? '').trim();
  const digits = accountCodeDigits(code);
  const type = String(acc.type ?? '').toLowerCase();
  const name = String(acc.name ?? '').toLowerCase();
  if (['1000', '1010', '1020'].includes(code)) return true;
  if (digits.length >= 3 && digits.startsWith('102')) return true;
  if (['cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos'].includes(type)) return true;
  if (/cash|bank|mobile wallet|wallet|jazz|easypaisa|ndm|easy\s*paisa|mobicash|finja|upaisa|sadapay|nayapay/.test(name)) {
    return true;
  }
  return false;
}

/** Map liquidity account to payments.payment_method enum. */
export function paymentMethodForLiquidityAccount(acc: LiquidityAccountRef | null | undefined): string {
  if (!acc) return 'cash';
  const type = String(acc.type ?? '').toLowerCase();
  const code = String(acc.code ?? '').trim();
  if (type === 'bank' || type === 'card' || code === '1010') return 'bank';
  if (type === 'mobile_wallet' || type === 'wallet' || code === '1020' || accountCodeDigits(code).startsWith('102')) {
    return 'other';
  }
  return 'cash';
}
