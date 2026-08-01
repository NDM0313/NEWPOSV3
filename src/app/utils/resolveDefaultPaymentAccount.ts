/**
 * Resolve default payment account for Cash / Bank / Mobile Wallet pickers.
 * Priority: branch defaults → settings default_accounts (name) → COA code/name heuristics → first filtered.
 */

export type WebPaymentMethodLabel = 'Cash' | 'Bank' | 'Mobile Wallet' | string;

export interface WebPaymentAccountPick {
  id: string;
  name: string;
  code?: string | null;
  type?: string | null;
  accountType?: string | null;
}

export interface WebBranchPaymentDefaults {
  cashId?: string | null;
  bankId?: string | null;
}

export interface WebDefaultAccountsSettings {
  paymentMethods?: Array<{ method: string; defaultAccount?: string }>;
}

function normalizeMethod(method: WebPaymentMethodLabel): 'cash' | 'bank' | 'wallet' | 'other' {
  const m = String(method || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (m === 'cash') return 'cash';
  if (m === 'bank' || m === 'card') return 'bank';
  if (m === 'mobile_wallet' || m === 'mobilewallet' || m === 'wallet') return 'wallet';
  return 'other';
}

export function resolveDefaultPaymentAccountId(
  method: WebPaymentMethodLabel,
  filteredAccounts: WebPaymentAccountPick[],
  opts?: {
    branchDefaults?: WebBranchPaymentDefaults | null;
    defaultAccounts?: WebDefaultAccountsSettings | null;
  },
): string | null {
  if (!filteredAccounts.length) return null;
  const kind = normalizeMethod(method);
  const branch = opts?.branchDefaults ?? null;
  const settings = opts?.defaultAccounts ?? null;

  if (kind === 'cash' && branch?.cashId) {
    if (filteredAccounts.some((a) => a.id === branch.cashId)) return branch.cashId;
  }
  if (kind === 'bank' && branch?.bankId) {
    if (filteredAccounts.some((a) => a.id === branch.bankId)) return branch.bankId;
  }

  const settingsLabel =
    kind === 'cash' ? 'Cash' : kind === 'bank' ? 'Bank' : kind === 'wallet' ? 'Mobile Wallet' : String(method);
  const defaultPayment = settings?.paymentMethods?.find((p) => p.method === settingsLabel);
  if (defaultPayment?.defaultAccount) {
    const match = filteredAccounts.find((a) => a.name === defaultPayment.defaultAccount);
    if (match) return match.id;
  }

  if (kind === 'cash') {
    const byCode = filteredAccounts.find(
      (a) => a.code === '1000' || (a.name || '').toLowerCase() === 'cash',
    );
    if (byCode) return byCode.id;
  }
  if (kind === 'bank') {
    const byCode = filteredAccounts.find(
      (a) =>
        a.code === '1010' ||
        (a.name || '').toLowerCase() === 'bank' ||
        String(a.code || '').startsWith('101'),
    );
    if (byCode) return byCode.id;
  }
  if (kind === 'wallet') {
    const byCode = filteredAccounts.find(
      (a) =>
        a.code === '1020' ||
        (a.name || '').toLowerCase().includes('wallet') ||
        String(a.code || '').startsWith('102'),
    );
    if (byCode) return byCode.id;
  }

  return filteredAccounts[0]?.id ?? null;
}

/** Pick branch cash/bank defaults from SettingsContext branches list for the active branch. */
export function branchPaymentDefaultsFromSettings(
  branches: Array<{ id: string; cashAccountId?: string; bankAccountId?: string }>,
  branchId: string | null | undefined,
): WebBranchPaymentDefaults | null {
  if (!branchId || branchId === 'all') return null;
  const b = branches.find((x) => x.id === branchId);
  if (!b) return null;
  return {
    cashId: b.cashAccountId ?? null,
    bankId: b.bankAccountId ?? null,
  };
}
