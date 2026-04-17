import { supabase } from '@/lib/supabase';

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

export const expenseService = {
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

  // Get all expenses (join expense_categories for category name when expense_category_id is used)
  async getAllExpenses(companyId: string, branchId?: string) {
    let query = supabase
      .from('expenses')
      .select(`
        *,
        expense_category:expense_categories(name, slug)
      `)
      .eq('company_id', companyId)
      .order('expense_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    let { data, error } = await query;

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
    return data;
  },

  // Get single expense
  async getExpense(id: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
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

  // Delete expense — true delete + void JEs + void payments
  async deleteExpense(id: string, companyId?: string) {
    const now = new Date().toISOString();
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
