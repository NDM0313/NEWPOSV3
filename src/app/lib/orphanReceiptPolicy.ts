/**
 * Orphan manual receipt — payment row exists but journal has no posted double-entry lines.
 */

export const ORPHAN_RECEIPT_VOID_REASON =
  'Duplicate failed web receipt retry artifact — no posted double-entry lines. Soft-hidden per operator request.';

export const ORPHAN_RECEIPT_POSTING_FAILED_REASON = 'Receipt posting failed — automatic rollback (no GL lines).';

export const ORPHAN_RECEIPT_HIDE_HELP =
  'Delete means hide from normal operational reports with audit history. It does not physically remove production history.';

export type OrphanReceiptDisplayStatus = 'posted' | 'orphan_posting_failed' | 'voided';

export function isOrphanReceiptJournalEntry(input: {
  reference_type?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  journalLineCount?: number;
  activeLineCount?: number;
}): boolean {
  if (input.is_void === true) return false;
  const rt = String(input.reference_type || '').toLowerCase().trim();
  if (rt !== 'manual_receipt') return false;
  if (!input.payment_id) return false;
  const lineCount = input.activeLineCount ?? input.journalLineCount ?? 0;
  return lineCount < 2;
}

export function resolveOrphanReceiptDisplayStatus(input: {
  reference_type?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  journalLineCount?: number;
  payment_voided_at?: string | null;
}): OrphanReceiptDisplayStatus {
  if (input.is_void === true || input.payment_voided_at) return 'voided';
  if (
    isOrphanReceiptJournalEntry({
      reference_type: input.reference_type,
      payment_id: input.payment_id,
      is_void: input.is_void,
      journalLineCount: input.journalLineCount,
    })
  ) {
    return 'orphan_posting_failed';
  }
  return 'posted';
}
