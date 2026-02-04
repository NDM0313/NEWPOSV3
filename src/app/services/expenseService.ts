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
    // Note: company_id and expense_date columns may not exist in all databases
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .order('expense_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    
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
