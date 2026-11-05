/**
 * Manual JE cancel policy — documents safe void-header cancel (no hard delete, no GL line mutation).
 */

import { isSourceControlledAccountingDocument } from '@/app/lib/transactionActionRules';

export const MANUAL_JE_CANCEL_LABEL = 'Cancel Entry';

export const MANUAL_JE_CANCEL_BEHAVIOR_NOTE =
  'Manual journal entries are cancelled by setting journal_entries.is_void (soft void). ' +
  'No hard delete. Cancelled entries are hidden from normal reports and remain traceable in audit views. ' +
  'Payment-linked and source-document JEs use separate cancel paths.';

export interface ManualJournalCancelRow {
  reference_type?: string | null;
  reference_id?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
}

/** Eligible for manual Cancel Entry (void header) — not payment-linked, not source-document root. */
export function isManualJournalCancelEligible(row: ManualJournalCancelRow): boolean {
  if (row.is_void === true) return false;
  if (row.payment_id) return false;
  if (isSourceControlledAccountingDocument(row)) return false;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  if (rt === 'correction_reversal') return false;
  return true;
}

export function manualJournalCancelConfirmMessage(hasPayment: boolean): string {
  if (hasPayment) {
    return 'Cancel this payment? It will be removed from Roznamcha, statements, ledger, and GL. This cannot be undone.';
  }
  return 'Cancel this entry? It will be marked void and hidden from normal reports. Audit trail is preserved.';
}
