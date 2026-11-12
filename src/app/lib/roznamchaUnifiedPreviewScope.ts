/**
 * Roznamcha preview RPC scope helpers (Phase 2.6).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { AccountFilter } from '@/app/services/roznamchaService';
import type { PaymentAccountFilter } from '@/app/lib/paymentAccountFilter';
import { paymentAccountFilterIds } from '@/app/lib/paymentAccountFilter';
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
  paymentLedgerAccountId: PaymentAccountFilter,
  paymentAccountOptions: Array<{ id: string; label: string }>
): UnifiedLedgerRow[] {
  const ids = paymentAccountFilterIds(paymentLedgerAccountId);
  if (ids.length === 0) return rows;
  const opts = ids
    .map((id) => paymentAccountOptions.find((o) => o.id === id))
    .filter((o): o is { id: string; label: string } => Boolean(o));
  // Fail closed: selected ids with no options must not leak the full (unfiltered) stream.
  if (opts.length === 0) return [];
  return rows.filter((r) => {
    const code = (r.accountCode || '').trim().toLowerCase();
    const name = (r.accountName || '').trim().toLowerCase();
    return opts.some((opt) => {
      const labelLower = opt.label.toLowerCase();
      const codePart = opt.label.split(' — ')[0]?.trim().toLowerCase() || '';
      const namePart = opt.label.includes(' — ')
        ? opt.label.split(' — ').slice(1).join(' — ').trim().toLowerCase()
        : '';
      if (code && codePart && code === codePart) return true;
      if (name && namePart && name === namePart) return true;
      if (name && labelLower.includes(name)) return true;
      if (code && labelLower.includes(code)) return true;
      return false;
    });
  });
}
