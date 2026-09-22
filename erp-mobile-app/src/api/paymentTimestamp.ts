import { supabase, isSupabaseConfigured } from '../lib/supabase';

/** Best-effort patch of payments.created_at after RPC insert (non-blocking). */
export async function patchPaymentCreatedAt(paymentId: string, paymentAt: string): Promise<void> {
  if (!isSupabaseConfigured || !paymentId?.trim() || !paymentAt?.trim()) return;
  const { error } = await supabase
    .from('payments')
    .update({ created_at: paymentAt })
    .eq('id', paymentId);
  if (error) {
    console.warn('[patchPaymentCreatedAt]', error.message);
  }
}
