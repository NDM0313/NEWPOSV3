import { supabase } from '@/lib/supabase';

export interface Account {
  id?: string;
  company_id: string;
  branch_id?: string;
  code?: string;
  name: string;
  type: 'Cash' | 'Bank' | 'Mobile Wallet';
  account_type: string;
  balance: number;
  branch_name?: string;
  is_active?: boolean;
}

export const accountService = {
  // Get all accounts
  async getAllAccounts(companyId: string, branchId?: string) {
    // Note: company_id and is_active columns may not exist in all databases
    // Fetch all accounts and filter in application code if needed
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
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
