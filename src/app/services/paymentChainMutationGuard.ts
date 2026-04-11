/**
 * Server-side / modal guard: block edit & reversal on superseded payment chain rows.
 */

import { supabase } from '@/lib/supabase';

export const HISTORICAL_PREFIX = 'PAYMENT_CHAIN_HISTORICAL:';

export function extractPaymentChainIdFromJournalRow(je: {
  payment_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}): string | null {
  const pid = String(je.payment_id || '').trim();
  if (pid) return pid;
  if (String(je.reference_type || '').toLowerCase() === 'payment_adjustment' && je.reference_id) {
    return String(je.reference_id).trim();
  }
  return null;
}

type ChainJeRow = {
  id: string;
  created_at?: string | null;
  is_void?: boolean | null;
  reference_type?: string | null;
};

/** Active PF-14 chain members (primary + payment_adjustment), excluding void and correction_reversal, oldest→newest. */
export async function fetchPaymentChainActiveEntries(
  companyId: string,
  paymentId: string
): Promise<ChainJeRow[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, created_at, payment_id, reference_type, reference_id, is_void')
    .eq('company_id', companyId)
    .or(`payment_id.eq.${paymentId},and(reference_type.eq.payment_adjustment,reference_id.eq.${paymentId})`);
  if (error || !data?.length) return [];
  const active = (data as ChainJeRow[]).filter(
    (e) =>
      e.is_void !== true && String(e.reference_type || '').toLowerCase() !== 'correction_reversal'
  );
  active.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  return active;
}

export async function fetchPaymentChainState(
  companyId: string,
  paymentId: string
): Promise<{ tailJournalId: string | null; memberCount: number }> {
  const active = await fetchPaymentChainActiveEntries(companyId, paymentId);
  const tail = active.length ? active[active.length - 1] : null;
  return { tailJournalId: tail?.id ?? null, memberCount: active.length };
}

/** Latest active journal row id for this payment chain (primary + PF-14 adjustments), by created_at. */
export async function fetchPaymentChainTailJournalEntryId(
  companyId: string,
  paymentId: string
): Promise<string | null> {
  const s = await fetchPaymentChainState(companyId, paymentId);
  return s.tailJournalId;
}

/** Human message, or null if this JE may be edited/reversed from a chain perspective. */
export async function getPaymentChainMutationBlockReason(
  companyId: string,
  journalEntryId: string
): Promise<string | null> {
  const { data: je, error } = await supabase
    .from('journal_entries')
    .select('id, payment_id, reference_type, reference_id, is_void')
    .eq('company_id', companyId)
    .eq('id', journalEntryId)
    .maybeSingle();
  if (error || !je || je.is_void === true) return null;
  const pid = extractPaymentChainIdFromJournalRow(je as any);
  if (!pid) return null;
  const tail = await fetchPaymentChainTailJournalEntryId(companyId, pid);
  if (tail && tail !== journalEntryId) {
    return 'This payment line is historical (a later edit or transfer exists). Use the latest journal row for this receipt to edit or reverse — reversing an older line would use the wrong amount or accounts.';
  }
  return null;
}

export function isPaymentChainHistoricalErrorMessage(msg: string | undefined): boolean {
  return Boolean(msg && msg.startsWith(HISTORICAL_PREFIX));
}

export function stripPaymentChainHistoricalPrefix(msg: string): string {
  return msg.startsWith(HISTORICAL_PREFIX) ? msg.slice(HISTORICAL_PREFIX.length) : msg;
}
