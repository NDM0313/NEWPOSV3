import { supabase } from '@/lib/supabase';

export interface Account {
  id?: string;
  company_id: string;
  branch_id?: string;
  code?: string;
  name: string;
  type: 'Cash' | 'Bank' | 'Mobile Wallet' | 'cash' | 'bank' | 'mobile_wallet' | 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | string;
  balance: number;
  parent_id?: string | null;
  is_active?: boolean;
  // Optional fields that may not exist in all schema versions
  subtype?: string;
  opening_balance?: number;
  current_balance?: number;
  is_system?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
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
    // Clean data - only include fields that exist in actual schema
    // Actual schema: id, company_id, code, name, type, parent_id, balance, is_active, created_at, updated_at
    const cleanData: any = {
      company_id: account.company_id,
      code: account.code,
      name: account.name,
      type: account.type,
      balance: account.balance || 0,
      is_active: account.is_active !== false,
    };
    
    // Add optional fields only if provided
    if (account.parent_id !== undefined && account.parent_id !== null) {
      cleanData.parent_id = account.parent_id;
    }
    
    // DO NOT include: account_type, branch_id, branch_name, subtype, opening_balance, current_balance, is_system
    
    const { data, error } = await supabase
      .from('accounts')
      .insert(cleanData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update account
  async updateAccount(id: string, updates: Partial<Account>) {
    // Clean data - only include fields that exist in actual schema
    const cleanData: any = {};
    
    if (updates.code !== undefined) cleanData.code = updates.code;
    if (updates.name !== undefined) cleanData.name = updates.name;
    if (updates.type !== undefined) cleanData.type = updates.type;
    if (updates.balance !== undefined) cleanData.balance = updates.balance;
    if (updates.is_active !== undefined) cleanData.is_active = updates.is_active;
    if (updates.parent_id !== undefined) cleanData.parent_id = updates.parent_id;
    
    // DO NOT include: account_type, branch_id, branch_name, subtype, opening_balance, current_balance, is_system, is_default_cash, is_default_bank
    
    // Filter out any non-existent fields that might have been passed
    const allowedFields = ['code', 'name', 'type', 'balance', 'is_active', 'parent_id'];
    const filteredData: any = {};
    for (const key of allowedFields) {
      if (cleanData[key] !== undefined) {
        filteredData[key] = cleanData[key];
      }
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .update(filteredData)
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
