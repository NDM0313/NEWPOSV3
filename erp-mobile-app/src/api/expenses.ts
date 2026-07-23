import { Capacitor } from '@capacitor/core';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatNetworkFetchError, isNetworkFetchError } from '../utils/networkErrorMessages';
import { listCacheKeys } from '../lib/listCache';
import { readThroughCache } from '../lib/offlineData';
import { localNowDateString, getCurrentLocalTimestamp } from '../utils/localDate';
import { resolveBranchUuidForWrite } from '../utils/branchId';
import {
  classifyStorageUploadError,
  type StorageUploadErrorKind,
} from '../utils/storageUploadErrors';
import { UPLOAD_TIMEOUT_MS, withUploadTimeout } from '../utils/uploadWithTimeout';
import {
  ATTACHMENT_UPLOAD_VERIFY_FAIL_MSG,
  uploadStorageAttachmentFile,
} from '../utils/storageAttachmentPipeline';
import { filterClearingLinesByCategory } from '../lib/saleChargeDisplay';
import {
  enrichExpenseRowsWithPostedPaymentAccount,
  postedPaymentAccountIdFromRow,
  postedPaymentDisplayFromRow,
} from '../lib/resolveExpensePaymentAccount';
import { patchExpenseJournalInPlace } from './expenseAccountingPatch';

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
  payment_account_id?: string | null;
  payment_account_display?: string;
  receipt_url?: string | null;
  status: string;
  created_by?: string | null;
  created_by_name?: string | null;
  paid_to_user_id?: string | null;
  expense_category_id?: string | null;
  vendor_name?: string | null;
  branch_id?: string | null;
  created_at?: string;
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
  if (
    (!branchId || branchId === 'all' || branchId === 'default') &&
    options?.accessibleBranchIds !== undefined &&
    options.accessibleBranchIds.length === 0
  ) {
    return { data: [], error: 'No branch access configured for your account.' };
  }

  const cacheKey = listCacheKeys.expenses(companyId, branchKey);
  const cached = await readThroughCache(
    cacheKey,
    async () => fetchExpensesOnline(companyId, branchId, options?.accessibleBranchIds),
    [],
  );
  if (cached.error && (!cached.data || cached.data.length === 0)) {
    return { data: [], error: formatNetworkFetchError(cached.error) };
  }
  return {
    data: cached.data ?? [],
    error: cached.error ? formatNetworkFetchError(cached.error) : null,
  };
}

async function enrichExpenseRowsWithCreatorNames(rows: Record<string, unknown>[]): Promise<void> {
  const ids = [...new Set(rows.map((e) => e.created_by).filter(Boolean))] as string[];
  if (ids.length === 0) return;
  const nameByCreatedBy = new Map<string, string>();
  const { data: usersByAuth } = await supabase.from('users').select('auth_user_id, full_name, email').in('auth_user_id', ids);
  (usersByAuth || []).forEach((u: { auth_user_id?: string; full_name?: string; email?: string }) => {
    if (u?.auth_user_id) nameByCreatedBy.set(u.auth_user_id, u.full_name || u.email || '');
  });
  const missing = ids.filter((id) => !nameByCreatedBy.has(id));
  if (missing.length > 0) {
    const { data: usersById } = await supabase.from('users').select('id, full_name, email').in('id', missing);
    (usersById || []).forEach((u: { id?: string; full_name?: string; email?: string }) => {
      if (u?.id) nameByCreatedBy.set(u.id, u.full_name || u.email || '');
    });
  }
  rows.forEach((e) => {
    const uid = e.created_by;
    if (uid && typeof uid === 'string') {
      e.created_by_name = nameByCreatedBy.get(uid) || null;
    }
  });
}

