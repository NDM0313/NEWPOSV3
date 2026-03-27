/**
 * Keeps journal_entries.entry_date aligned with source document / payment business dates.
 * Never touches created_at (posted/system timestamp).
 */

import { supabase } from '@/lib/supabase';

const VOID_FILTER = 'is_void.is.null,is_void.eq.false';

export async function syncJournalEntryDateByDocumentRefs(params: {
  companyId: string;
  referenceTypes: string[];
  referenceId: string;
  entryDate: string;
}): Promise<{ updated: number; error?: string }> {
  const { companyId, referenceTypes, referenceId, entryDate } = params;
  if (!companyId || !referenceId || !referenceTypes.length) return { updated: 0 };
  const date = String(entryDate).slice(0, 10);

  const { data: rows, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .in('reference_type', referenceTypes)
    .eq('reference_id', referenceId)
    .or(VOID_FILTER);

  if (error) return { updated: 0, error: error.message };
  const ids = (rows || []).map((r: { id: string }) => r.id).filter(Boolean);
  if (!ids.length) return { updated: 0 };

  const { error: upErr } = await supabase
    .from('journal_entries')
    .update({ entry_date: date })
    .in('id', ids)
    .eq('company_id', companyId);

  if (upErr) return { updated: 0, error: upErr.message };
  return { updated: ids.length };
}

/** All active journal rows linked to a payments row (primary payment JE + adjustment thread uses payment_id or reference_id = payment id). */
export async function syncJournalEntryDateByPaymentId(params: {
  companyId: string;
  paymentId: string;
  entryDate: string;
}): Promise<{ updated: number; error?: string }> {
  const { companyId, paymentId, entryDate } = params;
  if (!companyId || !paymentId) return { updated: 0 };
  const date = String(entryDate).slice(0, 10);

  const { data: byPay, error: e1 } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('payment_id', paymentId)
    .or(VOID_FILTER);

  if (e1) return { updated: 0, error: e1.message };

  const { data: byRef, error: e2 } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_id', paymentId)
    .in('reference_type', ['payment', 'payment_adjustment'])
    .or(VOID_FILTER);

  if (e2) return { updated: 0, error: e2.message };

  const idSet = new Set<string>();
  (byPay || []).forEach((r: { id: string }) => idSet.add(r.id));
  (byRef || []).forEach((r: { id: string }) => idSet.add(r.id));
  const ids = [...idSet];
  if (!ids.length) return { updated: 0 };

  const { error: upErr } = await supabase
    .from('journal_entries')
    .update({ entry_date: date })
    .in('id', ids)
    .eq('company_id', companyId);

  if (upErr) return { updated: 0, error: upErr.message };
  return { updated: ids.length };
}
