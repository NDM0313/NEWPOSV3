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

/** Operational / account-statement line for rental payment or penalty receipt. */
export function rentalPaymentLedgerDescription(opts: {
  bookingNo?: string | null;
  customerName?: string | null;
  penaltyRef?: string | null;
  paymentType?: string | null;
  method?: string | null;
}): string {
  const booking = String(opts.bookingNo || '').trim();
  const customer = String(opts.customerName || '').trim();
  const ref = String(opts.penaltyRef || '').trim();
  const method = String(opts.method || '').trim();
  const isPenalty =
    String(opts.paymentType || '').toLowerCase() === 'penalty' ||
    /penalty|damage|planty|plant/i.test(ref);

  const head = isPenalty ? 'Rental penalty' : 'Rental payment';
  const parts: string[] = [head];
  if (booking) parts.push(booking);
  if (customer) parts.push(`(${customer})`);
  if (ref) parts.push(`— ${ref}`);
  else if (method) parts.push(`via ${method}`);
  return parts.join(' ').replace(/\s+/g, ' ').trim() || 'Rental Payment';
}