function mapExpenseRow(raw: Record<string, unknown>): ExpenseRow {
  const paymentAccount = raw.payment_account as { code?: string; name?: string; type?: string } | null | undefined;
  const postedAccount = raw.posted_payment_account as { code?: string; name?: string; type?: string } | null | undefined;
  const display = postedPaymentDisplayFromRow({
    payment_account: paymentAccount,
    payment_account_id: raw.payment_account_id != null ? String(raw.payment_account_id) : null,
    payment_method: raw.payment_method != null ? String(raw.payment_method) : null,
    posted_payment_account: postedAccount,
    posted_payment_account_id: raw.posted_payment_account_id != null ? String(raw.posted_payment_account_id) : null,
    posted_payment_display: raw.posted_payment_display != null ? String(raw.posted_payment_display) : undefined,
  });
  const resolvedPayId = postedPaymentAccountIdFromRow({
    payment_account_id: raw.payment_account_id != null ? String(raw.payment_account_id) : null,
    payment_account: paymentAccount,
    posted_payment_account_id: raw.posted_payment_account_id != null ? String(raw.posted_payment_account_id) : null,
    posted_payment_account: postedAccount,
  });
  return {
    id: String(raw.id ?? ''),
    expense_no: raw.expense_no != null ? String(raw.expense_no) : undefined,
    expense_date: String(raw.expense_date ?? ''),
    category: String(raw.category ?? ''),
    description: String(raw.description ?? ''),
    amount: Number(raw.amount ?? 0),
    payment_method: String(raw.payment_method ?? 'cash'),
    payment_account_id: resolvedPayId ?? (raw.payment_account_id != null ? String(raw.payment_account_id) : null),
    payment_account_display: display,
    receipt_url: raw.receipt_url != null ? String(raw.receipt_url) : null,
    status: String(raw.status ?? ''),
    created_by: raw.created_by != null ? String(raw.created_by) : null,
    created_by_name: raw.created_by_name != null ? String(raw.created_by_name) : null,
    paid_to_user_id: raw.paid_to_user_id != null ? String(raw.paid_to_user_id) : null,
    expense_category_id: raw.expense_category_id != null ? String(raw.expense_category_id) : null,
    vendor_name: raw.vendor_name != null ? String(raw.vendor_name) : null,
    branch_id: raw.branch_id != null ? String(raw.branch_id) : null,
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
  };
}

const EXPENSE_LIST_SELECT = `
  id, expense_no, expense_date, category, description, amount, payment_method,
  payment_account_id, receipt_url, status, created_by, paid_to_user_id, branch_id,
  created_at, expense_category_id, vendor_name,
  payment_account:accounts(code, name, type)
`;

const EXPENSE_LIST_SELECT_PLAIN =
  'id, expense_no, expense_date, category, description, amount, payment_method, payment_account_id, receipt_url, status, created_by, paid_to_user_id, branch_id, created_at, expense_category_id, vendor_name';

const EXPENSE_LIST_SELECT_MINIMAL =
  'id, expense_no, expense_date, category, description, amount, payment_method, status, created_by, paid_to_user_id, branch_id, created_at';

function applyExpenseListBranchFilter<
  T extends { eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T },
>(
  query: T,
  branchId?: string | null,
  accessibleBranchIds?: string[],
): T {
  if (branchId && branchId !== 'all' && branchId !== 'default') {
    return query.eq('branch_id', branchId);
  }
  if (accessibleBranchIds?.length) {
    return query.in('branch_id', accessibleBranchIds);
  }
  return query;
}

