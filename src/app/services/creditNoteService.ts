/**
 * Credit Note Service
 * For sale cancellation - creates Credit Note (CN-001) and posts journal: Dr Sales Return, Cr Customer
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';

export interface CreditNote {
  id: string;
  company_id: string;
  branch_id: string;
  credit_note_no: string;
  original_sale_id: string;
  credit_note_date: string;
  amount: number;
  reason: string;
  status: 'draft' | 'final';
  created_by?: string;
  created_at?: string;
}

/**
 * Generate Credit Note number (CN-001, CN-002)
 */
async function generateCreditNoteNumber(companyId: string, branchId: string): Promise<string> {
  const { data: seq } = await supabase
    .from('document_sequences')
    .select('id, current_number, prefix, padding')
    .eq('company_id', companyId)
    .eq('document_type', 'credit_note')
    .eq('branch_id', branchId)
    .maybeSingle();

  if (!seq) {
    const { data: seqNull } = await supabase
      .from('document_sequences')
      .select('id, current_number, prefix, padding')
      .eq('company_id', companyId)
      .eq('document_type', 'credit_note')
      .is('branch_id', null)
      .maybeSingle();
    if (seqNull) {
      const next = (seqNull.current_number || 0) + 1;
      const padded = String(next).padStart(seqNull.padding || 4, '0');
      await supabase.from('document_sequences').update({ current_number: next }).eq('id', seqNull.id);
      return `${seqNull.prefix || 'CN-'}${padded}`;
    }
  }

  if (seq) {
    const next = (seq.current_number || 0) + 1;
    const padded = String(next).padStart(seq.padding || 4, '0');
    await supabase.from('document_sequences').update({ current_number: next }).eq('id', seq.id);
    return `${seq.prefix || 'CN-'}${padded}`;
  }

  // Fallback: max from credit_notes + 1
  const { data: existing } = await supabase
    .from('credit_notes')
    .select('credit_note_no')
    .eq('company_id', companyId)
    .eq('branch_id', branchId)
    .like('credit_note_no', 'CN-%')
    .order('credit_note_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxNum = existing?.credit_note_no
    ? parseInt((existing.credit_note_no as string).replace(/\D/g, ''), 10) || 0
    : 0;
  return `CN-${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * Create Credit Note and post journal entry
 * Dr Sales Return (4010/4000), Cr Accounts Receivable (1100)
 */
export async function createCreditNote(params: {
  saleId: string;
  companyId: string;
  branchId: string;
  amount: number;
  reason: string;
  performedBy?: string;
}): Promise<CreditNote> {
  const { saleId, companyId, branchId, amount, reason, performedBy } = params;

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, customer_id')
    .eq('id', saleId)
    .single();

  if (saleErr || !sale) throw new Error('Sale not found');

  const creditNoteNo = await generateCreditNoteNumber(companyId, branchId);
  const cnDate = (sale as any).invoice_date || new Date().toISOString().slice(0, 10);

  const { data: cn, error: cnErr } = await supabase
    .from('credit_notes')
    .insert({
      company_id: companyId,
      branch_id: branchId,
      credit_note_no: creditNoteNo,
      original_sale_id: saleId,
      credit_note_date: cnDate,
      amount,
      reason,
      status: 'final',
      created_by: performedBy || null,
    })
    .select()
    .single();

  if (cnErr || !cn) throw new Error('Failed to create credit note: ' + (cnErr?.message || 'Unknown'));

  // Get accounts: Sales Return (4010/4000), AR (1100)
  const salesReturnAccount = await accountHelperService.getAccountByCode('4010', companyId)
    || await accountHelperService.getAccountByCode('4000', companyId);
  const arAccount = await accountHelperService.getAccountByCode('1100', companyId);

  if (!salesReturnAccount || !arAccount) {
    throw new Error('Required accounts (Sales Return 4010/4000, AR 1100) not found. Please configure chart of accounts.');
  }

  // Create journal entry
  const entryNo = `CN-${cnDate.replace(/-/g, '')}-${creditNoteNo}`;
  const description = `Credit Note ${creditNoteNo} – Reversal of ${(sale as any).invoice_no || saleId} (Cancelled)`;

  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      company_id: companyId,
      branch_id: branchId,
      entry_no: entryNo,
      entry_date: cnDate,
      description,
      reference_type: 'credit_note',
      reference_id: cn.id,
      created_by: performedBy || null,
    })
    .select()
    .single();

  if (jeErr || !je) {
    console.error('[CREDIT NOTE] Journal entry failed:', jeErr);
    throw new Error('Credit note created but journal entry failed: ' + (jeErr?.message || 'Unknown'));
  }

  // Journal lines: Dr Sales Return, Cr AR
  const { error: line1Err } = await supabase.from('journal_entry_lines').insert({
    journal_entry_id: je.id,
    account_id: salesReturnAccount.id,
    debit: amount,
    credit: 0,
    description: `Sales Return – ${creditNoteNo}`,
  });
  if (line1Err) throw new Error('Journal line 1 failed: ' + line1Err.message);

  const { error: line2Err } = await supabase.from('journal_entry_lines').insert({
    journal_entry_id: je.id,
    account_id: arAccount.id,
    debit: 0,
    credit: amount,
    description: `Credit AR – Reversal of ${(sale as any).invoice_no} (Cancelled)`,
  });
  if (line2Err) throw new Error('Journal line 2 failed: ' + line2Err.message);

  return cn as CreditNote;
}

/**
 * Get Credit Note by original sale ID
 */
export async function getCreditNoteBySaleId(saleId: string): Promise<CreditNote | null> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select('*')
    .eq('original_sale_id', saleId)
    .maybeSingle();

  if (error || !data) return null;
  return data as CreditNote;
}
