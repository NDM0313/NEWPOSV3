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

  await voidAllPaymentChainJournals(companyId, paymentId);
}

/**
 * Void every JE that belongs to a payment's chain:
 *   - primary JEs (payment_id = paymentId, reference_type = manual_receipt / on_account / manual_payment / sale / purchase)
 *   - PF-14 adjustment JEs (reference_type = payment_adjustment, reference_id = paymentId)
 *
 * correction_reversal rows (the reversal JE itself) are NOT voided here — the caller
 * already created them as the audit record of the cancellation.
 */
async function voidAllPaymentChainJournals(companyId: string, paymentId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const reason = 'Linked payment voided — full chain cleanup (primary + PF-14 adjustments)';

  const { error: e1 } = await supabase
    .from('journal_entries')
    .update({ is_void: true, void_reason: reason, voided_at: nowIso })
    .eq('company_id', companyId)
    .eq('payment_id', paymentId)
    .eq('is_void', false)
    .neq('reference_type', 'correction_reversal');
  if (e1) console.warn('[paymentLifecycleService] void primary JEs error:', e1.message);

  const { error: e2 } = await supabase
    .from('journal_entries')
    .update({ is_void: true, void_reason: reason, voided_at: nowIso })
    .eq('company_id', companyId)
    .eq('reference_type', 'payment_adjustment')
    .eq('reference_id', paymentId)
    .eq('is_void', false);
  if (e2) console.warn('[paymentLifecycleService] void adjustment JEs error:', e2.message);
}

/**
 * Undo only the latest mutation in a payment's PF-14 chain.
 *  1. Void the tail (latest active, non-reversal) JE.
 *  2. Revert `payments` row to the previous state using transaction_mutations log.
 *  3. Return info about what was undone.
 */
export async function undoLastPaymentMutation(params: {
  companyId: string;
  paymentId: string;
}): Promise<{ undoneJeId: string; mutationType: string; restoredState: Record<string, unknown> } | null> {
  const { companyId, paymentId } = params;
  if (!companyId || !paymentId) return null;

  const { data: mutations, error: mErr } = await supabase
    .from('transaction_mutations')
    .select('id, mutation_type, old_state, new_state, adjustment_journal_entry_id')
    .eq('company_id', companyId)
    .eq('entity_type', 'payment')
    .eq('entity_id', paymentId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (mErr || !mutations?.length) return null;

  const lastMut = mutations[0] as {
    id: string;
    mutation_type: string;
    old_state: Record<string, unknown> | null;
    new_state: Record<string, unknown> | null;
    adjustment_journal_entry_id: string | null;
  };

  const jeIdToVoid = lastMut.adjustment_journal_entry_id;
  if (!jeIdToVoid) return null;

  const nowIso = new Date().toISOString();
  const { error: voidErr } = await supabase
    .from('journal_entries')
    .update({
      is_void: true,
      void_reason: `Undo last mutation (${lastMut.mutation_type}) — restored previous state`,
      voided_at: nowIso,
    })
    .eq('id', jeIdToVoid)
    .eq('company_id', companyId)
    .eq('is_void', false);
  if (voidErr) {
    console.warn('[paymentLifecycleService] undo: void tail JE failed:', voidErr.message);
    return null;
  }

  const restoredFields: Record<string, unknown> = {};
  const oldState = lastMut.old_state || {};

  if (lastMut.mutation_type === 'amount_edit' && oldState.amount != null) {
    const { error: uErr } = await supabase
      .from('payments')
      .update({ amount: oldState.amount })
      .eq('id', paymentId)
      .eq('company_id', companyId);
    if (!uErr) restoredFields.amount = oldState.amount;
  }

  if (lastMut.mutation_type === 'account_change' && oldState.payment_account_id) {
    const { error: uErr } = await supabase
      .from('payments')
      .update({ payment_account_id: oldState.payment_account_id })
      .eq('id', paymentId)
      .eq('company_id', companyId);
    if (!uErr) restoredFields.payment_account_id = oldState.payment_account_id;
  }

  const { recordTransactionMutation } = await import('./transactionMutationService');
  void recordTransactionMutation({
    companyId,
    branchId: null,
    entityType: 'payment',
    entityId: paymentId,
    mutationType: 'restore',
    oldState: lastMut.new_state,
    newState: oldState,
    adjustmentJournalEntryId: jeIdToVoid,
    reason: `Undo ${lastMut.mutation_type} — reverted to previous active state`,
  });

  return {
    undoneJeId: jeIdToVoid,
    mutationType: lastMut.mutation_type,
    restoredState: restoredFields,
  };
}
