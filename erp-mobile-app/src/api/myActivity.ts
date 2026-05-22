/**
 * Personal financial activity for workers (view_own scope).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { enrichRowsWithCreatorNames } from '../lib/resolveCreatorName';

export interface MyExpenseEntryRow {
  id: string;
  entryNo: string;
  entryDate: string;
  description: string;
  amount: number;
  referenceType: string;
  createdBy: string | null;
  createdByName?: string | null;
}

const EXPENSE_REF_TYPES = ['expense', 'expense_payment'];

/** Journal entries for expenses created by the current user (auth uid and/or profile id). */
export async function getMyExpenseJournalEntries(
  companyId: string,
  authUserId: string,
  branchId?: string | null,
  limit = 50,
  profileId?: string | null,
): Promise<{ data: MyExpenseEntryRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('journal_entries')
    .select('id, entry_no, entry_date, description, reference_type, total_debit, total_credit, created_by')
    .eq('company_id', companyId)
    .in('reference_type', EXPENSE_REF_TYPES);
  if (profileId && profileId !== authUserId) {
    q = q.or(`created_by.eq.${authUserId},created_by.eq.${profileId}`);
  } else {
    q = q.eq('created_by', authUserId);
  }
  q = q
    .or('is_void.is.null,is_void.eq.false')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (branchId && branchId !== 'all' && branchId !== 'default') {
    q = q.eq('branch_id', branchId);
  }
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    entryNo: String(r.entry_no || ''),
    entryDate: String(r.entry_date || ''),
    description: String(r.description || ''),
    amount: Number(r.total_debit || r.total_credit || 0),
    referenceType: String(r.reference_type || 'expense'),
    createdBy: (r.created_by as string | null) ?? null,
  }));
  if (!rows.length) return { data: rows, error: null };
  const mutable: Array<Record<string, unknown>> = rows.map((r) => ({ created_by: r.createdBy }));
  await enrichRowsWithCreatorNames(mutable);
  const enriched = rows.map((r, i) => ({
    ...r,
    createdByName: (mutable[i].created_by_name as string | undefined) ?? null,
  }));
  return { data: enriched, error: null };
}
