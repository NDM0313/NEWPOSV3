import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';

export type CompareFilterState = {
  branchId: string | null;
  basis: UnifiedLedgerBasis;
  dateFrom: string;
  dateTo: string;
};

export const BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'official_gl',
  'effective_party',
  'audit_full_history',
];

/**
 * Phase 1.8 tie-out used lifetime scope (both dates null).
 * When From is empty, ignore To so compare does not asymmetrically filter the old engine only.
 */
export function normalizeCompareDateRange(
  dateFrom?: string | null,
  dateTo?: string | null
): { dateFrom: string | null; dateTo: string | null } {
  const from = dateFrom?.trim() || null;
  const to = dateTo?.trim() || null;
  if (!from) {
    return { dateFrom: null, dateTo: null };
  }
  return { dateFrom: from, dateTo: to };
}
