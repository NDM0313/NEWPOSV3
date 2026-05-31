import type { Account } from '@/app/services/accountService';

export type PaymentMethodLabel = 'Cash' | 'Bank' | 'Mobile Wallet';

export function normalizePaymentType(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function getAccountRole(acc: Account): string {
  const raw = (acc as Account & { account_role?: string; accountType?: string }).account_role
    ?? acc.type
    ?? (acc as Account & { accountType?: string }).accountType
    ?? '';
  return normalizePaymentType(String(raw));
}

function isActiveAccount(acc: Account): boolean {
  if (acc.is_group) return false;
  if (acc.is_active === false) return false;
  if ((acc as Account & { isActive?: boolean }).isActive === false) return false;
  return true;
}

/** Cash, Bank, or Mobile Wallet accounts for payment default pickers. */
export function filterPaymentAccountsByMethod(
  accounts: Account[],
  method: PaymentMethodLabel,
): Account[] {
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
      return role === 'bank' || code === '1010' || code.startsWith('101') || name.includes('bank');
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

export function findDefaultPaymentAccount(
  accounts: Account[],
  method: PaymentMethodLabel,
): Account | undefined {
  const filtered = filterPaymentAccountsByMethod(accounts, method);
  const codeHint = method === 'Cash' ? '1000' : method === 'Bank' ? '1010' : '1020';
  return filtered.find((a) => String(a.code ?? '').trim() === codeHint) ?? filtered[0];
}

export function formatPaymentAccountOptionLabel(acc: Account): string {
  const balance = Number(acc.balance ?? acc.current_balance ?? 0);
  const codePart = acc.code ? ` (${acc.code})` : '';
  return `${acc.name}${codePart} • GL (journal): Rs ${balance.toLocaleString()}`;
}
