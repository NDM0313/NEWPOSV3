import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getNextDocumentNumber } from './documentNumber';

export interface ExpenseRow {
  id: string;
  expense_no?: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  status: string;
}

export async function getExpenses(companyId: string, branchId?: string | null) {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase.from('expenses').select('id, expense_no, expense_date, category, description, amount, payment_method, status').eq('company_id', companyId).order('expense_date', { ascending: false }).limit(50);
  if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function createExpense(input: {
  companyId: string;
  branchId: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  userId: string;
  expenseDate?: string;
}) {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const expenseNo = await getNextDocumentNumber(input.companyId, input.branchId, 'expense');
  const row = {
    company_id: input.companyId,
    branch_id: input.branchId,
    expense_no: expenseNo,
    expense_date: input.expenseDate || new Date().toISOString().slice(0, 10),
    category: input.category,
    description: input.description,
    amount: input.amount,
    payment_method: input.paymentMethod,
    status: 'paid',
    created_by: input.userId,
  };
  const { data, error } = await supabase.from('expenses').insert(row).select('id, expense_no').single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
