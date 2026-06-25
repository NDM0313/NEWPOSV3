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
