import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { listCacheKeys } from '../lib/listCache';
import { readThroughCache } from '../lib/offlineData';
import { localNowDateString } from '../utils/localDate';
import { resolveBranchUuidForWrite } from '../utils/branchId';
import {
  classifyStorageUploadError,
  type StorageUploadErrorKind,
  storageErrorStatus,
} from '../utils/storageUploadErrors';
import { storageUploadBody } from '../utils/storageUploadBody';
import { storageRefForPersistence } from '../utils/storageDisplayUrl';
import { UPLOAD_TIMEOUT_MS, withUploadTimeout } from '../utils/uploadWithTimeout';

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

export interface ExpenseRow {
  id: string;
  expense_no?: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  status: string;
  created_by?: string | null;
  paid_to_user_id?: string | null;
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

export async function getExpenses(
  companyId: string,
  branchId?: string | null,
  options?: { accessibleBranchIds?: string[] },
) {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const branchKey =
    branchId && branchId !== 'all' && branchId !== 'default'
      ? branchId
      : options?.accessibleBranchIds?.length
        ? `acc:${[...options.accessibleBranchIds].sort().join(',')}`
        : 'all';
  const cacheKey = listCacheKeys.expenses(companyId, branchKey);
  const cached = await readThroughCache(
    cacheKey,
    async () => fetchExpensesOnline(companyId, branchId, options?.accessibleBranchIds),
    [],
  );
  return { data: cached.data, error: cached.error };
}

async function fetchExpensesOnline(
  companyId: string,
  branchId?: string | null,
  accessibleBranchIds?: string[],
) {
  let q = supabase
    .from('expenses')
    .select('id, expense_no, expense_date, category, description, amount, payment_method, status, created_by, paid_to_user_id, branch_id, created_at')
    .eq('company_id', companyId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (branchId && branchId !== 'all' && branchId !== 'default') {
    q = q.eq('branch_id', branchId);
  } else if (accessibleBranchIds?.length) {
    q = q.in('branch_id', accessibleBranchIds);
  }
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
    effectiveBranchId = await resolveBranchUuidForWrite(
      input.companyId,
      input.branchId,
      'No branch set up. Add a branch in Settings to create expenses.',
    );
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

let expenseReceiptBucketPreflight: Promise<boolean> | null = null;

function isDevBuild(): boolean {
  return Boolean(
    typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
  );
}

function resolveReceiptContentType(file: File, fromBody: string): string {
  if (fromBody?.trim()) return fromBody.trim();
  const name = (file.name || '').toLowerCase();
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

async function ensureExpenseReceiptBucketExists(): Promise<{ ok: true } | { ok: false; error: string; kind: StorageUploadErrorKind }> {
  if (!expenseReceiptBucketPreflight) {
    expenseReceiptBucketPreflight = (async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        if (isDevBuild()) {
          console.warn('[uploadExpenseReceipt] listBuckets failed', {
            status: storageErrorStatus(error),
            message: error.message,
          });
        }
        return true;
      }
      return (data ?? []).some((b) => b.name === EXPENSE_RECEIPT_BUCKET);
    })();
  }
  const exists = await expenseReceiptBucketPreflight;
  if (exists) return { ok: true };
  const classified = classifyStorageUploadError(
    { statusCode: 400, message: 'Bucket not found', error: 'Bucket not found' },
    'receipt',
  );
  return { ok: false, error: classified.userMessage, kind: classified.kind };
}

export interface ExpenseReceiptUploadResult {
  url: string | null;
  error: string | null;
  kind?: StorageUploadErrorKind;
}

/** Upload one receipt/bill file to storage; returns public URL or null on failure. */
export async function uploadExpenseReceipt(
  companyId: string,
  file: File | null | undefined,
): Promise<ExpenseReceiptUploadResult> {
  if (!file) return { url: null, error: null };
  if (file.size === 0) {
    return { url: null, error: 'Receipt file is empty. Try again or save without attachment.' };
  }
  if (!isSupabaseConfigured) return { url: null, error: 'App not configured.' };
  if (file.size > MAX_RECEIPT_BYTES) return { url: null, error: 'File too large. Max 5MB.' };

  const bucketCheck = await ensureExpenseReceiptBucketExists();
  if (!bucketCheck.ok) {
    return { url: null, error: bucketCheck.error, kind: bucketCheck.kind };
  }

  const safeName = (file.name || 'receipt').replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${companyId}/receipts/${Date.now()}_${safeName}`;
  try {
    const { body, contentType: rawType } = await storageUploadBody(file);
    const contentType = resolveReceiptContentType(file, rawType);
    const { error } = await withUploadTimeout(
      supabase.storage.from(EXPENSE_RECEIPT_BUCKET).upload(path, body, {
        upsert: true,
        contentType,
      }),
      UPLOAD_TIMEOUT_MS,
      `Upload ${file.name || 'receipt'}`,
    );
    if (error) {
      if (isDevBuild()) {
        console.warn('[uploadExpenseReceipt]', {
          status: storageErrorStatus(error),
          message: error.message,
          error,
        });
      }
      const classified = classifyStorageUploadError(error, file.name || 'receipt');
      return { url: null, error: classified.userMessage, kind: classified.kind };
    }
    return { url: storageRefForPersistence(EXPENSE_RECEIPT_BUCKET, path), error: null };
  } catch (err) {
    if (isDevBuild()) {
      console.warn('[uploadExpenseReceipt]', err);
    }
    const classified = classifyStorageUploadError(err, file.name || 'receipt');
    return { url: null, error: classified.userMessage, kind: classified.kind };
  }
}
