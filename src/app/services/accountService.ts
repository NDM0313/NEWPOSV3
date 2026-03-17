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

  /** Alias for getAccount (used by deleteAccount and callers expecting getAccountById) */
  async getAccountById(id: string) {
    return this.getAccount(id);
  },

  /**
   * Get accounts for branch default dropdowns (cash, bank, wallet only).
   * Single source of truth: company_id + is_active + operational role.
   * Does NOT depend on module toggle or UI mode. Uses type; if DB has account_role column, it is used first.
   */
  async getAccountsForBranchDefaults(companyId: string) {
    return this.getPaymentAccountsOnly(companyId);
  },

  /**
   * Payment accounts only: Cash, Bank, Mobile Wallet (real money movement).
   * Use for: Paid From, Payment account (Cr), any dropdown that must show only money accounts.
   * Excludes: AP, AR, expense, revenue, payable, receivable, production, shipping, control accounts.
   */
  async getPaymentAccountsOnly(companyId: string, _branchId?: string) {
    const all = await this.getAllAccounts(companyId);
    const active = (all || []).filter((a: any) => a.is_active !== false);
    const roleOrType = (a: any) =>
      String(a.account_role ?? a.type ?? '').toLowerCase().trim();
    const name = (a: any) => String(a.name ?? '').toLowerCase();
    const code = (a: any) => String(a.code ?? '').toLowerCase();
    const operational = active.filter((a: any) => {
      const r = roleOrType(a);
      const n = name(a);
      const c = code(a);
      // Exclude non-payment: payable, receivable, expense, revenue, production, shipping
      if (n.includes('payable') || n.includes('receivable') || n.includes('ar ') || n.includes(' ap ') || c.startsWith('2') || c === '1100' || c === '2000' || c === '2010') return false;
      if (n.includes('expense') && !n.includes('payment')) return false;
      if (n.includes('revenue') || n.includes('income') || n.includes('production') || n.includes('shipping') || n.includes('courier')) return false;
      return (
        r === 'cash' ||
        r === 'bank' ||
        r === 'wallet' ||
        r === 'mobile_wallet' ||
        r === 'mobile wallet' ||
        r.includes('cash') ||
        r.includes('bank') ||
        r.includes('wallet') ||
        c === '1000' ||
        c === '1010' ||
        c === '1020' ||
        n.includes('cash') ||
        n.includes('bank') ||
        n.includes('wallet')
      );
    });
    return operational;
  },

  // Create account
  async createAccount(account: Partial<Account>) {
    // Clean data - only include fields that exist in actual schema
    // Actual schema may or may not include description (add via 17_accounts_description.sql)
    const cleanData: any = {
      company_id: account.company_id,
      code: account.code,
      name: account.name,
      type: account.type,
      balance: account.balance || 0,
      is_active: account.is_active !== false,
    };

    if (account.parent_id !== undefined && account.parent_id !== null) {
      cleanData.parent_id = account.parent_id;
    }
    if (account.description !== undefined && account.description !== null && String(account.description).trim() !== '') {
      cleanData.description = String(account.description).trim();
    }

    let result = await supabase.from('accounts').insert(cleanData).select().single();

    if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('description')) {
      delete cleanData.description;
      result = await supabase.from('accounts').insert(cleanData).select().single();
    }

    if (result.error) throw result.error;
    return result.data;
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
    if (updates.description !== undefined) cleanData.description = updates.description === '' ? null : updates.description;
    
    // DO NOT include: account_type, branch_id, branch_name, subtype, opening_balance, current_balance, is_system, is_default_cash, is_default_bank
    
    // Filter out any non-existent fields that might have been passed
    const allowedFields = ['code', 'name', 'type', 'balance', 'is_active', 'parent_id', 'description'];
    const filteredData: any = {};
    for (const key of allowedFields) {
      if (cleanData[key] !== undefined) {
        filteredData[key] = cleanData[key];
      }
    }

    let result = await supabase.from('accounts').update(filteredData).eq('id', id).select().single();
    if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('description')) {
      delete filteredData.description;
      result = await supabase.from('accounts').update(filteredData).eq('id', id).select().single();
    }
    if (result.error) throw result.error;
    return result.data;
  },

  /**
   * Get child accounts (accounts that have this account as parent).
   * Used to prevent deleting a parent that has sub-accounts.
   */
  async getChildAccounts(parentId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('parent_id', parentId);

    if (error) throw error;
    return data || [];
  },

  // Delete account (soft delete)
  // 🔒 CORE ACCOUNTING BACKBONE RULE: Core payment accounts (Cash, Bank, Mobile Wallet) CANNOT be deleted
  // 🔒 PARENT RULE: Cannot delete an account that has sub-accounts (children)
  async deleteAccount(id: string, companyId?: string) {
    const children = await this.getChildAccounts(id);
    if (children.length > 0) {
      throw new Error(
        `Cannot delete "${(await this.getAccount(id))?.name || 'this account'}": it has ${children.length} sub-account(s). ` +
        `Remove or reassign sub-accounts first.`
      );
    }

    if (companyId) {
      const { defaultAccountsService } = await import('./defaultAccountsService');
      const account = await this.getAccount(id);
      
      if (account && defaultAccountsService.isCorePaymentAccount(account)) {
        throw new Error(
          `Cannot delete core payment account "${account.name}". ` +
          `Core accounts (Cash, Bank, Mobile Wallet) are mandatory and cannot be deleted. ` +
          `You can rename the account if needed.`
        );
      }
    }
    
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * PF-06: Operating expense accounts only (for user-facing expense pickers).
   * Excludes production/studio/shipping/courier cost accounts (5000, 5010, 5100, 5200, 5300 and names matching internal).
   */
  async getOperatingExpenseAccountsOnly(companyId: string) {
    const all = await this.getAllAccounts(companyId);
    const active = (all || []).filter((a: any) => a.is_active !== false);
    const expenseType = (a: any) => /expense|cogs|cost of sales/i.test(String(a.type ?? ''));
    const internalCodes = new Set(['5000', '5010', '5100', '5200', '5300']);
    const internalNames = /cost of production|cost of studio|shipping expense|extra expense|courier|payable|receivable/i;
    return active.filter((a: any) => {
      if (!expenseType(a)) return false;
      const code = String(a.code ?? '').trim();
      const name = String(a.name ?? '').toLowerCase();
      if (internalCodes.has(code)) return false;
      if (internalNames.test(name)) return false;
      return true;
    });
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