function buildExpenseListQuery(
  select: string,
  companyId: string,
  branchId?: string | null,
  accessibleBranchIds?: string[],
) {
  const query = supabase
    .from('expenses')
    .select(select)
    .eq('company_id', companyId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  return applyExpenseListBranchFilter(query, branchId, accessibleBranchIds);
}

async function fetchExpensesOnline(
  companyId: string,
  branchId?: string | null,
  accessibleBranchIds?: string[],
) {
  const preferPlain = Capacitor.isNativePlatform();
  let select = preferPlain ? EXPENSE_LIST_SELECT_PLAIN : EXPENSE_LIST_SELECT;
  let { data, error } = await buildExpenseListQuery(select, companyId, branchId, accessibleBranchIds);

  if (
    error &&
    (error.message?.includes('accounts') ||
      error.message?.includes('payment_account') ||
      (!preferPlain && isNetworkFetchError(error.message)))
  ) {
    select = EXPENSE_LIST_SELECT_PLAIN;
    const retry = await buildExpenseListQuery(select, companyId, branchId, accessibleBranchIds);
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (
    error?.message?.includes('expense_category_id') ||
    error?.message?.includes('receipt_url') ||
    error?.message?.includes('payment_account_id') ||
    error?.message?.includes('expense_no')
  ) {
    select = EXPENSE_LIST_SELECT_MINIMAL;
    const retry = await buildExpenseListQuery(select, companyId, branchId, accessibleBranchIds);
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error) return { data: [], error: formatNetworkFetchError(error.message) };

  const rows = (data || []) as unknown as Record<string, unknown>[];
  await enrichExpenseRowsWithCreatorNames(rows);
  try {
    await enrichExpenseRowsWithPostedPaymentAccount(rows, companyId);
  } catch (e) {
    console.warn('[fetchExpensesOnline] enrichExpenseRowsWithPostedPaymentAccount:', e);
  }
  return { data: rows.map(mapExpenseRow), error: null };
}

/** Fetch one expense with joins for detail sheet. */
export async function getExpenseById(
  companyId: string,
  id: string,
): Promise<{ data: ExpenseRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };

  let { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_LIST_SELECT)
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();

  if (error?.message?.includes('accounts') || error?.message?.includes('payment_account')) {
    const plain = await supabase
      .from('expenses')
      .select(
        'id, expense_no, expense_date, category, description, amount, payment_method, payment_account_id, receipt_url, status, created_by, paid_to_user_id, expense_category_id, vendor_name',
      )
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    data = plain.data as typeof data;
    error = plain.error;
  }

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Expense not found.' };

  const row = data as Record<string, unknown>;
  await enrichExpenseRowsWithCreatorNames([row]);
  await enrichExpenseRowsWithPostedPaymentAccount([row], companyId);
  return { data: mapExpenseRow(row), error: null };
}

/** Delete expense — void JEs + payments, then delete row (matches web expenseService.deleteExpense). */
export async function deleteExpense(
  id: string,
  companyId: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const now = getCurrentLocalTimestamp();

  await supabase
    .from('journal_entries')
    .update({ is_void: true, void_reason: 'expense_deleted', voided_at: now })
    .eq('reference_type', 'expense')
    .eq('reference_id', id)
    .eq('company_id', companyId);

  await supabase
    .from('payments')
    .update({ voided_at: now, voided_reason: 'expense_deleted' })
    .eq('reference_type', 'expense')
    .eq('reference_id', id)
    .eq('company_id', companyId);

  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('company_id', companyId);
  if (error) return { error: error.message };
  return { error: null };
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

function nameToSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'other';
}

/** Main categories aligned with ExpenseModule chips / CATEGORY_TO_SLUG. */
export const DEFAULT_EXPENSE_MAIN_CATEGORIES: {
  name: string;
  slug: string;
  type?: string;
}[] = [
  { name: 'Stitching', slug: 'stitching' },
  { name: 'Dying', slug: 'dying' },
  { name: 'Rent', slug: 'rent' },
  { name: 'Utilities', slug: 'utilities', type: 'utility' },
  { name: 'Salaries', slug: 'salaries', type: 'salary' },
  { name: 'Supplies', slug: 'office_supplies' },
  { name: 'Transport', slug: 'travel' },
  { name: 'Other', slug: 'miscellaneous' },
];

function isDuplicateCategoryError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('unique') || m.includes('duplicate') || m.includes('idx_expense_categories');
}

