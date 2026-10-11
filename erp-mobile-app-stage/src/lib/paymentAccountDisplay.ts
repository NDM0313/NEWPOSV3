export interface PaymentAccountRef {
  code?: string | null;
  name?: string | null;
  type?: string | null;
}

function formatEnumFallback(method: string | null | undefined): string {
  const m = String(method || 'cash').toLowerCase().trim();
  if (m === 'bank' || m === 'card') return 'Bank';
  if (m === 'other' || m === 'wallet' || m === 'mobile_wallet') return 'Wallet / Other';
  if (m === 'cash') return 'Cash';
  if (!m) return '—';
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Display label for payment GL account (code — name), with enum fallback. */
export function formatPaymentAccountLabel(params: {
  paymentAccount?: PaymentAccountRef | null;
  paymentMethod?: string | null;
  paymentMethodNameHint?: string | null;
}): string {
  const acc = params.paymentAccount;
  const code = String(acc?.code ?? '').trim();
  const name = String(acc?.name ?? '').trim();
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  if (code) return code;

  const hint = String(params.paymentMethodNameHint ?? '').trim();
  if (hint && !['cash', 'bank', 'card', 'other', 'wallet', 'mobile_wallet'].includes(hint.toLowerCase())) {
    return hint;
  }

  return formatEnumFallback(params.paymentMethod);
}
