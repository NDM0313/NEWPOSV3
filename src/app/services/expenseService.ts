import { getCurrentLocalTimestamp, localNowDateString } from '@/app/utils/localDate';
import { supabase } from '@/lib/supabase';
import { enrichExpenseRowsWithPostedPaymentAccount } from '@/app/lib/resolveExpensePaymentAccount';

/** Enrich expenses with creator full_name. expenses.created_by = auth.users.id; resolve via users.auth_user_id. */
async function enrichExpenseRowsWithCreatorNames(expenses: any[]): Promise<void> {
  const ids = [...new Set((expenses || []).map((e: any) => e.created_by).filter(Boolean))] as string[];
  if (ids.length === 0) return;
  const nameByCreatedBy = new Map<string, string>();
  const { data: usersByAuth } = await supabase.from('users').select('auth_user_id, full_name, email').in('auth_user_id', ids);
  (usersByAuth || []).forEach((u: any) => {
    if (u?.auth_user_id) nameByCreatedBy.set(u.auth_user_id, u.full_name || u.email || '');
  });
  const missing = ids.filter((id) => !nameByCreatedBy.has(id));
  if (missing.length > 0) {
    const { data: usersById } = await supabase.from('users').select('id, full_name, email').in('id', missing);
    (usersById || []).forEach((u: any) => {
      if (u?.id) nameByCreatedBy.set(u.id, u.full_name || u.email || '');
    });
  }
  expenses.forEach((e: any) => {
    const uid = e.created_by;
    if (uid && typeof uid === 'string') {
      const name = nameByCreatedBy.get(uid) || null;
      e.created_by_user = { full_name: name, email: null };
    }
  });
}

/** Fill payment_account join when FK join failed but payment_account_id is set. */
async function enrichExpenseRowsWithPaymentAccounts(expenses: any[]): Promise<void> {
  const missingIds = [
    ...new Set(
      (expenses || [])
        .filter((e: any) => e.payment_account_id && !e.payment_account?.name && !e.payment_account?.code)
        .map((e: any) => e.payment_account_id),
    ),
  ] as string[];
  if (missingIds.length === 0) return;
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, type')
    .in('id', missingIds);
  const byId = new Map((accounts || []).map((a: any) => [a.id, a]));
  expenses.forEach((e: any) => {
    if (e.payment_account_id && !e.payment_account?.name) {
      const acc = byId.get(e.payment_account_id);
      if (acc) e.payment_account = acc;
    }
  });
}

