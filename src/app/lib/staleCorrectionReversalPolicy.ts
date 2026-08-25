/**
 * Stale correction_reversal cleanup — active reversal rows after payment/source JE already voided.
 * Soft void only (is_void); no hard delete.
 */

import { isCorrectionReversalReferenceType } from '@/app/lib/reportVisibilityContract';

export const STALE_REVERSAL_VOID_LABEL = 'Remove from live GL';

export const STALE_REVERSAL_VOID_REASON_PREFIX = 'stale_correction_reversal_cleanup';

export interface StaleCorrectionReversalRow {
  reference_type?: string | null;
  is_void?: boolean | null;
  action_fingerprint?: string | null;
  payment_id?: string | null;
  reference_id?: string | null;
}

export interface StaleCorrectionReversalContext {
  /** Source JE referenced by correction_reversal.reference_id */
  sourceJournalIsVoid?: boolean | null;
  sourceJournalIsActive?: boolean | null;
  /** Linked payments.voided_at when payment_id set */
  paymentVoidedAt?: string | null;
}

export function isDeveloperRepairGlFingerprint(actionFingerprint: string | null | undefined): boolean {
  const fp = String(actionFingerprint || '').trim();
  return fp.startsWith('developer_repair:');
}

/** Block void when source payment/JE is still active — would unbalance official GL. */
export function isStaleCorrectionReversalSourceStillActive(ctx: StaleCorrectionReversalContext): boolean {
  if (ctx.sourceJournalIsActive === true) return true;
  const paymentVoided = ctx.paymentVoidedAt != null && String(ctx.paymentVoidedAt).trim() !== '';
  if (ctx.paymentVoidedAt !== undefined && ctx.paymentVoidedAt !== null && !paymentVoided) {
    return true;
  }
  return false;
}

export function isSourceCancelledForStaleReversal(ctx: StaleCorrectionReversalContext): boolean {
  if (ctx.sourceJournalIsVoid === true) return true;
  const paymentVoided = ctx.paymentVoidedAt != null && String(ctx.paymentVoidedAt).trim() !== '';
  return paymentVoided;
}

/**
 * Admin self-service: void active correction_reversal when underlying payment/source already cancelled.
 */
export function isStaleCorrectionReversalVoidEligible(
  row: StaleCorrectionReversalRow,
  ctx: StaleCorrectionReversalContext
): boolean {
  if (row.is_void === true) return false;
  if (!isCorrectionReversalReferenceType(row.reference_type)) return false;
  if (isDeveloperRepairGlFingerprint(row.action_fingerprint)) return false;
  if (isStaleCorrectionReversalSourceStillActive(ctx)) return false;
  return isSourceCancelledForStaleReversal(ctx);
}

export function staleCorrectionReversalVoidBlockedReason(
  row: StaleCorrectionReversalRow,
  ctx: StaleCorrectionReversalContext
): string | null {
  if (row.is_void === true) return 'Entry is already voided.';
  if (!isCorrectionReversalReferenceType(row.reference_type)) {
    return 'Only correction reversal entries can use Remove from live GL.';
  }
  if (isDeveloperRepairGlFingerprint(row.action_fingerprint)) {
    return 'Developer repair entries must be handled in Hybrid Repair / Developer Center.';
  }
  if (isStaleCorrectionReversalSourceStillActive(ctx)) {
    return 'Source payment or journal is still active — cancel the payment first, then remove the stale reversal.';
  }
  if (!isSourceCancelledForStaleReversal(ctx)) {
    return 'Source payment or journal must be voided before removing this reversal from live GL.';
  }
  return null;
}

export function staleCorrectionReversalVoidConfirmMessage(
  entryNo: string | null | undefined,
  amount: number | null | undefined
): string {
  const label = entryNo ? String(entryNo) : 'this reversal';
  const amt =
    amount != null && Number.isFinite(amount) && amount > 0
      ? ` (≈ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      : '';
  return (
    `Remove ${label}${amt} from live GL?\n\n` +
    'This marks the reversal void (soft cancel). It will disappear from Cash, Trial Balance, and normal Day Book. ' +
    'Audit trail is preserved — enable Audit mode to see voided history.\n\n' +
    'Hard delete is not performed.'
  );
}

export function buildStaleReversalVoidReason(entryNo: string | null | undefined, userNote?: string): string {
  const base = `${STALE_REVERSAL_VOID_REASON_PREFIX}:${entryNo || 'unknown'}`;
  const note = userNote?.trim();
  return note ? `${base} — ${note.slice(0, 400)}` : base;
}

export function correctionReversalReviewEligibility(
  row: StaleCorrectionReversalRow,
  ctx: StaleCorrectionReversalContext
): { status: 'eligible' | 'blocked'; label: string } {
  if (isStaleCorrectionReversalVoidEligible(row, ctx)) {
    return { status: 'eligible', label: 'Eligible — Remove from live GL' };
  }
  const blocked = staleCorrectionReversalVoidBlockedReason(row, ctx);
  return { status: 'blocked', label: blocked || 'Blocked' };
}
