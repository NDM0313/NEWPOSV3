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

export const PARTY_EFFECTIVE_AUDIT_LABELS = {
  cancelledSaleTrail: 'Cancelled sale trail — audit only',
  glCorrection: 'GL Correction / Audit',
  voidedPaymentTrail: 'Voided payment trail — audit only',
  correctionReversal: 'Reversal — audit only',
  realActive: 'Real active sale/payment',
} as const;

/** Row inputs for normal/effective party statement visibility. */
export type PartyEffectiveRowInput = {
  jeReferenceType?: string | null;
  jeActionFingerprint?: string | null;
  linkedSaleStatus?: string | null;
  paymentVoidedAt?: string | null;
  journalIsVoid?: boolean | null;
};

export function isCancelledSaleStatus(status: string | null | undefined): boolean {
  return String(status || '').toLowerCase().trim() === 'cancelled';
}

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

/** Fingerprint for additive rental 1100 leakage repairs (JV-000204 class). */
export const RENTAL_1100_LEAKAGE_FP_PREFIX = 'developer_repair:gl_correction:rental-1100-leakage:';

export function isRental1100LeakageGlCorrectionFingerprint(
  actionFingerprint: string | null | undefined
): boolean {
  return String(actionFingerprint || '').trim().startsWith(RENTAL_1100_LEAKAGE_FP_PREFIX);
}

export function extractRentalLeakageSourceLineIdFromFingerprint(
  actionFingerprint: string | null | undefined
): string | null {
  const fp = String(actionFingerprint || '').trim();
  if (!isRental1100LeakageGlCorrectionFingerprint(fp)) return null;
  const lineId = fp.slice(RENTAL_1100_LEAKAGE_FP_PREFIX.length).trim();
  return lineId || null;
}

/** Source journal_entry_line ids with an applied rental-1100-leakage correction. */
export function collectRepairedControl1100SourceLineIds(
  rows: Array<{ je_action_fingerprint?: string | null }>
): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    const lineId = extractRentalLeakageSourceLineIdFromFingerprint(row.je_action_fingerprint);
    if (lineId) out.add(lineId);
  }
  return out;
}

export type Control1100LedgerRowInput = {
  journalLineId?: string | null;
  jeReferenceType?: string | null;
  jeActionFingerprint?: string | null;
  glAccountCode?: string | null;
};

/**
 * Effective control-1100 GL: hide repaired mobile rental leakage pairs (original line + gl_correction offset).
 * Audit mode shows full trail.
 */
export function shouldHideRepairedControl1100Row(
  row: Control1100LedgerRowInput,
  repairedSourceLineIds: Set<string>
): boolean {
  if (String(row.glAccountCode || '').trim() !== '1100') return false;
  if (isRental1100LeakageGlCorrectionFingerprint(row.jeActionFingerprint)) return true;
  const lineId = row.journalLineId ? String(row.journalLineId).trim() : '';
  if (lineId && repairedSourceLineIds.has(lineId)) return true;
  return false;
}

/** Cancelled-sale orphan GL correction rows (JV-000203 class) — audit/full statement only. */
export function isCancelledSaleOrphanGlCorrectionRow(args: PartyEffectiveRowInput): boolean {
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
export function shouldIncludeGlCorrectionInNormalStatement(args: PartyEffectiveRowInput): boolean {
  return !isCancelledSaleOrphanGlCorrectionRow(args);
}

export function partyStatementRowVisibilityArgs(row: PartyEffectiveRowInput) {
  return {
    jeReferenceType: row.jeReferenceType,
    jeActionFingerprint: row.jeActionFingerprint,
    linkedSaleStatus: row.linkedSaleStatus,
    paymentVoidedAt: row.paymentVoidedAt,
    journalIsVoid: row.journalIsVoid,
  };
}

/**
 * True when row belongs to cancelled/test/audit-only chain and must not affect effective balance.
 * Keeps final sale + active payment pairs visible together.
 */
export function isAuditOnlyPartyEffectiveRow(row: PartyEffectiveRowInput): boolean {
  if (isVoidedJournalEntry(row.journalIsVoid)) return true;
  const rt = String(row.jeReferenceType || '').toLowerCase().trim();

  if (isCorrectionReversalReferenceType(rt)) return true;
  if (isVoidedPayment(row.paymentVoidedAt)) return true;
  if (isCancelledSaleOrphanGlCorrectionRow(row)) return true;

  const cancelled = isCancelledSaleStatus(row.linkedSaleStatus);
  if (!cancelled) return false;

  if (CANCELLED_SALE_REF_TYPES.has(rt)) return true;
  if (rt === 'payment') return true;

  return false;
}

/** Normal/effective party statement — hide audit-only cancelled/void/correction chains. */
export function shouldIncludePartyEffectiveRow(row: PartyEffectiveRowInput): boolean {
  return !isAuditOnlyPartyEffectiveRow(row);
}

/** @deprecated alias — use shouldIncludePartyEffectiveRow */
export function shouldIncludePartyStatementRowInNormal(row: PartyEffectiveRowInput): boolean {
  return shouldIncludePartyEffectiveRow(row);
}

export function partyStatementGlCorrectionAuditLabel(): string {
  return PARTY_EFFECTIVE_AUDIT_LABELS.glCorrection;
}

export function partyEffectiveRowAuditLabel(row: PartyEffectiveRowInput): string | null {
  if (isCancelledSaleOrphanGlCorrectionRow(row)) return PARTY_EFFECTIVE_AUDIT_LABELS.glCorrection;
  const rt = String(row.jeReferenceType || '').toLowerCase().trim();
  if (isCorrectionReversalReferenceType(rt)) return PARTY_EFFECTIVE_AUDIT_LABELS.correctionReversal;
  if (isVoidedPayment(row.paymentVoidedAt)) return PARTY_EFFECTIVE_AUDIT_LABELS.voidedPaymentTrail;
  if (isCancelledSaleStatus(row.linkedSaleStatus)) {
    if (CANCELLED_SALE_REF_TYPES.has(rt)) return PARTY_EFFECTIVE_AUDIT_LABELS.cancelledSaleTrail;
    if (rt === 'payment') return PARTY_EFFECTIVE_AUDIT_LABELS.voidedPaymentTrail;
  }
  return null;
}
