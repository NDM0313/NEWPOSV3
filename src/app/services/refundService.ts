/**
 * Refund Service
 * When cancelled sale had payments - refund returns money to customer
 * Journal: Dr AR (Customer), Cr Cash/Bank
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';

export interface Refund {
  id: string;
  company_id: string;
  branch_id: string;
  refund_no: string;
  credit_note_id: string;
  customer_id?: string;
  amount: number;
  refund_date: string;
  payment_method: string;
  account_id?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

/**
 * Generate Refund number (RF-001, RF-002)
 */
async function generateRefundNumber(companyId: string, branchId: string): Promise<string> {
  const { data: seq } = await supabase
    .from('document_sequences')
    .select('id, current_number, prefix, padding')
    .eq('company_id', companyId)
    .eq('document_type', 'refund')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
    .order('branch_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (seq) {
    const next = (seq.current_number || 0) + 1;
    const padded = String(next).padStart(seq.padding || 4, '0');
    await supabase.from('document_sequences').update({ current_number: next }).eq('id', seq.id);
    return `${seq.prefix || 'RF-'}${padded}`;
  }

  const { data: existing } = await supabase
    .from('refunds')
    .select('refund_no')
    .eq('company_id', companyId)
    .eq('branch_id', branchId)
    .like('refund_no', 'RF-%')
    .order('refund_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxNum = existing?.refund_no
    ? parseInt((existing.refund_no as string).replace(/\D/g, ''), 10) || 0
    : 0;
  return `RF-${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * Create Refund and post journal: Dr AR, Cr Cash/Bank
 */
export async function createRefund(params: {
  creditNoteId: string;
  companyId: string;
  branchId: string;
  customerId?: string;
  amount: number;
  paymentMethod: string;
  accountId?: string;
  notes?: string;
  performedBy?: string;
}): Promise<Refund> {
  const {
    creditNoteId,
    companyId,
    branchId,
    customerId,
    amount,
    paymentMethod,
    accountId,
    notes,
    performedBy,
  } = params;

  const refundNo = await generateRefundNumber(companyId, branchId);
  const refundDate = new Date().toISOString().slice(0, 10);

  const resolvedAccountId =
    accountId || (await accountHelperService.getDefaultAccountByPaymentMethod(paymentMethod, companyId));

  if (!resolvedAccountId) {
    throw new Error(`No account found for payment method "${paymentMethod}". Please configure default accounts.`);
  }

  const arAccount = await accountHelperService.getAccountByCode('1100', companyId);
  if (!arAccount) throw new Error('Accounts Receivable (1100) not found.');

  const { data: refund, error: refundErr } = await supabase
    .from('refunds')
    .insert({
      company_id: companyId,
      branch_id: branchId,
      refund_no: refundNo,
      credit_note_id: creditNoteId,
      customer_id: customerId || null,
      amount,
      refund_date: refundDate,
      payment_method: paymentMethod,
      account_id: resolvedAccountId,
      notes: notes || null,
      created_by: performedBy || null,
    })
    .select()
    .single();

  if (refundErr || !refund) throw new Error('Failed to create refund: ' + (refundErr?.message || 'Unknown'));

  // Journal: Dr AR, Cr Cash/Bank
  const entryNo = `RF-${refundDate.replace(/-/g, '')}-${refundNo}`;
  const description = `Refund ${refundNo} – Against Credit Note`;

  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      company_id: companyId,
      branch_id: branchId,
      entry_no: entryNo,
      entry_date: refundDate,
      description,
      reference_type: 'refund',
      reference_id: refund.id,
      created_by: performedBy || null,
    })
    .select()
    .single();

  if (jeErr || !je) {
    console.error('[REFUND] Journal entry failed:', jeErr);
    throw new Error('Refund created but journal entry failed: ' + (jeErr?.message || 'Unknown'));
  }

  const { error: line1Err } = await supabase.from('journal_entry_lines').insert({
    journal_entry_id: je.id,
    account_id: arAccount.id,
    debit: amount,
    credit: 0,
    description: `Refund – ${refundNo}`,
  });
  if (line1Err) throw new Error('Refund journal line 1 failed: ' + line1Err.message);

  const { error: line2Err } = await supabase.from('journal_entry_lines').insert({
    journal_entry_id: je.id,
    account_id: resolvedAccountId,
    debit: 0,
    credit: amount,
    description: `Refund payment – ${refundNo}`,
  });
  if (line2Err) throw new Error('Refund journal line 2 failed: ' + line2Err.message);

  return refund as Refund;
}

/**
 * Get refunds by credit note ID (for display in cancelled sale view)
 */
export async function getRefundsByCreditNoteId(creditNoteId: string): Promise<Refund[]> {
  const { data, error } = await supabase
    .from('refunds')
    .select('*')
    .eq('credit_note_id', creditNoteId)
    .order('refund_date', { ascending: false });

  if (error) {
    console.error('[REFUND] Error fetching refunds by credit note:', error);
    return [];
  }
  return (data || []) as Refund[];
}
