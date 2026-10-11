/**
 * Complete Delete (hard delete) policy for journals and receive/pay.
 * Permanently removes journal_entries (+ lines) and, for payments, the payment
 * row + full JE chain + allocations — not soft void.
 * Source-document bill roots (sale/purchase/rental/studio invoices) stay blocked.
 */

import { inferTransactionKind } from '@/app/lib/unifiedTransactionEdit';

export const MANUAL_JE_HARD_DELETE_LABEL = 'Complete Delete';

export const MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE = 'HARD DELETE';

export const MANUAL_JE_HARD_DELETE_BEHAVIOR_NOTE =
  'Complete Delete permanently removes the journal (and for Receive/Pay, the payment row, ' +
  'full JE chain, and allocations) from the database. This cannot be undone. ' +
  'Prefer Cancel Entry / Cancel Payment (reversal) when an audit trail is needed. ' +
  'Sale/purchase/rental/studio bill journals cannot be hard-deleted from Accounting.';

export interface ManualJournalHardDeleteRow {
  reference_type?: string | null;
  reference_id?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  description?: string | null;
  payment_obj?: unknown;
}

/** Invoice / document-total JE (not a receive/pay). */
export function isSourceDocumentRoot(row: ManualJournalHardDeleteRow): boolean {
  if (row.payment_id) return false;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  if (rt.startsWith('studio_')) return true;
  return inferTransactionKind(row, row.payment_obj) === 'document_total';
}

/** True when this row is a receive/pay (or payment adjustment) for cascade delete. */
export function isPaymentHardDeleteTarget(row: ManualJournalHardDeleteRow): boolean {
  if (row.payment_id) return true;
  const kind = inferTransactionKind(row, row.payment_obj);
  if (kind === 'payment') return true;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  return rt === 'payment_adjustment' || rt === 'payment';
}

export function isManualJournalHardDeleteEligible(row: ManualJournalHardDeleteRow): boolean {
  if (isSourceDocumentRoot(row)) return false;
  return true;
}

export function manualJournalHardDeleteBlockedReason(row: ManualJournalHardDeleteRow): string | null {
  if (isSourceDocumentRoot(row)) {
    return 'Source-document journals cannot be hard-deleted. Open the sale/purchase/rental/studio record instead.';
  }
  return null;
}

export interface HardDeleteConfirmOptions {
  /** When true, warn that payment + chain + allocations are removed. */
  isPayment?: boolean;
}

/** Confirm dialog body; caller should require typing MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE. */
export function manualJournalHardDeleteConfirmMessage(
  entryNo: string | null | undefined,
  options: HardDeleteConfirmOptions = {}
): string {
  const ref = String(entryNo || '').trim() || 'this journal';
  if (options.isPayment) {
    return (
      `WARNING: This is a COMPLETE HARD DELETE of ${ref}. ` +
      'The payment record, all linked journal entries in the chain, their lines, and invoice allocations ' +
      'will be permanently removed from the database. Sale/purchase paid totals will recalculate. ' +
      'There is no undo. Prefer Cancel Payment when an audit trail is needed. ' +
      `Type ${MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE} below to confirm.`
    );
  }
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
