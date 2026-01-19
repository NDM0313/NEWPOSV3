import { supabase } from '@/lib/supabase';

export interface Expense {
  id?: string;
  company_id: string;
  branch_id: string;
  expense_no?: string;
  expense_date: string;
  category: 'rent' | 'utilities' | 'salaries' | 'marketing' | 'travel' | 'office_supplies' | 'repairs' | 'professional_fees' | 'insurance' | 'taxes' | 'miscellaneous';
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
    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get all expenses
  async getAllExpenses(companyId: string, branchId?: string) {
    let query = supabase
      .from('expenses')
      .select(`
        *,
        vendor:contacts(name),
        approved_by_user:users(full_name),
        created_by_user:users(full_name)
      `)
      .eq('company_id', companyId)
      .order('expense_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get single expense
  async getExpense(id: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        vendor:contacts(*),
        approved_by_user:users(full_name, email),
        created_by_user:users(full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update expense
  async updateExpense(id: string, updates: Partial<Expense>) {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete expense (soft delete by setting status to rejected)
  async deleteExpense(id: string) {
    const { error } = await supabase
      .from('expenses')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (error) throw error;
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
