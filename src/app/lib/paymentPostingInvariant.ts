import { supabase } from '@/lib/supabase';

export function isPaymentPostingInvariantDev(): boolean {
  return typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
}

/** Dev-only: fail fast when a payment row has no active non-void journal on payment_id. */
export async function assertActiveJournalForPaymentId(paymentId: string, context: string): Promise<void> {
  if (!isPaymentPostingInvariantDev() || !paymentId) return;
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('payment_id', paymentId)
    .or('is_void.is.null,is_void.eq.false')
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error(
      `[PAYMENT_POSTING_INVARIANT] ${context}: payment ${paymentId} has no active journal entry (payment_id link).`
    );
  }
}
