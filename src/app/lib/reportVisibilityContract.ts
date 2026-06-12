/**
 * Phase 2B — shared normal vs audit report visibility contract.
 * Normal mode: active business movement only.
 * Audit mode: includes voided, correction_reversal, and reversal trails with labels.
 */

export type ReportViewMode = 'normal' | 'audit';

export const CORRECTION_REVERSAL_REF = 'correction_reversal';

export function isCorrectionReversalReferenceType(referenceType: string | null | undefined): boolean {
  return String(referenceType || '').toLowerCase().trim() === CORRECTION_REVERSAL_REF;
}

export function isVoidedJournalEntry(isVoid: boolean | null | undefined): boolean {
  return isVoid === true;
}

export function isVoidedPayment(voidedAt: string | null | undefined): boolean {
  return voidedAt != null && String(voidedAt).trim() !== '';
}

/** Normal Roznamcha / cash book: hide correction reversals and voided rows. */
export function shouldIncludeInNormalCashMovement(args: {
  referenceType?: string | null;
  journalIsVoid?: boolean | null;
  paymentVoidedAt?: string | null;
}): boolean {
  if (isVoidedJournalEntry(args.journalIsVoid)) return false;
  if (isVoidedPayment(args.paymentVoidedAt)) return false;
  if (isCorrectionReversalReferenceType(args.referenceType)) return false;
  return true;
}

/** Audit cash book: include reversal/void trails (caller adds labels). */
export function shouldIncludeInAuditCashMovement(_args: {
  referenceType?: string | null;
  journalIsVoid?: boolean | null;
  paymentVoidedAt?: string | null;
}): boolean {
  return true;
}

export function roznamchaRowAuditSuffix(args: {
  referenceType?: string | null;
  paymentVoidedAt?: string | null;
  journalIsVoid?: boolean | null;
}): string {
  if (isCorrectionReversalReferenceType(args.referenceType)) return ' (Reversal — audit)';
  if (isVoidedPayment(args.paymentVoidedAt) || isVoidedJournalEntry(args.journalIsVoid)) {
    return ' (voided)';
  }
  return '';
}

export function dayBookIncludeInNormalMode(referenceType: string | null | undefined): boolean {
  return !isCorrectionReversalReferenceType(referenceType);
}

export function accountStatementIncludeReversalInNormal(referenceType: string | null | undefined): boolean {
  return !isCorrectionReversalReferenceType(referenceType);
}
