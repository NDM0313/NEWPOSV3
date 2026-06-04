/** Canonical rental payment voucher ref: `{booking_no}-PAY` (e.g. REN-0002-PAY). */

export function formatRentalPaymentRef(bookingNo: string): string {
  const b = String(bookingNo || '').trim().replace(/-PAY$/i, '');
  return b ? `${b}-PAY` : '';
}

export function isGenericRentalPaymentReference(ref: string): boolean {
  const t = String(ref || '').trim();
  if (!t) return true;
  return /^advance(\s+at\s+booking|-\s*ren)/i.test(t);
}
