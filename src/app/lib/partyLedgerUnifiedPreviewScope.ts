/**
 * Party Ledger preview RPC scope helpers (Phase 2.7).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';

export function normalizePartyLedgerPreviewBranch(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  return branchId;
}

/** Effective loader ignores branch today — preview uses all branches. */
export function partyLedgerPreviewBranchScope(): string | null {
  return null;
}

export function defaultUnifiedBasisForPartyLedger(
  mode: 'effective' | 'audit',
  showReversals: boolean
): UnifiedLedgerBasis {
  if (mode === 'audit' || showReversals) return 'audit_full_history';
  return 'effective_party';
}

export function buildPartyLedgerPreviewRpcScope(params: {
  contactId: string;
  partyType: 'customer' | 'supplier';
  dateFrom: string;
  dateTo: string;
  mode: 'effective' | 'audit';
  showReversals: boolean;
}) {
  return {
    contactId: params.contactId,
    partyType: params.partyType,
    branchId: partyLedgerPreviewBranchScope(),
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    basis: defaultUnifiedBasisForPartyLedger(params.mode, params.showReversals),
  };
}
