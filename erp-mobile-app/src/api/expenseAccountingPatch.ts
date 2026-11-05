import { supabase } from '../lib/supabase';

const CAT_ACCOUNT_MAP: Record<string, string> = {
  salaries: '6110',
  salary: '6110',
  wages: '6110',
  marketing: '6120',
  advertising: '6120',
  rent: '6100',
  utilities: '6100',
  office: '6100',
  shipping: '5100',
  freight: '5100',
  courier: '5100',
  production: '5000',
  manufacturing: '5000',
};

export interface ExpenseJournalPatchInput {
  companyId: string;
  expenseId: string;
  oldAmount: number;
  newAmount: number;
  category: string;
  description: string;
  expenseDate?: string;
}

/** In-place JE line update for paid expense edits (matches web ExpenseContext path). */
export async function patchExpenseJournalInPlace(
  input: ExpenseJournalPatchInput,
): Promise<{ ok: boolean; error?: string }> {
  const amountChanged = Math.abs(input.newAmount - input.oldAmount) > 0.005;
  if (!amountChanged) return { ok: true };

  const { data: jeRow } = await supabase
    .from('journal_entries')
    .select('id, description')
    .eq('company_id', input.companyId)
    .eq('reference_type', 'expense')
    .eq('reference_id', input.expenseId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const jeId = (jeRow as { id?: string; description?: string } | null)?.id;
  if (!jeId) return { ok: true };

  const newAmount = Number(input.newAmount) || 0;
  const catLower = String(input.category || '').toLowerCase();
  const targetCode = CAT_ACCOUNT_MAP[catLower] || '6100';
  const { data: targetAcct } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', targetCode)
    .eq('company_id', input.companyId)
    .eq('is_active', true)
    .maybeSingle();

  const debitUpdate: Record<string, unknown> = { debit: newAmount };
  if (targetAcct?.id) debitUpdate.account_id = targetAcct.id;

  const { error: debitErr } = await supabase
    .from('journal_entry_lines')
    .update(debitUpdate)
    .eq('journal_entry_id', jeId)
    .gt('debit', 0);
  if (debitErr) return { ok: false, error: debitErr.message };

  const { error: creditErr } = await supabase
    .from('journal_entry_lines')
    .update({ credit: newAmount })
    .eq('journal_entry_id', jeId)
    .gt('credit', 0);
  if (creditErr) return { ok: false, error: creditErr.message };

  const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
  const oldDesc = (jeRow as { description?: string })?.description || '';
  const newDesc = input.description || input.category || oldDesc;
  const editNote = `[Edited ${ts}: Rs ${Number(input.oldAmount || 0).toLocaleString()} → Rs ${newAmount.toLocaleString()}]`;

  const { error: jeErr } = await supabase
    .from('journal_entries')
    .update({
      description: `${newDesc} ${editNote}`.slice(0, 500),
      ...(input.expenseDate ? { entry_date: input.expenseDate } : {}),
    })
    .eq('id', jeId);
  if (jeErr) return { ok: false, error: jeErr.message };

  return { ok: true };
}
