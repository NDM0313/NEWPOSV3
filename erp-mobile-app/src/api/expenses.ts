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

/** Expense category from DB (optional table); supports parent/child. */
export interface ExpenseCategoryRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type?: string;
  color?: string;
  icon?: string;
  description?: string | null;
}

export interface ExpenseCategoryTreeItem extends ExpenseCategoryRow {
  children: ExpenseCategoryTreeItem[];
  isMain: boolean;
}

export async function getExpenses(companyId: string, branchId?: string | null) {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase.from('expenses').select('id, expense_no, expense_date, category, description, amount, payment_method, status').eq('company_id', companyId).order('expense_date', { ascending: false }).limit(50);
  if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

/** Get expense categories (flat). Returns [] if table does not exist. */
export async function getExpenseCategories(companyId: string): Promise<{ data: ExpenseCategoryRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, company_id, name, slug, parent_id, type, color, icon, description')
    .eq('company_id', companyId)
    .order('name');
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) return { data: [], error: null };
    return { data: [], error: error.message };
  }
  return { data: (data || []) as ExpenseCategoryRow[], error: null };
}

/** Get category tree (main + children). Uses getExpenseCategories. */
export async function getExpenseCategoryTree(companyId: string): Promise<{ data: ExpenseCategoryTreeItem[]; error: string | null }> {
  const { data: list, error } = await getExpenseCategories(companyId);
  if (error || !list.length) return { data: [], error };
  const main = list.filter((c) => !c.parent_id);
  const byParent: Record<string, ExpenseCategoryRow[]> = {};
  list.forEach((c) => {
    if (c.parent_id) {
      if (!byParent[c.parent_id]) byParent[c.parent_id] = [];
      byParent[c.parent_id].push(c);
    }
  });
  const build = (row: ExpenseCategoryRow): ExpenseCategoryTreeItem => ({
    ...row,
    children: (byParent[row.id] || []).map(build),
    isMain: !row.parent_id,
  });
  return { data: main.map(build), error: null };
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
  /** Account (Cash/Bank) UUID from accounts table */
  paymentAccountId?: string | null;
  /** Receipt/bill attachment URL after upload to storage */
  receiptUrl?: string | null;
}) {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const expenseNo = await getNextDocumentNumber(input.companyId, input.branchId, 'expense');
  const paymentMethod = (input.paymentMethod || 'cash').toLowerCase();
  const row: Record<string, unknown> = {
    company_id: input.companyId,
    branch_id: input.branchId,
    expense_no: expenseNo,
    expense_date: input.expenseDate || new Date().toISOString().slice(0, 10),
    category: input.category,
    description: input.description,
    amount: input.amount,
    payment_method: paymentMethod,
    status: 'paid',
    created_by: input.userId,
  };
  if (input.paymentAccountId) row.payment_account_id = input.paymentAccountId;
  if (input.receiptUrl) row.receipt_url = input.receiptUrl;
  const { data, error } = await supabase.from('expenses').insert(row).select('id, expense_no').single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

const EXPENSE_RECEIPT_BUCKET = 'expense-receipts';
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5MB

/** Upload one receipt/bill file to storage; returns public URL or null on failure. */
export async function uploadExpenseReceipt(
  companyId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { url: null, error: 'App not configured.' };
  if (file.size > MAX_RECEIPT_BYTES) return { url: null, error: 'File too large. Max 5MB.' };
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${companyId}/receipts/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(EXPENSE_RECEIPT_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    const bucketMissing = msg.includes('bucket') && (msg.includes('not found') || msg.includes('does not exist'));
    return {
      url: null,
      error: bucketMissing
        ? `Storage bucket "expense-receipts" not found. Create it in Supabase Dashboard → Storage, then run migration 51_expense_receipts_storage.sql. You can save the expense without the attachment.`
        : error.message,
    };
  }
  const { data: urlData } = supabase.storage.from(EXPENSE_RECEIPT_BUCKET).getPublicUrl(path);
  return { url: urlData?.publicUrl ?? path, error: null };
}
