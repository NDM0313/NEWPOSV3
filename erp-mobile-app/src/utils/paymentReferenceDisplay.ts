import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * True for last-resort collision references from record_customer_payment (migrations/20260457+).
 */
export function isPayFbFallbackRef(ref: string | null | undefined): boolean {
  return /^PAY-FB-/i.test(String(ref || '').trim());
}

/**
 * Shorten ugly PAY-FB-* for on-screen display. Full string stays in `full` for tooltips / audit.
 */
export function formatPayFbReferenceShort(ref: string | null | undefined): { primary: string; full: string } {
  const full = String(ref || '').trim();
  if (!full) return { primary: '', full: '' };
  const m = /^PAY-FB-(\d{14})-/i.exec(full);
  if (m) {
    const ts = m[1];
    return { primary: `PAY-FB · ${ts}`, full };
  }
  return { primary: full, full };
}

/**
 * Prefer journal voucher no. (e.g. JE-…) for user-facing label; keep payment reference as `full` when it differs.
 */
export function buildPaymentReferenceLabels(
  paymentReference: string | null | undefined,
  journalEntryNo: string | null | undefined
): { primary: string; full: string } {
  const payRef = String(paymentReference || '').trim();
  const je = String(journalEntryNo || '').trim();
  if (je) {
    return { primary: je, full: payRef || je };
  }
  return formatPayFbReferenceShort(payRef);
}

/**
 * Earliest non-void journal entry_no for a payment (same idea as Account Statements “Cash/bank voucher”).
 */
export async function fetchPrimaryJournalEntryNoForPayment(
  companyId: string,
  paymentId: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !companyId || !paymentId) return null;
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_no, created_at')
    .eq('company_id', companyId)
    .eq('payment_id', paymentId)
    .or('is_void.is.null,is_void.eq.false')
    .neq('reference_type', 'payment_adjustment');
  if (error || !data?.length) return null;
  let best: { no: string; t: number } | null = null;
  for (const row of data) {
    const eno = String((row as { entry_no?: string }).entry_no || '').trim();
    if (!eno) continue;
    const t = new Date((row as { created_at?: string }).created_at || 0).getTime();
    if (!best || t < best.t) best = { no: eno, t };
  }
  return best?.no ?? null;
}