export interface Expense {
  id?: string;
  company_id: string;
  branch_id: string;
  expense_no?: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  payment_account_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_by: string;
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

export const expenseService = {
  /** Server-allocated expense_no via create_expense_document (same path as mobile ERP). */
  async createExpenseDocument(input: {
    companyId: string;
    branchId: string;
    createdBy: string;
    expense: {
      expense_date: string;
      category: string;
      description: string;
      amount: number;
      payment_method: string;
      status: string;
      payment_account_id?: string;
      receipt_url?: string;
    };
    patch?: {
      paid_to_user_id?: string;
      vendor_name?: string;
      expense_category_id?: string;
    };
  }) {
    const expensePayload: Record<string, unknown> = {
      expense_date: input.expense.expense_date,
      category: input.expense.category,
      description: input.expense.description,
      amount: input.expense.amount,
      payment_method: input.expense.payment_method,
      status: input.expense.status,
    };
    if (input.expense.payment_account_id) {
      expensePayload.payment_account_id = input.expense.payment_account_id;
    }
    if (input.expense.receipt_url) {
      expensePayload.receipt_url = input.expense.receipt_url;
    }

    const callRpc = async (payload: Record<string, unknown>) =>
      supabase.rpc('create_expense_document', {
        p_company_id: input.companyId,
        p_branch_id: input.branchId,
        p_expense: payload,
        p_created_by: input.createdBy,
      });

    let { data: rpcRaw, error: rpcErr } = await callRpc(expensePayload);

    let receiptStrippedInFallback = false;

    if (rpcErr) {
      const msg = String(rpcErr.message || '').toLowerCase();
      const schemaMissing =
        msg.includes('payment_account_id') ||
        msg.includes('receipt_url') ||
        (msg.includes('column') && msg.includes('schema'));
      if (schemaMissing && (expensePayload.payment_account_id || expensePayload.receipt_url)) {
        if (expensePayload.receipt_url) receiptStrippedInFallback = true;
        const fallback = { ...expensePayload };
        delete fallback.payment_account_id;
        delete fallback.receipt_url;
        const retry = await callRpc(fallback);
        rpcRaw = retry.data;
        rpcErr = retry.error;
      }
    }

    if (rpcErr) throw rpcErr;

    const rpc = rpcRaw as { success?: boolean; expense_id?: string; expense_no?: string; error?: string } | null;
    if (!rpc?.success || !rpc.expense_id) {
      throw new Error(rpc?.error ?? 'Failed to create expense document.');
    }

    const expenseId = rpc.expense_id;
    const requestedReceiptUrl = String(input.expense.receipt_url || '').trim();
    const patch = input.patch ?? {};
    const patchPayload: Record<string, unknown> = {};
    if (patch.paid_to_user_id) patchPayload.paid_to_user_id = patch.paid_to_user_id;
    if (patch.vendor_name) patchPayload.vendor_name = patch.vendor_name;
    if (patch.expense_category_id) patchPayload.expense_category_id = patch.expense_category_id;
    if (requestedReceiptUrl) patchPayload.receipt_url = requestedReceiptUrl;

    if (Object.keys(patchPayload).length > 0) {
      let upd = await supabase.from('expenses').update(patchPayload).eq('id', expenseId).eq('company_id', input.companyId);
      if (upd.error) {
        const msg = String(upd.error.message || '');
        if (/vendor_name|expense_category_id|paid_to_user_id|receipt_url|schema cache/i.test(msg)) {
          const slim = { ...patchPayload };
          delete slim.vendor_name;
          delete slim.expense_category_id;
          delete slim.paid_to_user_id;
          delete slim.receipt_url;
          if (Object.keys(slim).length > 0) {
            await supabase.from('expenses').update(slim).eq('id', expenseId).eq('company_id', input.companyId);
          }
        }
      }
    }

    let receiptWarning: string | undefined;
    if (requestedReceiptUrl) {
      const { data: checkRow } = await supabase
        .from('expenses')
        .select('receipt_url')
        .eq('id', expenseId)
        .eq('company_id', input.companyId)
        .maybeSingle();
      if (!checkRow?.receipt_url) {
        const patched = await patchExpenseReceiptUrl(expenseId, input.companyId, requestedReceiptUrl);
        if (!patched.ok) {
          receiptWarning = patched.warning ?? 'Expense saved but receipt could not be linked.';
        }
      }
      if (receiptStrippedInFallback && !receiptWarning) {
        receiptWarning = 'Expense saved; receipt was linked after create (RPC omitted receipt_url).';
      }
    }

    const { data: row, error: fetchErr } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
    if (fetchErr) throw fetchErr;
    if (!row.expense_no && rpc.expense_no) {
      (row as { expense_no?: string }).expense_no = rpc.expense_no;
    }
    if (receiptWarning) {
      (row as { _receiptWarning?: string })._receiptWarning = receiptWarning;
    }
    return row;
  },

  /** Post expense to GL + payments row (Roznamcha parity with mobile ERP). */
  async postExpenseAccounting(expenseId: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('record_expense_with_accounting', {
      p_expense_id: expenseId,
    });
    if (error) {
      console.warn('[EXPENSE SERVICE] record_expense_with_accounting failed:', error);
      return { success: false, error: error.message };
    }
    const result = data as { success?: boolean; error?: string } | null;
    if (result?.success === false) {
      console.warn('[EXPENSE SERVICE] record_expense_with_accounting returned error:', result);
      return { success: false, error: result.error ?? 'Accounting post failed.' };
    }
    return { success: true };
  },

  // Create expense
  async createExpense(expense: Partial<Expense>) {
    const payload = { ...expense } as Record<string, unknown>;
    const run = () => supabase.from('expenses').insert(payload).select().single();

    let { data, error } = await run();
    const msg = String((error as { message?: string } | null)?.message || '');
    if (error && 'vendor_name' in payload && /vendor_name|schema cache/i.test(msg)) {
      delete payload.vendor_name;
      const second = await run();
      data = second.data;
      error = second.error;
    }
    if (error) throw error;
    return data;
  },

  // Get all expenses (join expense_categories + payment account)
  async getAllExpenses(companyId: string, branchId?: string) {
    const richSelect = `
        *,
        expense_category:expense_categories(name, slug),
        payment_account:accounts(id, code, name, type)
      `;
    let query = supabase
      .from('expenses')
      .select(richSelect)
      .eq('company_id', companyId)
      .order('expense_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    let { data, error } = await query;

    // Fallback: category join only
    if (error && (error.code === 'PGRST200' || String(error.message || '').includes('accounts'))) {
      let fallback = supabase
        .from('expenses')
        .select(`*, expense_category:expense_categories(name, slug)`)
        .eq('company_id', companyId)
        .order('expense_date', { ascending: false });
      if (branchId) fallback = fallback.eq('branch_id', branchId);
      const res = await fallback;
      data = res.data;
      error = res.error;
    }

    // Fallback to plain select if join fails (e.g. expense_categories missing)
    if (error && (error.code === 'PGRST200' || error.message?.includes('expense_categories'))) {
      let fallback = supabase.from('expenses').select('*').eq('company_id', companyId).order('expense_date', { ascending: false });
      if (branchId) fallback = fallback.eq('branch_id', branchId);
      const res = await fallback;
      data = res.data;
      error = res.error;
    }
    
    // If error is about company_id or expense_date column not existing, retry without them
    if (error && error.code === '42703' && (error.message?.includes('company_id') || error.message?.includes('expense_date'))) {
      const retryQuery = supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (branchId) {
        retryQuery.eq('branch_id', branchId);
      }
      
      const { data: retryData, error: retryError } = await retryQuery;
      if (retryError) {
        // If created_at also doesn't exist, try without ordering
        const finalQuery = supabase
          .from('expenses')
          .select('*');
        
        if (branchId) {
          finalQuery.eq('branch_id', branchId);
        }
        
        const { data: finalData, error: finalError } = await finalQuery;
        if (finalError) throw finalError;
        return finalData;
      }
      return retryData;
    }
    
    if (error) throw error;

    const rows = data || [];
    await enrichExpenseRowsWithCreatorNames(rows);
    await enrichExpenseRowsWithPaymentAccounts(rows);
    await enrichExpenseRowsWithPostedPaymentAccount(rows, companyId);
    return rows;
  },

  // Get single expense
  async getExpense(id: string) {
    let { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_category:expense_categories(name, slug),
        payment_account:accounts(id, code, name, type)
      `)
      .eq('id', id)
      .single();

    if (error) {
      const plain = await supabase.from('expenses').select('*').eq('id', id).single();
      data = plain.data;
      error = plain.error;
    }

    if (error) throw error;
    if (data) {
      await enrichExpenseRowsWithCreatorNames([data]);
      await enrichExpenseRowsWithPaymentAccounts([data]);
      await enrichExpenseRowsWithPostedPaymentAccount([data], (data as { company_id?: string }).company_id);
    }
    return data;
  },

  // Update expense
  async updateExpense(id: string, updates: Partial<Expense>) {
    const payload = { ...updates } as Record<string, unknown>;
    const run = () =>
      supabase.from('expenses').update(payload).eq('id', id).select().single();

    let { data, error } = await run();
    const msg = String((error as { message?: string } | null)?.message || '');
    if (
      error &&
      'vendor_name' in payload &&
      /vendor_name|schema cache/i.test(msg)
    ) {
      delete payload.vendor_name;
      const second = await run();
      data = second.data;
      error = second.error;
    }
    if (error) throw error;
    return data;
  },

  /**
   * Cancel posted expense — void GL/payments, keep expense row (status=rejected) for audit.
   */
  async cancelPostedExpense(
    id: string,
    companyId: string,
    reason: string,
    performedBy?: string | null
  ) {
    const now = getCurrentLocalTimestamp();
    await supabase
      .from('journal_entries')
      .update({ is_void: true, void_reason: 'expense_cancelled', voided_at: now })
      .eq('reference_type', 'expense')
      .eq('reference_id', id)
      .eq('company_id', companyId)
      .or('is_void.is.null,is_void.eq.false');
    await supabase
      .from('payments')
      .update({ voided_at: now, voided_reason: 'expense_cancelled' })
      .eq('reference_type', 'expense')
      .eq('reference_id', id)
      .eq('company_id', companyId)
      .is('voided_at', null);

    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'rejected',
        cancel_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) throw error;

    const { activityLogService } = await import('@/app/services/activityLogService');
    await activityLogService
      .logActivity({
        companyId,
        module: 'expense',
        entityId: id,
        action: 'expense_cancelled',
        performedBy: performedBy ?? null,
        description: `Expense cancelled: ${reason}`,
        notes: reason,
      })
      .catch(() => {});
  },

  // Delete expense — draft only: true delete + void any stray JEs + void payments
  async deleteExpense(id: string, companyId?: string) {
    const now = getCurrentLocalTimestamp();
    if (companyId) {
      // Void associated journal entries
      await supabase
        .from('journal_entries')
        .update({ is_void: true, void_reason: 'expense_deleted', voided_at: now })
        .eq('reference_type', 'expense')
        .eq('reference_id', id)
        .eq('company_id', companyId);
      // Void associated payments (so Roznamcha/Day Book don't show deleted expense)
      await supabase
        .from('payments')
        .update({ voided_at: now, voided_reason: 'expense_deleted' })
        .eq('reference_type', 'expense')
        .eq('reference_id', id)
        .eq('company_id', companyId);
    }
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Expense rows whose original expense journal has a correction_reversal JE (Accounting → Reverse).
   * Those expenses are fully offset in the GL and should not appear in operational expense totals/lists by default.
   */
  async getReversedExpenseIds(companyId: string, expenseIds: string[]): Promise<Set<string>> {
    const out = new Set<string>();
    if (!companyId || expenseIds.length === 0) return out;
    const { data: jes, error: jeErr } = await supabase
      .from('journal_entries')
      .select('id, reference_id, created_at')
      .eq('company_id', companyId)
      .eq('reference_type', 'expense')
      .in('reference_id', expenseIds)
      .or('is_void.is.null,is_void.eq.false')
      .order('created_at', { ascending: false });
    if (jeErr || !jes?.length) return out;
    /** Only the latest active JE per expense matters — older reversed JEs must not hide the row after repost. */
    const latestJeByExpense = new Map<string, string>();
    for (const j of jes as { id: string; reference_id: string }[]) {
      if (j.reference_id && !latestJeByExpense.has(j.reference_id)) {
        latestJeByExpense.set(j.reference_id, j.id);
      }
    }
    const latestJeIds = [...latestJeByExpense.values()];
    if (!latestJeIds.length) return out;
    const { data: revs, error: revErr } = await supabase
      .from('journal_entries')
      .select('reference_id')
      .eq('company_id', companyId)
      .eq('reference_type', 'correction_reversal')
      .in('reference_id', latestJeIds)
      .or('is_void.is.null,is_void.eq.false');
    if (revErr || !revs?.length) return out;
    const reversedJeIds = new Set((revs as { reference_id: string }[]).map((r) => r.reference_id));
    latestJeByExpense.forEach((jeId, expenseId) => {
      if (reversedJeIds.has(jeId)) out.add(expenseId);
    });
    return out;
  },

  // Get expenses by category
  async getExpensesByCategory(companyId: string, category: Expense['category']) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .eq('category', category)
      .order('expense_date', { ascending: false });

    if (error) throw error;
    return data;
  },
};
