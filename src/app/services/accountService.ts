import { supabase } from '@/lib/supabase';

export interface Account {
  id?: string;
  company_id: string;
  branch_id?: string;
  code?: string;
  name: string;
  type: 'Cash' | 'Bank' | 'Mobile Wallet' | 'cash' | 'bank' | 'mobile_wallet';
  account_type: string;
  balance: number;
  branch_name?: string;
  is_active?: boolean;
}

export const accountService = {
  // Get all accounts - with company_id filter
  async getAllAccounts(companyId: string, branchId?: string) {
    try {
      // Try to fetch with company_id filter first
      let query = supabase
        .from('accounts')
        .select('*')
        .order('name');

      // Try to filter by company_id if column exists
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) {
        // If error related to company_id column, retry without it
        if (error.message?.includes('company_id') || error.code === 'PGRST204') {
          console.warn('[ACCOUNT SERVICE] company_id column not found, fetching all accounts');
          const { data: allData, error: allError } = await supabase
            .from('accounts')
            .select('*')
            .order('name');
          
          if (allError) throw allError;
          return allData || [];
        }
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('[ACCOUNT SERVICE] Error fetching accounts:', error);
      // Final fallback - return empty array to prevent crashes
      return [];
    }
  },

  // Get single account
  async getAccount(id: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create account
  async createAccount(account: Partial<Account>) {
    const { data, error } = await supabase
      .from('accounts')
      .insert(account)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update account
  async updateAccount(id: string, updates: Partial<Account>) {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete account (soft delete)
  async deleteAccount(id: string) {
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // Get accounts by type
  async getAccountsByType(companyId: string, type: 'Cash' | 'Bank' | 'Mobile Wallet') {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('type', type)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },
};
