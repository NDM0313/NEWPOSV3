import { isInternalPaymentBackfillRef } from '@/app/lib/documentNumberSuffix';
import {
  formatRentalPaymentRef,
  isGenericRentalPaymentReference,
  isRcvReference,
} from '@/app/lib/rentalPaymentRef';

/** RCV / PAY / REN / EXP over JE — audit-facing ref column. */
export function resolveCanonicalRoznamchaRef(opts: {
  referenceNumber?: string | null;
  rentalBookingNo?: string | null;
  expenseNo?: string | null;
  journalEntryNo?: string | null;
  fallbackRef?: string | null;
}): { ref: string; journalEntryNo: string | null } {
  const rawRefNum = String(opts.referenceNumber || '').trim();
  const refNum = isInternalPaymentBackfillRef(rawRefNum) ? '' : rawRefNum;
  const jeNo = String(opts.journalEntryNo || '').trim();
  const rentalNo = String(opts.rentalBookingNo || '').trim();
  const expenseNo = String(opts.expenseNo || '').trim();
  const fallback = String(opts.fallbackRef || '').trim();

  const jeSubtitle =
    jeNo && refNum && jeNo.toLowerCase() !== refNum.toLowerCase() ? jeNo : null;

  if (isRcvReference(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (expenseNo) {
    const expenseJeSubtitle =
      jeNo &&
      jeNo.toLowerCase() !== expenseNo.toLowerCase() &&
      (/^JE-/i.test(jeNo) || /^JV-/i.test(jeNo))
        ? jeNo
        : null;
    return { ref: expenseNo, journalEntryNo: expenseJeSubtitle };
  }
  if (/^PAY-/i.test(refNum) || /^WPY-/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (/^REN-.+-PAY$/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle || (jeNo || null) };
  if (rentalNo && (isGenericRentalPaymentReference(refNum) || !refNum) && !isRcvReference(refNum)) {
    const synthesized = formatRentalPaymentRef(rentalNo);
    return {
      ref: synthesized || rentalNo,
      journalEntryNo: jeNo && jeNo.toLowerCase() !== (synthesized || rentalNo).toLowerCase() ? jeNo : null,
    };
  }
  if (rentalNo) return { ref: rentalNo, journalEntryNo: jeNo && jeNo.toLowerCase() !== rentalNo.toLowerCase() ? jeNo : null };
  if (/^REN-/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (refNum && !/^JE-/i.test(refNum) && !/^JV-/i.test(refNum)) {
    return { ref: refNum, journalEntryNo: jeSubtitle };
  }
  if (jeNo) return { ref: jeNo, journalEntryNo: null };
  if (fallback) return { ref: fallback, journalEntryNo: null };
  return { ref: refNum || '—', journalEntryNo: null };
}

export interface RoznamchaRefRow {
  ref: string;
  journalEntryNo?: string | null;
}

/** Ref column for UI/export — never repeat JE twice. */
export function roznamchaRefDisplay(row: Pick<RoznamchaRefRow, 'ref' | 'journalEntryNo'>): string {
  const ref = String(row.ref || '').trim();
  const je = String(row.journalEntryNo || '').trim();
  if (!je || je.toLowerCase() === ref.toLowerCase()) return ref || '—';
  return ref;
}

export function roznamchaJournalSubtitle(row: Pick<RoznamchaRefRow, 'ref' | 'journalEntryNo'>): string | null {
  const ref = String(row.ref || '').trim();
  const je = String(row.journalEntryNo || '').trim();
  if (!je || je.toLowerCase() === ref.toLowerCase()) return null;
  if (/^JE-/i.test(ref) || /^JV-/i.test(ref)) return null;
  if (/^EXP-/i.test(ref)) return null;
  return je;
}
