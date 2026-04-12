/**
 * Phase 4: Append-only business mutation log (transaction_mutations).
 * Not accounting truth — journal_entries remain canonical.
 */

import { supabase } from '@/lib/supabase';

export type TransactionEntityType = 'sale' | 'purchase' | 'payment' | 'expense' | 'journal' | 'transfer';

export type TransactionMutationType =
  | 'create'
  | 'update_metadata'
  | 'date_edit'
  | 'amount_edit'
  | 'qty_edit'
  | 'account_change'
  | 'contact_change'
  | 'allocation_rebuild'
  | 'reversal'
  | 'void'
  | 'restore'
  | 'status_change';

export interface RecordTransactionMutationParams {
  companyId: string;
  branchId?: string | null;
  entityType: TransactionEntityType;
  entityId: string;
  mutationType: TransactionMutationType;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  deltaAmount?: number | null;
  sourceJournalEntryId?: string | null;
  adjustmentJournalEntryId?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordTransactionMutation(params: RecordTransactionMutationParams): Promise<{ ok: boolean; error?: string }> {
  const {
    companyId,
    branchId,
    entityType,
    entityId,
    mutationType,
    oldState,
    newState,
    deltaAmount,
    sourceJournalEntryId,
    adjustmentJournalEntryId,
    actorUserId,
    reason,
    metadata,
  } = params;

  let uid = actorUserId ?? null;
  if (!uid) {
    try {
      const { data } = await supabase.auth.getUser();
      uid = (data?.user?.id as string | undefined) ?? null;
    } catch {
      uid = null;
    }
  }

  const row = {
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : null,
    entity_type: entityType,
    entity_id: entityId,
    mutation_type: mutationType,
    old_state: oldState ?? null,
    new_state: newState ?? null,
    delta_amount: deltaAmount ?? null,
    source_journal_entry_id: sourceJournalEntryId ?? null,
    adjustment_journal_entry_id: adjustmentJournalEntryId ?? null,
    actor_user_id: uid,
    reason: reason ?? null,
    metadata: metadata ?? {},
  };

  const { error } = await supabase.from('transaction_mutations').insert(row);
  if (error) {
    if (import.meta.env?.DEV) {
      console.warn('[transactionMutationService] insert skipped or failed:', error.message);
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchTransactionMutationsForEntity(
  companyId: string,
  entityType: TransactionEntityType,
  entityId: string,
  limit = 100
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const { data, error } = await supabase
    .from('transaction_mutations')
    .select('*')
    .eq('company_id', companyId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { rows: [], error: error.message };
  return { rows: (data || []) as Record<string, unknown>[] };
}

export async function fetchUnifiedFeedRow(
  companyId: string,
  entityType: string,
  entityId: string
): Promise<{ row: Record<string, unknown> | null; error?: string }> {
  const { data, error } = await supabase
    .from('v_unified_transaction_feed')
    .select('*')
    .eq('company_id', companyId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  return { row: (data as Record<string, unknown>) ?? null };
}
