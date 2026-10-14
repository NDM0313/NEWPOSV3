/** Payment account method bucketing — aligned with web `src/app/lib/paymentAccountFilters.ts`. */

export type PaymentMethodLabel = 'Cash' | 'Bank' | 'Mobile Wallet';

export type PaymentAccountRef = {
  id: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  balance?: number;
  is_group?: boolean | null;
  isGroup?: boolean;
  is_active?: boolean | null;
};

export function normalizePaymentType(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function getAccountRole(acc: PaymentAccountRef): string {
  return normalizePaymentType(String(acc.type ?? ''));
}

function isBankSectionChildCode(code: string): boolean {
  const c = code.trim();
  if (!/^106[1-9]\d?$/.test(c)) return false;
  const n = Number.parseInt(c, 10);
  return n >= 1061 && n <= 1069;
}

function isActiveAccount(acc: PaymentAccountRef): boolean {
  if (acc.is_group === true || acc.isGroup === true) return false;
  if (acc.is_active === false) return false;
  return true;
}

/** Cash, Bank, or Mobile Wallet accounts for payment pickers. */
export function filterPaymentAccountsByMethod(
  accounts: PaymentAccountRef[],
  method: PaymentMethodLabel,
): PaymentAccountRef[] {
  const methodNorm = normalizePaymentType(method);
  return accounts.filter((acc) => {
    if (!isActiveAccount(acc)) return false;
    const role = getAccountRole(acc);
    const code = String(acc.code ?? '').trim();
    const name = (acc.name ?? '').toLowerCase();

    if (methodNorm === 'cash') {
      return (
        role === 'cash'
        || role === 'pos'
        || code === '1000'
        || code.startsWith('100')
        || name.includes('cash')
      );
    }
    if (methodNorm === 'bank') {
      return (
        role === 'bank'
        || code === '1010'
        || code.startsWith('101')
        || isBankSectionChildCode(code)
        || name.includes('bank')
      );
    }
    return (
      role === 'mobile_wallet'
      || role === 'wallet'
      || role === 'mobile wallet'
      || code === '1020'
      || code.startsWith('102')
      || name.includes('wallet')
    );
  });
}

export type MobilePaymentMethod = 'cash' | 'bank' | 'card' | 'wallet';

export function mobilePaymentMethodToLabel(method: MobilePaymentMethod): PaymentMethodLabel {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'bank':
    case 'card':
      return 'Bank';
    case 'wallet':
      return 'Mobile Wallet';
    default:
      return 'Cash';
  }
}
