/** Customer receipt ref (RCV-0001 or branch-prefixed HQ-RCV-0001). */
export function isRcvReference(ref: string | null | undefined): boolean {
  const t = String(ref || '').trim();
  return /(?:^|-)RCV-\d/i.test(t);
}

/** Canonical rental payment voucher ref: `{booking_no}-PAY` (e.g. REN-0002-PAY). Legacy — new rows use RCV. */

export function formatRentalPaymentRef(bookingNo: string): string {
  const b = String(bookingNo || '').trim().replace(/-PAY$/i, '');
  return b ? `${b}-PAY` : '';
}

/** Legacy / mobile text stored in rental_payments.reference instead of voucher ref. */
export function isGenericRentalPaymentReference(ref: string): boolean {
  const t = String(ref || '').trim();
  if (!t) return true;
  return /^advance(\s+at\s+booking|-\s*ren)/i.test(t);
}

export function resolveRentalPaymentDisplay(opts: {
  bookingNo?: string | null;
  storedReference?: string | null;
}): { referenceNo: string; subtitle?: string } {
  const bookingNo = String(opts.bookingNo || '').trim();
  const stored = String(opts.storedReference || '').trim();
  const canonical = formatRentalPaymentRef(bookingNo);
  const referenceNo =
    (isRcvReference(stored) ? stored : '') ||
    (stored && !isGenericRentalPaymentReference(stored) ? stored : '') ||
    canonical ||
    stored;
  const subtitle = isGenericRentalPaymentReference(stored) && stored ? stored : undefined;
  return { referenceNo, subtitle };
}
