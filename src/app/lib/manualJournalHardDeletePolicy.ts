/**
 * Manual / misc JE complete (hard) delete policy.
 * Permanently removes journal_entries + lines — not soft void.
 * Payment-linked and source-document roots are blocked.
 */

import { inferTransactionKind } from '@/app/lib/unifiedTransactionEdit';

export const MANUAL_JE_HARD_DELETE_LABEL = 'Complete Delete';

export const MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE = 'HARD DELETE';

export const MANUAL_JE_HARD_DELETE_BEHAVIOR_NOTE =
  'Complete Delete permanently removes the journal header and its lines from the database. ' +
  'This cannot be undone. Prefer Cancel Entry (reversal) when an audit trail is needed. ' +
  'Payment-linked and source-document JEs cannot be hard-deleted from Accounting.';

export interface ManualJournalHardDeleteRow {
  reference_type?: string | null;
  reference_id?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  description?: string | null;
  payment_obj?: unknown;
}

function isSourceDocumentRoot(row: ManualJournalHardDeleteRow): boolean {
  if (row.payment_id) return false;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  if (rt.startsWith('studio_')) return true;
  return inferTransactionKind(row, row.payment_obj) === 'document_total';
}

export function isManualJournalHardDeleteEligible(row: ManualJournalHardDeleteRow): boolean {
  if (row.payment_id) return false;
  if (isSourceDocumentRoot(row)) return false;
  return true;
}

export function manualJournalHardDeleteBlockedReason(row: ManualJournalHardDeleteRow): string | null {
  if (row.payment_id) {
    return 'Payment-linked journals cannot be hard-deleted. Use Cancel Payment instead.';
  }
  if (isSourceDocumentRoot(row)) {
    return 'Source-document journals cannot be hard-deleted. Open the sale/purchase/rental/studio record instead.';
  }
  return null;
}

/** Confirm dialog body; caller should require typing MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE. */
export function manualJournalHardDeleteConfirmMessage(entryNo: string | null | undefined): string {
  const ref = String(entryNo || '').trim() || 'this journal';
  return (
    `WARNING: This is a COMPLETE HARD DELETE of ${ref}. ` +
    'The journal header and all lines will be permanently removed from the database. ' +
    'There is no undo, and Cancel Entry / reverse audit for this JE will be gone. ' +
    `Type ${MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE} below to confirm.`
  );
}

export function isValidHardDeleteConfirmPhrase(typed: string): boolean {
  return String(typed || '').trim() === MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE;
}
