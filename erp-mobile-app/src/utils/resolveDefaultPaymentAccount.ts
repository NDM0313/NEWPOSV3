import type { DefaultAccountsSettings } from '../api/settings';

type PaymentMethod = 'cash' | 'bank' | 'card' | 'wallet';

export interface PaymentAccountPick {
  id: string;
  name: string;
  type: string;
  balance: number;
  code: string;
  isDefaultCash?: boolean;
  isDefaultBank?: boolean;
}

export interface BranchPaymentDefaults {
  cashId: string | null;
  bankId: string | null;
}

function methodToSettingsLabel(method: PaymentMethod): string {
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

/** Mirror web UnifiedPaymentDialog default account resolution order. */
export function resolveDefaultPaymentAccountId(
  method: PaymentMethod,
  filteredAccounts: PaymentAccountPick[],
  defaultAccounts: DefaultAccountsSettings | null,
  branchDefaults: BranchPaymentDefaults | null,
): string | null {
  if (filteredAccounts.length === 0) return null;

  if (branchDefaults) {
    if (method === 'cash' && branchDefaults.cashId) {
      if (filteredAccounts.some((a) => a.id === branchDefaults.cashId)) return branchDefaults.cashId;
    }
    if ((method === 'bank' || method === 'card') && branchDefaults.bankId) {
      if (filteredAccounts.some((a) => a.id === branchDefaults.bankId)) return branchDefaults.bankId;
    }
  }

  const settingsLabel = methodToSettingsLabel(method);
  const defaultPayment = defaultAccounts?.paymentMethods?.find((p) => p.method === settingsLabel);
  if (defaultPayment?.defaultAccount) {
    const match = filteredAccounts.find((a) => a.name === defaultPayment.defaultAccount);
    if (match) return match.id;
  }

  if (method === 'cash') {
    const flagged = filteredAccounts.find((a) => a.isDefaultCash);
    if (flagged) return flagged.id;
    const byCode = filteredAccounts.find(
      (a) => a.code === '1000' || a.name.toLowerCase() === 'cash',
    );
    if (byCode) return byCode.id;
  }

  if (method === 'bank' || method === 'card') {
    const flagged = filteredAccounts.find((a) => a.isDefaultBank);
    if (flagged) return flagged.id;
    const byCode = filteredAccounts.find(
      (a) => a.code === '1010' || a.name.toLowerCase() === 'bank' || a.code.startsWith('101'),
    );
    if (byCode) return byCode.id;
  }

  if (method === 'wallet') {
    const byCode = filteredAccounts.find(
      (a) =>
        a.code === '1020' ||
        a.name.toLowerCase().includes('wallet') ||
        a.code.startsWith('102'),
    );
    if (byCode) return byCode.id;
  }

  return filteredAccounts[0]?.id ?? null;
}

/** Expense form: try Cash default, then Bank, then Wallet; fall back to first account. */
export function resolveDefaultExpensePaymentAccountId(
  accounts: PaymentAccountPick[],
  defaultAccounts: DefaultAccountsSettings | null,
  branchDefaults: BranchPaymentDefaults | null,
): string | null {
  if (accounts.length === 0) return null;
  for (const method of ['cash', 'bank', 'wallet'] as const) {
    const id = resolveDefaultPaymentAccountId(method, accounts, defaultAccounts, branchDefaults);
    if (id) return id;
  }
  return accounts[0]?.id ?? null;
}