/** Idempotent: insert missing main categories (parent_id null) for a company. */
export async function ensureDefaultExpenseCategories(
  companyId: string,
): Promise<{ created: number; error: string | null }> {
  if (!isSupabaseConfigured) return { created: 0, error: 'App not configured.' };

  const { data: list, error: loadErr } = await getExpenseCategories(companyId);
  if (loadErr) return { created: 0, error: loadErr };

  const existingSlugs = new Set(
    (list || []).map((c) => (c.slug || nameToSlug(c.name)).toLowerCase()),
  );

  let created = 0;
  let lastError: string | null = null;

  for (const def of DEFAULT_EXPENSE_MAIN_CATEGORIES) {
    if (existingSlugs.has(def.slug)) continue;

    const { error } = await createExpenseCategory(companyId, {
      name: def.name,
      parent_id: null,
      type: def.type,
    });

    if (error) {
      if (isDuplicateCategoryError(error)) {
        existingSlugs.add(def.slug);
        continue;
      }
      lastError = error;
      continue;
    }

    created += 1;
    existingSlugs.add(def.slug);
  }

  return { created, error: lastError };
}

export async function createExpenseCategory(
  companyId: string,
  payload: {
    name: string;
    parent_id?: string | null;
    type?: string;
    color?: string;
    icon?: string;
    description?: string | null;
  },
): Promise<{ data: ExpenseCategoryRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const name = payload.name.trim();
  if (!name) return { data: null, error: 'Name is required.' };
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({
      company_id: companyId,
      name,
      slug: nameToSlug(name),
      parent_id: payload.parent_id || null,
      type: payload.type || 'general',
      color: payload.color || 'gray',
      icon: payload.icon || 'Other',
      description: payload.description || null,
    })
    .select('id, company_id, name, slug, parent_id, type, color, icon, description')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as ExpenseCategoryRow, error: null };
}

export async function updateExpenseCategory(
  id: string,
  payload: {
    name?: string;
    parent_id?: string | null;
    type?: string;
    color?: string;
    icon?: string;
    description?: string | null;
  },
): Promise<{ data: ExpenseCategoryRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const updates: Record<string, unknown> = {};
  if (payload.parent_id !== undefined) updates.parent_id = payload.parent_id;
  if (payload.type !== undefined) updates.type = payload.type;
  if (payload.color !== undefined) updates.color = payload.color;
  if (payload.icon !== undefined) updates.icon = payload.icon;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.name !== undefined) {
    updates.name = payload.name.trim();
    updates.slug = nameToSlug(payload.name);
  }
  const { data, error } = await supabase
    .from('expense_categories')
    .update(updates)
    .eq('id', id)
    .select('id, company_id, name, slug, parent_id, type, color, icon, description')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as ExpenseCategoryRow, error: null };
}

