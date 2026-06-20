/**
 * Unified Core Ledger — basis filter (TS mirror of SQL _unified_ledger_basis_includes_row).
 * Used by unifiedLedgerService and tie-out tests.
 */

import {
  isAuditOnlyPartyEffectiveRow,
  isCorrectionReversalReferenceType,
  type PartyEffectiveRowInput,
} from '@/app/lib/reportVisibilityContract';
import { officialGlIncludesJournalEntry } from '@/app/lib/financialTruthBasis';

export type UnifiedLedgerBasis = 'official_gl' | 'effective_party' | 'audit_full_history';

export const UNIFIED_LEDGER_BASIS_LABELS: Record<UnifiedLedgerBasis, string> = {
  official_gl: 'Official Posted GL',
  effective_party: 'Effective Party (hides reversal/void/cancelled chains)',
  audit_full_history: 'Audit Full History',
};

export type UnifiedLedgerRowBasisInput = PartyEffectiveRowInput & {
  isVoid?: boolean | null;
};

/** Whether a journal row is included for the given basis lens. */
export function unifiedLedgerBasisIncludesRow(
  basis: UnifiedLedgerBasis,
  row: UnifiedLedgerRowBasisInput
): boolean {
  if (row.isVoid === true || row.journalIsVoid === true) return false;

  switch (basis) {
    case 'official_gl':
      return officialGlIncludesJournalEntry({
        isVoid: row.isVoid ?? row.journalIsVoid,
        referenceType: row.jeReferenceType,
      });
    case 'effective_party':
      return !isAuditOnlyPartyEffectiveRow(row);
    case 'audit_full_history':
      // Full posted trace: include correction_reversal and void-payment trails; still exclude void JEs.
      return officialGlIncludesJournalEntry({
        isVoid: row.isVoid ?? row.journalIsVoid,
        referenceType: row.jeReferenceType,
      });
    default:
      return false;
  }
}

/** True when row is audit-only (hidden from effective_party). */
export function isUnifiedLedgerAuditOnlyRow(row: UnifiedLedgerRowBasisInput): boolean {
  return isAuditOnlyPartyEffectiveRow(row);
}

/** Detect JE-0168-class correction reversal for golden tests. */
export function isJe0168ClassReversal(referenceType: string | null | undefined): boolean {
  return isCorrectionReversalReferenceType(referenceType);
}
