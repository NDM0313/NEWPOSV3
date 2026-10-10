/**
 * Bridge UI ReportBasis ↔ RPC UnifiedLedgerBasis + shared banner labels.
 */

import type { ReportBasis } from '@/app/lib/financialTruthBasis';
import { REPORT_BASIS_LABELS } from '@/app/lib/financialTruthBasis';
import {
  type UnifiedLedgerBasis,
  UNIFIED_LEDGER_BASIS_LABELS,
} from '@/app/lib/unifiedLedgerBasisFilter';

export function reportBasisToUnifiedBasis(basis: ReportBasis): UnifiedLedgerBasis {
  switch (basis) {
    case 'official_gl':
      return 'official_gl';
    case 'effective_party':
      return 'effective_party';
    case 'audit_full':
      return 'audit_full_history';
    default:
      return 'effective_party';
  }
}

export function unifiedBasisToReportBasis(basis: UnifiedLedgerBasis): ReportBasis {
  switch (basis) {
    case 'official_gl':
      return 'official_gl';
    case 'effective_party':
      return 'effective_party';
    case 'audit_full_history':
      return 'audit_full';
    default:
      return 'effective_party';
  }
}

/** Banner label for RPC basis lens — prefers UI ReportBasis labels when mapped. */
export function unifiedBasisBannerLabel(basis: UnifiedLedgerBasis): string {
  const reportBasis = unifiedBasisToReportBasis(basis);
  return REPORT_BASIS_LABELS[reportBasis] || UNIFIED_LEDGER_BASIS_LABELS[basis];
}