export async function deleteExpenseCategory(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase.from('expense_categories').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export type ExtraServiceClearingLine = {
  sale_charge_id: string;
  sale_id: string;
  invoice_no: string;
  charge_type: string;
  amount: number;
  charged_to_customer: boolean;
  tailor_contact_id: string | null;
  expense_category_id: string | null;
  tailor_name: string | null;
  open_balance: number;
};

/** Open 4120 balances per sale charge (for stitching/dyeing payout). */
function normalizeClearingLineRow(row: Record<string, unknown>): ExtraServiceClearingLine {
  return {
    sale_charge_id: String(row.sale_charge_id ?? ''),
    sale_id: String(row.sale_id ?? ''),
    invoice_no: String(row.invoice_no ?? ''),
    charge_type: String(row.charge_type ?? ''),
    amount: Number(row.amount ?? 0),
    charged_to_customer: Boolean(row.charged_to_customer ?? true),
    tailor_contact_id: row.tailor_contact_id != null ? String(row.tailor_contact_id) : null,
    expense_category_id: row.expense_category_id != null ? String(row.expense_category_id) : null,
    tailor_name: row.tailor_name != null ? String(row.tailor_name) : null,
    open_balance: Number(row.open_balance ?? 0),
  };
}

export async function getExtraServiceClearingLines(
  companyId: string,
  filters?: {
    tailorContactId?: string | null;
    expenseCategoryId?: string | null;
    categorySlug?: string | null;
    allowedCategoryIds?: string[];
    categorySlugs?: string[];
  },
): Promise<{
  data: ExtraServiceClearingLine[];
  error: string | null;
  filterWarning?: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  // Fetch all open lines; category narrowing is done client-side (legacy sale_charges
  // may lack expense_category_id and would be dropped by the RPC filter).
  const rpcArgs = {
    p_company_id: companyId,
    p_tailor_contact_id: filters?.tailorContactId ?? null,
    p_expense_category_id: null,
  };

  const { data, error } = await supabase.rpc('extra_service_clearing_lines', rpcArgs);

  if (error) {
    if (error.code === '42883' || String(error.message).includes('does not exist')) {
      return { data: [], error: null };
    }
    return { data: [], error: error.message };
  }

  const all = ((data ?? []) as Record<string, unknown>[]).map(normalizeClearingLineRow);
  const categoryId = filters?.expenseCategoryId;
  const categorySlug = filters?.categorySlug;
  const allowedCategoryIds = filters?.allowedCategoryIds;
  const categorySlugs = filters?.categorySlugs;
  if (
    !categoryId &&
    !categorySlug &&
    !(allowedCategoryIds?.length) &&
    !(categorySlugs?.length)
  ) {
    return { data: all, error: null };
  }

  const { lines, usedFallback, noCategoryMatch } = filterClearingLinesByCategory(all, {
    expenseCategoryId: categoryId,
    categorySlug,
    allowedCategoryIds,
    categorySlugs,
  });

  let filterWarning: string | null = null;
  if (noCategoryMatch && all.length > 0) {
    filterWarning =
      'No open balance matched this tailor category; showing all open extra-service lines.';
  } else if (usedFallback && categoryId && lines.length > 0) {
    filterWarning = 'Matched by charge type (sale may not have tailor category linked yet).';
  }

  return { data: lines, error: null, filterWarning };
}

async function patchExpenseReceiptUrl(
  expenseId: string,
  companyId: string,
  receiptUrl: string,
): Promise<{ ok: boolean; warning?: string }> {
  const url = receiptUrl.trim();
  if (!url) return { ok: true };
  const { error } = await supabase
    .from('expenses')
    .update({ receipt_url: url })
    .eq('id', expenseId)
    .eq('company_id', companyId);
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('receipt_url') || msg.includes('schema')) {
      return { ok: false, warning: 'Expense saved but receipt could not be linked (receipt_url column missing).' };
    }
    return { ok: false, warning: error.message || 'Expense saved but receipt could not be linked.' };
  }
  return { ok: true };
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
  /** 4120 clearing: link payout to sale extra charge. */
  saleId?: string | null;
  saleChargeId?: string | null;
  tailorContactId?: string | null;
  expenseCategoryId?: string | null;
  /** Hybrid 4120: [{ saleChargeId, amount }] — remainder posts to category expense. */
  clearingAllocations?: Array<{ saleChargeId: string; amount: number }>;
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
  let receiptStrippedInFallback = false;

  if (rpcErr) {
    const msg = String(rpcErr.message || '').toLowerCase();
    const schemaMissing =
      msg.includes('payment_account_id') || msg.includes('receipt_url') || (msg.includes('column') && msg.includes('schema'));
    if (schemaMissing && (payAcct || receipt)) {
      if (receipt) receiptStrippedInFallback = true;
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

  const expenseId = rpc.expense_id;
  const patch: Record<string, unknown> = {};
  const paidUid = sanitizeUuid(input.paidToUserId ?? null);
  if (paidUid) patch.paid_to_user_id = paidUid;
  const vendor = (input.payeeName ?? '').trim().slice(0, 255);
  if (vendor) patch.vendor_name = vendor;
  const saleId = sanitizeUuid(input.saleId ?? null);
  const saleChargeId = sanitizeUuid(input.saleChargeId ?? null);
  const tailorId = sanitizeUuid(input.tailorContactId ?? null);
  const expenseCategoryId = sanitizeUuid(input.expenseCategoryId ?? null);
  if (saleId) patch.sale_id = saleId;
  if (saleChargeId) patch.sale_charge_id = saleChargeId;
  if (tailorId) patch.tailor_contact_id = tailorId;
  if (expenseCategoryId) patch.expense_category_id = expenseCategoryId;
  if (receipt) patch.receipt_url = receipt;
  if (input.clearingAllocations && input.clearingAllocations.length > 0) {
    patch.clearing_allocations = input.clearingAllocations
      .map((a) => {
        const id = sanitizeUuid(a.saleChargeId);
        const chunkAmt = Math.max(0, Number(a.amount) || 0);
        if (!id || chunkAmt <= 0) return null;
        return { sale_charge_id: id, amount: chunkAmt };
      })
      .filter(Boolean);
  }

  if (expenseId && Object.keys(patch).length > 0) {
    let upd = await supabase.from('expenses').update(patch).eq('id', expenseId).eq('company_id', input.companyId);
    if (upd.error) {
      const msg = String(upd.error.message || '').toLowerCase();
      const dropKeys = [
        'vendor_name',
        'sale_id',
        'sale_charge_id',
        'tailor_contact_id',
        'expense_category_id',
        'receipt_url',
        'clearing_allocations',
      ] as const;
      let slim = { ...patch };
      for (const key of dropKeys) {
        if (msg.includes(key) || msg.includes('schema cache')) {
          const { [key]: _d, ...rest } = slim;
          slim = rest;
        }
      }
      if (Object.keys(slim).length > 0 && upd.error) {
        upd = await supabase
          .from('expenses')
          .update(slim)
          .eq('id', expenseId)
          .eq('company_id', input.companyId);
      }
      if (upd.error) {
        return {
          data: null,
          error: `Expense was created but payee could not be saved: ${upd.error.message}. You can edit the expense in the web app.`,
        };
      }
    }
  }

  try {
    if (expenseId) {
      const { data: postData, error: postErr } = await supabase.rpc(
        'record_expense_with_accounting',
        { p_expense_id: expenseId },
      );
      if (postErr) {
        return {
          data: null,
          error: postErr.message || 'Expense saved but accounting post failed.',
        };
      }
      if (postData && typeof postData === 'object' && (postData as { success?: boolean }).success === false) {
        const errMsg =
          (postData as { error?: string }).error ?? 'Expense saved but accounting post failed.';
        return { data: null, error: errMsg };
      }
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Expense saved but accounting post failed.',
    };
  }

  let receiptWarning: string | null = null;
  if (receipt && expenseId) {
    const { data: checkRow } = await supabase
      .from('expenses')
      .select('receipt_url')
      .eq('id', expenseId)
      .eq('company_id', input.companyId)
      .maybeSingle();
    if (!checkRow?.receipt_url) {
      const patched = await patchExpenseReceiptUrl(expenseId, input.companyId, receipt);
      if (!patched.ok) {
        receiptWarning = patched.warning ?? 'Expense saved but receipt could not be linked.';
      }
    }
    if (receiptStrippedInFallback && !receiptWarning) {
      receiptWarning = 'Expense saved; receipt was linked after create (RPC omitted receipt_url).';
    }
  }

  return {
    data: { id: rpc.expense_id, expense_no: rpc.expense_no, receiptWarning },
    error: null,
  };
}

export async function updateExpense(input: {
  companyId: string;
  expenseId: string;
  branchId?: string | null;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  expenseDate?: string;
  paymentAccountId?: string | null;
  receiptUrl?: string | null;
  paidToUserId?: string | null;
  payeeName?: string | null;
  expenseCategoryId?: string | null;
}) {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };

  const { data: existingRow, error: fetchErr } = await getExpenseById(input.companyId, input.expenseId);
  if (fetchErr || !existingRow) {
    return { data: null, error: fetchErr || 'Expense not found.' };
  }

  const paymentMethod = normalizeExpensePaymentMethodForDb(input.paymentMethod);
  const payAcct = sanitizeUuid(input.paymentAccountId ?? null);
  const paidUid = sanitizeUuid(input.paidToUserId ?? null);
  const expenseCategoryId = sanitizeUuid(input.expenseCategoryId ?? null);
  const vendor = (input.payeeName ?? '').trim().slice(0, 255);

  const payload: Record<string, unknown> = {
    expense_date: input.expenseDate || existingRow.expense_date,
    category: input.category,
    description: input.description,
    amount: input.amount,
    payment_method: paymentMethod,
  };
  if (payAcct) payload.payment_account_id = payAcct;
  if (paidUid) payload.paid_to_user_id = paidUid;
  if (vendor) payload.vendor_name = vendor;
  if (expenseCategoryId) payload.expense_category_id = expenseCategoryId;
  if (input.receiptUrl !== undefined) payload.receipt_url = input.receiptUrl || null;
  if (input.branchId) payload.branch_id = input.branchId;

  const isPosted = existingRow.status === 'paid' || existingRow.status === 'approved';
  if (isPosted) {
    const patch = await patchExpenseJournalInPlace({
      companyId: input.companyId,
      expenseId: input.expenseId,
      oldAmount: Number(existingRow.amount) || 0,
      newAmount: input.amount,
      category: input.category,
      description: input.description,
      expenseDate: input.expenseDate || existingRow.expense_date,
    });
    if (!patch.ok) {
      return { data: null, error: patch.error || 'Could not update expense accounting.' };
    }
  }

  let upd = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', input.expenseId)
    .eq('company_id', input.companyId)
    .select(EXPENSE_LIST_SELECT)
    .single();

  if (upd.error) {
    const msg = String(upd.error.message || '').toLowerCase();
    const dropKeys = [
      'vendor_name',
      'paid_to_user_id',
      'expense_category_id',
      'receipt_url',
      'payment_account_id',
      'branch_id',
    ] as const;
    let slim = { ...payload };
    for (const key of dropKeys) {
      if (msg.includes(key) || msg.includes('schema cache')) {
        const { [key]: _d, ...rest } = slim;
        slim = rest;
      }
    }
    if (Object.keys(slim).length > 0) {
      upd = await supabase
        .from('expenses')
        .update(slim)
        .eq('id', input.expenseId)
        .eq('company_id', input.companyId)
        .select(EXPENSE_LIST_SELECT)
        .single();
    }
    if (upd.error) return { data: null, error: upd.error.message };
  }

  const row = upd.data as Record<string, unknown>;
  await enrichExpenseRowsWithCreatorNames([row]);
  await enrichExpenseRowsWithPostedPaymentAccount([row], input.companyId);
  return { data: mapExpenseRow(row), error: null };
}

const EXPENSE_RECEIPT_BUCKET = 'expense-receipts';
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5MB

function isDevBuild(): boolean {
  return Boolean(
    typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
  );
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

  const safeName = (file.name || 'receipt').replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${companyId}/receipts/${Date.now()}_${safeName}`;
  try {
    const { ref } = await withUploadTimeout(
      uploadStorageAttachmentFile({
        bucket: EXPENSE_RECEIPT_BUCKET,
        path,
        file,
        upsert: true,
        logTag: 'expense-receipts',
      }),
      UPLOAD_TIMEOUT_MS,
      `Upload ${file.name || 'receipt'}`,
    );
    return { url: ref, error: null };
  } catch (err) {
    if (isDevBuild()) {
      console.warn('[uploadExpenseReceipt]', err);
    }
    if ((err as Error)?.message === ATTACHMENT_UPLOAD_VERIFY_FAIL_MSG) {
      return { url: null, error: ATTACHMENT_UPLOAD_VERIFY_FAIL_MSG, kind: 'size' };
    }
    const classified = classifyStorageUploadError(err, file.name || 'receipt');
    return { url: null, error: classified.userMessage, kind: classified.kind };
  }
}
