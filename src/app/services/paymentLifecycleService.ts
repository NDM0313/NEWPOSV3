/**
 * Live vs audit: voided payments stay in DB for journal audit but must not affect
 * customer/supplier ledger or sale/purchase allocations (payment_allocations cleared on void).
 */
import { supabase } from '@/lib/supabase';

/**
 * Clears invoice allocations and marks payment voided. Triggers recalc_sale_payment_totals via allocation deletes.
 */
export async function voidPaymentAfterJournalReversal(params: {
  companyId: string;
  paymentId: string;
}): Promise<void> {
  const { companyId, paymentId } = params;
  if (!companyId || !paymentId) return;

  const { error: delErr } = await supabase.from('payment_allocations').delete().eq('payment_id', paymentId);
  if (delErr) throw new Error(delErr.message);

  const { error: updErr } = await supabase
    .from('payments')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('company_id', companyId);
  if (updErr) throw new Error(updErr.message);
}
