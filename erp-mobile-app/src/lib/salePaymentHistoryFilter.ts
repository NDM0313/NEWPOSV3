/**
 * Sale payment history — exclude rental vouchers (mirrors web salePaymentHistoryFilter.ts).
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
