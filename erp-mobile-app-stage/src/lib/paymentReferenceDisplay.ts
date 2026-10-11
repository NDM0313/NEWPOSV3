const INTERNAL_BACKFILL_UUID_TAIL =
  /-BF-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DB repair sentinels — not user-facing voucher numbers. */
export function isInternalPaymentBackfillRef(ref: string | null | undefined): boolean {
  const s = String(ref || '').trim();
  if (!s) return false;
  const upper = s.toUpperCase();
  if (upper.startsWith('PAY-BF-')) return true;
  if (upper.startsWith('PAY-BACKFILL-')) return true;
  if (INTERNAL_BACKFILL_UUID_TAIL.test(s)) return true;
  return false;
}
