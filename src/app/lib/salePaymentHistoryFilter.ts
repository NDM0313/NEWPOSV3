/**
 * Sale payment history — exclude rental vouchers and duplicate allocation rows.
 * Rental receipts live in rental_payments (REN-*-PAY), not sale payment history.
 */

export function isRentalPaymentReferenceNumber(ref: string | null | undefined): boolean {
  const s = String(ref ?? '').trim();
  return /^REN-.+-PAY$/i.test(s);
}

export function shouldExcludePaymentFromSaleHistory(parent: {
  reference_type?: string | null;
  reference_number?: string | null;
}): boolean {
  const refType = String(parent.reference_type ?? '').toLowerCase();
  if (refType === 'rental') return true;
  if (isRentalPaymentReferenceNumber(parent.reference_number)) return true;
  return false;
}
