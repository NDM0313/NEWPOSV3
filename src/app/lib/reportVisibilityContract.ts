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

const CANCELLED_SALE_REF_TYPES = new Set(['sale', 'sale_reversal', 'sale_return']);

export const GL_CORRECTION_REF = 'gl_correction';

/** Fingerprint prefix for additive orphan-AR repairs tied to cancelled sales (e.g. HQ-SL-0003 / JV-000203). */
export const CANCELLED_SALE_GL_CORRECTION_FP_PREFIX = 'developer_repair:gl_correction:';

export function isGlCorrectionReferenceType(referenceType: string | null | undefined): boolean {
  return String(referenceType || '').toLowerCase().trim() === GL_CORRECTION_REF;
}

export function isCancelledSaleGlCorrectionFingerprint(
  actionFingerprint: string | null | undefined
): boolean {
  const fp = String(actionFingerprint || '').trim();
  if (!fp.startsWith(CANCELLED_SALE_GL_CORRECTION_FP_PREFIX)) return false;
  return fp.endsWith('-orphan-ar');
}

/** Cancelled-sale orphan GL correction rows (JV-000203 class) — audit/full statement only. */
export function isCancelledSaleOrphanGlCorrectionRow(args: {
  jeReferenceType?: string | null;
  jeActionFingerprint?: string | null;
  linkedSaleStatus?: string | null;
}): boolean {
  if (!isGlCorrectionReferenceType(args.jeReferenceType)) return false;
  return isCancelledSaleGlCorrectionFingerprint(args.jeActionFingerprint);
}

/** Normal party AR/AP statement: hide cancelled-sale document trails (audit mode shows them). */
export function shouldIncludeCancelledSaleActivityInNormalStatement(args: {
  jeReferenceType?: string | null;
  linkedSaleStatus?: string | null;
}): boolean {
  const status = String(args.linkedSaleStatus || '').toLowerCase().trim();
  if (status !== 'cancelled') return true;
  const rt = String(args.jeReferenceType || '').toLowerCase().trim();
  return !CANCELLED_SALE_REF_TYPES.has(rt);
}

/**
 * Normal/effective party statement: hide cancelled-sale orphan GL corrections only.
 * Other gl_correction rows remain visible in normal mode.
 */
export function shouldIncludeGlCorrectionInNormalStatement(args: {
  jeReferenceType?: string | null;
  jeActionFingerprint?: string | null;
  linkedSaleStatus?: string | null;
}): boolean {
  return !isCancelledSaleOrphanGlCorrectionRow(args);
}

export function partyStatementRowVisibilityArgs(row: {
  jeReferenceType?: string | null;
  jeActionFingerprint?: string | null;
  linkedSaleStatus?: string | null;
}) {
  return {
    jeReferenceType: row.jeReferenceType,
    jeActionFingerprint: row.jeActionFingerprint,
    linkedSaleStatus: row.linkedSaleStatus,
  };
}

/** Normal/effective party statement row (cancelled sale trail + related gl_correction). */
export function shouldIncludePartyStatementRowInNormal(row: {
  jeReferenceType?: string | null;
  jeActionFingerprint?: string | null;
  linkedSaleStatus?: string | null;
}): boolean {
  const args = partyStatementRowVisibilityArgs(row);
  if (!shouldIncludeCancelledSaleActivityInNormalStatement(args)) return false;
  if (!shouldIncludeGlCorrectionInNormalStatement(args)) return false;
  return true;
}

export function partyStatementGlCorrectionAuditLabel(): string {
  return 'GL Correction / Audit';
}
