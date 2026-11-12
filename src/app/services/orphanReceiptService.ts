/**
 * Orphan manual receipt detection, duplicate guard, and soft cancel/hide.
 */

import { supabase } from '@/lib/supabase';
import { getCurrentLocalTimestamp } from '@/app/utils/localDate';
import {
  ORPHAN_RECEIPT_POSTING_FAILED_REASON,
  ORPHAN_RECEIPT_VOID_REASON,
  isOrphanReceiptJournalEntry,
} from '@/app/lib/orphanReceiptPolicy';

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export type DuplicateManualReceiptMatch = {
  paymentId: string;
  referenceNumber: string;
  journalEntryId: string | null;
  isOrphan: boolean;
  createdAt: string;
};

export async function findRecentDuplicateManualReceipt(params: {
  companyId: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  paymentAccountId: string;
  windowMs?: number;
}): Promise<DuplicateManualReceiptMatch | null> {
  const {
    companyId,
    customerId,
    amount,
    paymentDate,
    paymentMethod,
    paymentAccountId,
    windowMs = DUPLICATE_WINDOW_MS,
  } = params;
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, reference_number, amount, payment_date, payment_method, payment_account_id, created_at, voided_at')
    .eq('company_id', companyId)
    .eq('contact_id', customerId)
    .eq('reference_type', 'manual_receipt')
    .eq('amount', amount)
    .eq('payment_date', paymentDate.slice(0, 10))
    .eq('payment_method', paymentMethod)
    .eq('payment_account_id', paymentAccountId)
    .is('voided_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);
  const row = (payments || [])[0] as
    | {
        id: string;
        reference_number: string;
        created_at: string;
      }
    | undefined;
  if (!row) return null;

  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, is_void')
    .eq('company_id', companyId)
    .eq('payment_id', row.id)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1);
  const je = (jes || [])[0] as { id: string } | undefined;
  let lineCount = 0;
  if (je?.id) {
    const { count } = await supabase
      .from('journal_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('journal_entry_id', je.id);
    lineCount = count ?? 0;
  }
  const isOrphan = !je || lineCount < 2;
  if (!isOrphan) {
    return {
      paymentId: row.id,
      referenceNumber: row.reference_number,
      journalEntryId: je?.id ?? null,
      isOrphan: false,
      createdAt: row.created_at,
    };
  }
  return {
    paymentId: row.id,
    referenceNumber: row.reference_number,
    journalEntryId: je?.id ?? null,
    isOrphan: true,
    createdAt: row.created_at,
  };
}

export async function cancelOrphanManualReceipt(params: {
  companyId: string;
  paymentId: string;
  reason?: string;
  actorUserId?: string | null;
}): Promise<{ paymentId: string; journalEntryIds: string[] }> {
  const { companyId, paymentId, reason = ORPHAN_RECEIPT_VOID_REASON } = params;
  if (!companyId || !paymentId) throw new Error('companyId and paymentId required');

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .select('id, voided_at, reference_number, amount')
    .eq('id', paymentId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (payErr) throw new Error(payErr.message);
  if (!payment) throw new Error('Payment not found');
  if ((payment as { voided_at?: string | null }).voided_at) {
    return { paymentId, journalEntryIds: [] };
  }

  const { data: jes, error: jeErr } = await supabase
    .from('journal_entries')
    .select('id, reference_type, payment_id, is_void')
    .eq('company_id', companyId)
    .eq('payment_id', paymentId);
  if (jeErr) throw new Error(jeErr.message);

  for (const je of jes || []) {
    const { count } = await supabase
      .from('journal_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('journal_entry_id', (je as { id: string }).id);
    const lineCount = count ?? 0;
    if (
      !isOrphanReceiptJournalEntry({
        reference_type: (je as { reference_type?: string }).reference_type,
        payment_id: paymentId,
        is_void: (je as { is_void?: boolean }).is_void,
        journalLineCount: lineCount,
      }) &&
      lineCount >= 2
    ) {
      throw new Error(
        `Cannot soft-cancel ${(payment as { reference_number?: string }).reference_number ?? paymentId}: posted GL lines exist.`,
      );
    }
  }

  const { count: allocCount, error: allocErr } = await supabase
    .from('payment_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('payment_id', paymentId);
  if (allocErr) throw new Error(allocErr.message);
  if ((allocCount ?? 0) > 0) {
    throw new Error('Cannot soft-cancel orphan receipt: invoice allocations exist.');
  }

  const nowIso = getCurrentLocalTimestamp();
  const { error: delAllocErr } = await supabase.from('payment_allocations').delete().eq('payment_id', paymentId);
  if (delAllocErr) throw new Error(delAllocErr.message);

  const { error: voidPayErr } = await supabase
    .from('payments')
    .update({ voided_at: nowIso })
    .eq('id', paymentId)
    .eq('company_id', companyId);
  if (voidPayErr) throw new Error(voidPayErr.message);

  const journalEntryIds: string[] = [];
  for (const je of jes || []) {
    const jeId = (je as { id: string }).id;
    if ((je as { is_void?: boolean }).is_void === true) continue;
    const { error: voidJeErr } = await supabase
      .from('journal_entries')
      .update({ is_void: true, void_reason: reason, voided_at: nowIso })
      .eq('id', jeId)
      .eq('company_id', companyId);
    if (voidJeErr) throw new Error(voidJeErr.message);
    journalEntryIds.push(jeId);
  }

  try {
    const { logPaymentAction } = await import('@/app/services/auditLogService');
    void logPaymentAction(companyId, paymentId, 'voided', {
      reason,
      orphan_cleanup: true,
      journal_entry_ids: journalEntryIds,
    });
  } catch {
    /* audit optional */
  }

  return { paymentId, journalEntryIds };
}

export async function rollbackFailedCustomerReceiptAttempt(params: {
  companyId: string;
  paymentId: string;
}): Promise<void> {
  await cancelOrphanManualReceipt({
    companyId: params.companyId,
    paymentId: params.paymentId,
    reason: ORPHAN_RECEIPT_POSTING_FAILED_REASON,
  });
}
