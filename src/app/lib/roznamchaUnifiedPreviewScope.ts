/**
 * Roznamcha preview RPC scope helpers (Phase 2.6).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { AccountFilter } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

export function normalizeRoznamchaPreviewBranch(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  return branchId;
}

export function accountFilterToLiquidity(
  accountFilter: AccountFilter
): 'cash' | 'bank' | 'wallet' | 'all' {
  return accountFilter;
}

export function defaultUnifiedBasisForRoznamcha(includeVoidedReversed: boolean): UnifiedLedgerBasis {
  return includeVoidedReversed ? 'audit_full_history' : 'effective_party';
}

export function buildRoznamchaPreviewRpcScope(params: {
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter: AccountFilter;
  includeVoidedReversed: boolean;
}) {
  return {
    branchId: normalizeRoznamchaPreviewBranch(params.branchId),
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    liquidity: accountFilterToLiquidity(params.accountFilter),
    basis: defaultUnifiedBasisForRoznamcha(params.includeVoidedReversed),
  };
}

export function filterUnifiedRowsByPaymentAccount(
  rows: UnifiedLedgerRow[],
  paymentLedgerAccountId: string | null,
  paymentAccountOptions: Array<{ id: string; label: string }>
): UnifiedLedgerRow[] {
  const id = paymentLedgerAccountId?.trim();
  if (!id) return rows;
  const opt = paymentAccountOptions.find((o) => o.id === id);
  // Fail closed: selected id with no option must not leak the full (unfiltered) stream.
  if (!opt) return [];
  const labelLower = opt.label.toLowerCase();
  const codePart = opt.label.split(' — ')[0]?.trim().toLowerCase() || '';
  const namePart = opt.label.includes(' — ')
    ? opt.label.split(' — ').slice(1).join(' — ').trim().toLowerCase()
    : '';
  return rows.filter((r) => {
    const code = (r.accountCode || '').trim().toLowerCase();
    const name = (r.accountName || '').trim().toLowerCase();
    if (code && codePart && code === codePart) return true;
    if (name && namePart && name === namePart) return true;
    if (name && labelLower.includes(name)) return true;
    if (code && labelLower.includes(code)) return true;
    return false;
  });
}
