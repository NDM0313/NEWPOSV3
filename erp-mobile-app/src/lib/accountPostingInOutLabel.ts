/**
 * IN/OUT labels for debit/credit account pickers — mobile mirror of web accountPostingInOutLabel.
 */

import { isLiquidityPaymentAccount } from './liquidityPaymentAccount';

export type AccountInOutRef = {
  code?: string | null;
  name?: string | null;
  type?: string | null;
};

export type PostingSide = 'debit' | 'credit';
export type InOutDirection = 'IN' | 'OUT';

function accountCodeDigits(code: string | null | undefined): string {
  return String(code ?? '').trim().replace(/\D/g, '');
}

export function getAccountNormalBalanceSide(account: AccountInOutRef): 'debit' | 'credit' {
  const type = String(account.type ?? '').toLowerCase();
  const digits = accountCodeDigits(account.code);

  if (type.includes('expense') || type.includes('cost') || type === 'cogs') return 'debit';
  if (type.includes('revenue') || type.includes('income') || type === 'sales') return 'credit';
  if (type === 'liability' || type === 'equity') return 'credit';
  if (type === 'asset') return 'debit';
  if (['cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos'].includes(type)) return 'debit';

  if (isLiquidityPaymentAccount(account)) return 'debit';

  if (digits.startsWith('11') || digits === '1100' || digits.startsWith('12')) return 'debit';
  if (digits.startsWith('20') || digits.startsWith('21') || digits.startsWith('22')) return 'credit';
  if (digits.startsWith('3')) return 'credit';
  if (digits.startsWith('4') || digits.startsWith('5')) return 'debit';

  const name = String(account.name ?? '').toLowerCase();
  if (/receivable|inventory|asset|expense|cogs|cash|bank|wallet/.test(name)) return 'debit';
  if (/payable|revenue|income|equity|capital|sales/.test(name)) return 'credit';

  return 'debit';
}

export function getPostingInOutForSide(
  account: AccountInOutRef,
  postingSide: PostingSide,
  forceInOut?: InOutDirection,
): InOutDirection {
  if (forceInOut) return forceInOut;
  const normal = getAccountNormalBalanceSide(account);
  if (postingSide === 'debit') {
    return normal === 'debit' ? 'IN' : 'OUT';
  }
  return normal === 'debit' ? 'OUT' : 'IN';
}

export function getPaymentLiquidityPostingSide(isReceipt: boolean): PostingSide {
  return isReceipt ? 'debit' : 'credit';
}

export type PostingFieldLabelOpts = {
  drCr?: 'Dr' | 'Cr';
  inOut?: InOutDirection | 'IN/OUT';
};

export function formatPostingFieldLabel(base: string, opts: PostingFieldLabelOpts = {}): string {
  const parts: string[] = [];
  if (opts.drCr) parts.push(opts.drCr);
  if (opts.inOut) parts.push(opts.inOut);
  if (parts.length === 0) return base;
  return `${base} (${parts.join(' · ')})`;
}

export const POSTING_FIELD_TITLES = {
  transferFrom: formatPostingFieldLabel('Transfer From', { inOut: 'OUT' }),
  transferTo: formatPostingFieldLabel('Transfer To', { inOut: 'IN' }),
  journalDebit: formatPostingFieldLabel('Select Debit Account', { drCr: 'Dr', inOut: 'IN/OUT' }),
  journalCredit: formatPostingFieldLabel('Select Credit Account', { drCr: 'Cr', inOut: 'IN/OUT' }),
  paymentReceipt: formatPostingFieldLabel('Payment account', { drCr: 'Dr', inOut: 'IN' }),
  paymentOut: formatPostingFieldLabel('Payment account', { drCr: 'Cr', inOut: 'OUT' }),
  selectAccountIn: formatPostingFieldLabel('Select account', { inOut: 'IN' }),
  selectAccountOut: formatPostingFieldLabel('Select account', { inOut: 'OUT' }),
} as const;

export function formatAccountSelectOptionLabel(
  account: AccountInOutRef & { name: string },
  opts: {
    balance?: number | null;
    formatBalance?: (n: number) => string;
    postingSide?: PostingSide;
    forceInOut?: InOutDirection;
    includeGlBalance?: boolean;
  } = {},
): string {
  const inOut = getPostingInOutForSide(account, opts.postingSide ?? 'debit', opts.forceInOut);
  const code = String(account.code ?? '').trim();
  const namePart = code ? `${code} – ${account.name}` : account.name;
  let label = `${namePart} • ${inOut}`;
  if (opts.includeGlBalance && opts.balance != null && opts.formatBalance) {
    label += ` • GL: ${opts.formatBalance(opts.balance)}`;
  }
  return label;
}

export function accountInOutBadgeLabel(
  account: AccountInOutRef,
  postingSide: PostingSide,
  forceInOut?: InOutDirection,
): InOutDirection {
  return getPostingInOutForSide(account, postingSide, forceInOut);
}
