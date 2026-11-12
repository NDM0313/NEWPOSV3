/** Normal vs audit report visibility — keep in sync with src/app/lib/reportVisibilityContract.ts */

export const CORRECTION_REVERSAL_REF = 'correction_reversal';

export function isCorrectionReversalReferenceType(referenceType: string | null | undefined): boolean {
  return String(referenceType || '').toLowerCase().trim() === CORRECTION_REVERSAL_REF;
}
