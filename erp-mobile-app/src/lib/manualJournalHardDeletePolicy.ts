/**
 * Complete Delete policy (mobile) — mirrors web manualJournalHardDeletePolicy.
 * Source-document bills blocked; Receive/Pay and manual JEs eligible.
 */

import { SOURCE_CONTROLLED_REFERENCE_TYPES } from './journalEntryEditPolicy';

export const MANUAL_JE_HARD_DELETE_LABEL = 'Complete Delete';

export const MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE = 'HARD DELETE';

export interface ManualJournalHardDeleteRow {
  reference_type?: string | null;
  reference_id?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  description?: string | null;
}

export function isSourceDocumentRoot(row: ManualJournalHardDeleteRow): boolean {
  if (row.payment_id && String(row.payment_id).trim()) return false;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  if (rt.startsWith('studio_')) return true;
  if (SOURCE_CONTROLLED_REFERENCE_TYPES.has(rt)) return true;
  return false;
}

export function isPaymentHardDeleteTarget(row: ManualJournalHardDeleteRow): boolean {
  if (row.payment_id && String(row.payment_id).trim()) return true;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  return (
    rt === 'payment_adjustment' ||
    rt === 'payment' ||
    rt === 'manual_receipt' ||
    rt === 'manual_payment' ||
    rt === 'on_account' ||
    rt === 'worker_payment' ||
    rt === 'worker_advance_settlement'
  );
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

export function manualJournalHardDeleteConfirmMessage(
  entryNo: string | null | undefined,
  options: { isPayment?: boolean } = {}
): string {
  const ref = String(entryNo || '').trim() || 'this journal';
  if (options.isPayment) {
    return (
      `WARNING: This is a COMPLETE HARD DELETE of ${ref}. ` +
      'The payment record, all linked journal entries in the chain, their lines, and invoice allocations ' +
      'will be permanently removed. There is no undo. Prefer Cancel Payment when an audit trail is needed. ' +
      `Type ${MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE} below to confirm.`
    );
  }
  return (
    `WARNING: This is a COMPLETE HARD DELETE of ${ref}. ` +
    'The journal header and all lines will be permanently removed. There is no undo. ' +
    `Type ${MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE} below to confirm.`
  );
}

export function isValidHardDeleteConfirmPhrase(typed: string): boolean {
  return String(typed || '').trim() === MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE;
}

/** Client heuristic for showing Complete Delete on a journal/payment row. */
export function canCompleteDeleteJournalRow(opts: {
  journalEntryId?: string | null;
  paymentId?: string | null;
  referenceType?: string | null;
}): { show: boolean; isPayment: boolean } {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const jeId = String(opts.journalEntryId || '').trim();
  if (!jeId || !UUID_RE.test(jeId)) return { show: false, isPayment: false };
  const row: ManualJournalHardDeleteRow = {
    reference_type: opts.referenceType,
    payment_id: opts.paymentId,
  };
  if (!isManualJournalHardDeleteEligible(row)) return { show: false, isPayment: false };
  return { show: true, isPayment: isPaymentHardDeleteTarget(row) };
}
