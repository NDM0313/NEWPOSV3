import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { listCacheKeys } from '../lib/listCache';
import { readThroughCache } from '../lib/offlineData';
import { localNowDateString } from '../utils/localDate';

/** DB / RPC expect cash | bank | card | other — wallet accounts must map to other. */
function normalizeExpensePaymentMethodForDb(raw: string | undefined): string {
  const m = (raw || 'cash').toLowerCase().trim();
  if (m === 'bank') return 'bank';
  if (m === 'card') return 'card';
  if (m === 'wallet' || m === 'mobile_wallet' || m === 'other') return 'other';
  return 'cash';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeUuid(v: string | null | undefined): string | null {
  if (v == null || typeof v !== 'string') return null;
  const t = v.trim();
  return UUID_RE.test(t) ? t : null;
}

async function resolveBranchId(companyId: string, branchId: string): Promise<string> {
  if (branchId && branchId !== 'default') return branchId;
  const { data } = await supabase.from('branches').select('id').eq('company_id', companyId).limit(1).maybeSingle();
  const first = data?.id ?? null;
  if (!first) throw new Error('No branch set up. Add a branch in Settings to create expenses.');
  return first;
}

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
  const branchKey =
    branchId && branchId !== 'all' && branchId !== 'default' ? branchId : 'all';
  const cacheKey = listCacheKeys.expenses(companyId, branchKey);
  const cached = await readThroughCache(
    cacheKey,
    async () => fetchExpensesOnline(companyId, branchId),
    [],
  );
  return { data: cached.data, error: cached.error };
}

async function fetchExpensesOnline(companyId: string, branchId?: string | null) {
  let q = supabase
    .from('expenses')
    .select('id, expense_no, expense_date, category, description, amount, payment_method, status')
    .eq('company_id', companyId)
    .order('expense_date', { ascending: false })
    .limit(50);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
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
  /** Salary expense: `users.id` payee (RPC insert may omit; patched client-side). */
  paidToUserId?: string | null;
  /** Display / vendor line (maps to `vendor_name` when column exists). */
  payeeName?: string | null;
}) {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  let effectiveBranchId: string;
  try {
    effectiveBranchId = await resolveBranchId(input.companyId, input.branchId);
  } catch (err) {
    return { data: null, error: (err as Error).message ?? 'Failed to resolve branch.' };
  }
  const paymentMethod = normalizeExpensePaymentMethodForDb(input.paymentMethod);

  const expensePayload: Record<string, unknown> = {
    expense_date: input.expenseDate || localNowDateString(),
    category: input.category,
    description: input.description,
    amount: input.amount,
    payment_method: paymentMethod,
  };
  const payAcct = sanitizeUuid(input.paymentAccountId ?? null);
  if (payAcct) expensePayload.payment_account_id = payAcct;
  const receipt = (input.receiptUrl ?? '').trim();
  if (receipt) expensePayload.receipt_url = receipt;

  const callRpc = async (payload: Record<string, unknown>) =>
    supabase.rpc('create_expense_document', {
      p_company_id: input.companyId,
      p_branch_id: effectiveBranchId,
      p_expense: payload,
      p_created_by: input.userId,
    });

  let call = await callRpc(expensePayload);
  let rpcRaw = call.data;
  let rpcErr = call.error;

  if (rpcErr) {
    const msg = String(rpcErr.message || '').toLowerCase();
    const schemaMissing =
      msg.includes('payment_account_id') || msg.includes('receipt_url') || (msg.includes('column') && msg.includes('schema'));
    if (schemaMissing && (payAcct || receipt)) {
      const fallback = { ...expensePayload };
      delete fallback.payment_account_id;
      delete fallback.receipt_url;
      call = await callRpc(fallback);
      rpcRaw = call.data;
      rpcErr = call.error;
    }
  }

  if (rpcErr) return { data: null, error: rpcErr.message };

  const rpc = rpcRaw as { success?: boolean; expense_id?: string; expense_no?: string; error?: string } | null;
  if (!rpc?.success || !rpc.expense_id) {
    return { data: null, error: rpc?.error ?? 'Failed to create expense.' };
  }

  const result = { data: { id: rpc.expense_id, expense_no: rpc.expense_no } };

  // Accounting: post journal entry (Dr mapped expense account, Cr payment
  // account). Soft-warn on failure.
  try {
    const expenseId = rpc.expense_id;
    if (expenseId) {
      const { data: postData, error: postErr } = await supabase.rpc(
        'record_expense_with_accounting',
        { p_expense_id: expenseId },
      );
      if (postErr) {
        console.warn('[EXPENSES API] record_expense_with_accounting failed:', postErr);
      } else if (postData && typeof postData === 'object' && (postData as { success?: boolean }).success === false) {
        console.warn('[EXPENSES API] record_expense_with_accounting returned error:', postData);
      }
    }
  } catch (err) {
    console.warn('[EXPENSES API] record_expense_with_accounting threw:', err);
  }

  const expenseId = rpc.expense_id;
  const patch: Record<string, unknown> = {};
  const paidUid = sanitizeUuid(input.paidToUserId ?? null);
  if (paidUid) patch.paid_to_user_id = paidUid;
  const vendor = (input.payeeName ?? '').trim().slice(0, 255);
  if (vendor) patch.vendor_name = vendor;

  if (expenseId && Object.keys(patch).length > 0) {
    let upd = await supabase.from('expenses').update(patch).eq('id', expenseId).eq('company_id', input.companyId);
    if (upd.error) {
      const msg = String(upd.error.message || '').toLowerCase();
      if ((msg.includes('vendor_name') || msg.includes('schema cache')) && 'vendor_name' in patch) {
        const { vendor_name: _drop, ...withoutVendor } = patch;
        if (Object.keys(withoutVendor).length > 0) {
          upd = await supabase
            .from('expenses')
            .update(withoutVendor)
            .eq('id', expenseId)
            .eq('company_id', input.companyId);
        }
      }
      if (upd.error) {
        return {
          data: null,
          error: `Expense was created but payee could not be saved: ${upd.error.message}. You can edit the expense in the web app.`,
        };
      }
    }
  }

  return { data: result.data, error: null };
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
