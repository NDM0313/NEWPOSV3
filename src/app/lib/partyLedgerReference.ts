import { isRcvReference, resolveRentalPaymentDisplay } from '@/app/lib/rentalPaymentRef';

export type PartyLedgerLineKind = 'sale_debit' | 'rental_debit' | 'receipt_credit' | 'payment_out' | 'journal';

export function resolvePartyLedgerReference(opts: {
  lineKind: PartyLedgerLineKind;
  entryNo?: string | null;
  referenceType?: string | null;
  saleInvoiceNo?: string | null;
  rentalBookingNo?: string | null;
  rentalPaymentRef?: string | null;
  paymentReferenceNumber?: string | null;
  paymentBankTraceId?: string | null;
}): string {
  const entryNo = String(opts.entryNo || '').trim();
  const refType = String(opts.referenceType || '').toLowerCase();

  if (opts.lineKind === 'sale_debit' && opts.saleInvoiceNo) {
    return String(opts.saleInvoiceNo);
  }
  if (opts.lineKind === 'rental_debit' && opts.rentalBookingNo) {
    return String(opts.rentalBookingNo);
  }
  if (opts.lineKind === 'receipt_credit') {
    const payRef = String(opts.paymentReferenceNumber || '').trim();
    if (payRef) return payRef;
    const rpRef = String(opts.rentalPaymentRef || '').trim();
    if (isRcvReference(rpRef) || rpRef) {
      const resolved = resolveRentalPaymentDisplay({
        bookingNo: opts.rentalBookingNo,
        storedReference: rpRef,
      });
      return resolved.referenceNo;
    }
    if (refType === 'manual_receipt' || refType === 'manual_payment') {
      return opts.paymentBankTraceId || payRef || entryNo;
    }
  }
  if (opts.lineKind === 'payment_out' && opts.paymentReferenceNumber) {
    return String(opts.paymentReferenceNumber);
  }
  return entryNo || payRefFallback(opts.paymentReferenceNumber) || '—';
}

function payRefFallback(ref?: string | null): string {
  const t = String(ref || '').trim();
  return t || '';
}

/** Description for customer receipt when linked sale is not final. */
export function customerReceiptLedgerDescription(opts: {
  saleStatus?: string | null;
  base?: string;
}): string {
  const status = String(opts.saleStatus || '').toLowerCase().trim();
  if (status && status !== 'final' && status !== 'cancelled') {
    return 'Advance receipt';
  }
  return opts.base || 'Payment';
}
