/**
 * Shipment GL posting via Postgres RPC (mirrors web shipmentAccountingService).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PostShipmentJournalResult {
  success: boolean;
  skipped?: boolean;
  journalEntryId?: string | null;
  entryNo?: string | null;
  error?: string | null;
  reason?: string | null;
}

export async function postSaleShipmentJournal(
  shipmentId: string,
  performedBy?: string | null,
): Promise<PostShipmentJournalResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'App not configured.' };
  }
  const { data, error } = await supabase.rpc('post_sale_shipment_journal', {
    p_shipment_id: shipmentId,
    p_performed_by: performedBy ?? null,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    success: Boolean(row.success),
    skipped: Boolean(row.skipped),
    journalEntryId: row.journal_entry_id != null ? String(row.journal_entry_id) : null,
    entryNo: row.entry_no != null ? String(row.entry_no) : null,
    error: row.error != null ? String(row.error) : null,
    reason: row.reason != null ? String(row.reason) : null,
  };
}

export async function getShipmentJournalEntry(
  shipmentId: string,
): Promise<{ entryNo: string | null; journalEntryId: string | null }> {
  if (!isSupabaseConfigured) return { entryNo: null, journalEntryId: null };
  const { data } = await supabase
    .from('journal_entries')
    .select('id, entry_no')
    .eq('reference_type', 'shipment')
    .eq('reference_id', shipmentId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { entryNo: null, journalEntryId: null };
  return {
    journalEntryId: String((data as { id: string }).id),
    entryNo: (data as { entry_no?: string }).entry_no ?? null,
  };
}
