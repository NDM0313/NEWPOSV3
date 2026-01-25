import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { accountService } from './accountService';

// ============================================
// 🎯 TYPES & INTERFACES
// ============================================

export type AccountCategory = 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Cost of Sales' | 'Expenses';
export type AccountNature = 'Debit' | 'Credit';
export type AccountModule = 'POS' | 'Rental' | 'Studio' | 'General Accounting' | 'All';

export interface ChartAccount {
  id?: string;
  code: string;
  name: string;
  category: AccountCategory;
  sub_category: string;
  parent_account_id?: string | null;
  modules: string[] | AccountModule[];
  opening_balance: number;
  current_balance: number;
  nature: AccountNature;
  tax_applicable: boolean;
  tax_type?: string | null;
  active: boolean;
  show_in_reports: boolean;
  is_system?: boolean;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string;
  updated_by?: string | null;
  // Existing accounts table fields
  company_id?: string;
  type?: string; // account_type enum: 'asset', 'liability', 'equity', 'revenue', 'expense'
  subtype?: string; // account_subtype enum
  parent_id?: string | null;
  is_active?: boolean;
}

// ============================================
// 🎯 DATA MAPPING FUNCTIONS
// ============================================

// Map existing account_type enum to ChartAccount category
function mapTypeToCategory(type: string): AccountCategory {
  const typeMap: Record<string, AccountCategory> = {
    'asset': 'Assets',
    'liability': 'Liabilities',
    'equity': 'Equity',
    'revenue': 'Income',
    'expense': 'Expenses',
  };
  return typeMap[type.toLowerCase()] || 'Expenses';
}

// Map ChartAccount category to account_type enum
function mapCategoryToType(category: AccountCategory): string {
  const categoryMap: Record<AccountCategory, string> = {
    'Assets': 'asset',
    'Liabilities': 'liability',
    'Equity': 'equity',
    'Income': 'revenue',
    'Cost of Sales': 'expense',
    'Expenses': 'expense',
  };
  return categoryMap[category];
}

// Map sub_category to account_subtype enum
function mapSubCategoryToSubtype(subCategory: string, category: AccountCategory): string {
  const subCategoryLower = subCategory.toLowerCase();
  
  // Map common subcategories
  if (subCategoryLower.includes('cash')) return 'cash';
  if (subCategoryLower.includes('bank')) return 'bank';
  if (subCategoryLower.includes('receivable')) return 'accounts_receivable';
  if (subCategoryLower.includes('payable')) return 'accounts_payable';
  if (subCategoryLower.includes('capital')) return 'owner_capital';
  if (subCategoryLower.includes('cogs') || subCategoryLower.includes('cost of goods')) return 'cost_of_goods_sold';
  if (subCategoryLower.includes('operating')) return 'operating_expense';
  if (subCategoryLower.includes('sales') || subCategoryLower.includes('revenue')) return 'sales_revenue';
  if (subCategoryLower.includes('inventory')) return 'inventory';
  
  return 'other';
}

// Map existing accounts table row to ChartAccount
function mapAccountToChartAccount(account: any, companyId: string): ChartAccount {
  // Determine nature based on type
  const nature: AccountNature = 
    account.type === 'asset' || account.type === 'expense' ? 'Debit' : 'Credit';
  
  // Map subtype to sub_category (reverse mapping)
  const subCategoryMap: Record<string, string> = {
    'cash': 'Current Assets',
    'bank': 'Current Assets',
    'mobile_wallet': 'Current Assets',
    'accounts_receivable': 'Current Assets',
    'accounts_payable': 'Current Liabilities',
    'inventory': 'Current Assets',
    'fixed_asset': 'Fixed Assets',
    'current_asset': 'Current Assets',
    'current_liability': 'Current Liabilities',
    'long_term_liability': 'Long-term Liabilities',
    'owner_capital': 'Capital',
    'retained_earnings': 'Retained Earnings',
    'sales_revenue': 'Sales Revenue',
    'rental_revenue': 'Rental Revenue',
    'studio_revenue': 'Studio Revenue',
    'cost_of_goods_sold': 'Cost of Sales',
    'operating_expense': 'Operating Expenses',
    'other': 'Other',
  };
  
  const sub_category = subCategoryMap[account.subtype] || account.subtype || 'Other';
  
  // Handle different balance column names (balance vs current_balance)
  const currentBalance = account.current_balance !== undefined 
    ? account.current_balance 
    : (account.balance !== undefined ? account.balance : 0);
  const openingBalance = account.opening_balance !== undefined 
    ? account.opening_balance 
    : 0;
  
  return {
    id: account.id,
    code: account.code || '',
    name: account.name || '',
    category: mapTypeToCategory(account.type || account.account_type || 'expense'),
    sub_category,
    parent_account_id: account.parent_id || null,
    modules: ['General Accounting'], // Default, can be extended
    opening_balance: openingBalance,
    current_balance: currentBalance,
    nature,
    tax_applicable: false, // Not in existing schema
    tax_type: null,
    active: account.is_active !== false,
    show_in_reports: true, // Default
    is_system: account.is_system || false,
    created_at: account.created_at,
    updated_at: account.updated_at,
    company_id: account.company_id || companyId,
    type: account.type || account.account_type,
    subtype: account.subtype,
    parent_id: account.parent_id,
    is_active: account.is_active,
  };
}

// Map ChartAccount to existing accounts table structure
function mapChartAccountToAccount(chartAccount: Partial<ChartAccount>, companyId: string): any {
  // Use balance (not current_balance) - the actual schema uses 'balance'
  const balance = chartAccount.current_balance !== undefined 
    ? chartAccount.current_balance 
    : (chartAccount.opening_balance || 0);
  
  // Actual accounts table structure (from migration 03_frontend_driven_schema.sql):
  // Columns: id, company_id, code, name, type, parent_id, balance, is_active, created_at, updated_at
  // NOTE: subtype, opening_balance, current_balance, is_system do NOT exist in actual schema
  
  const accountData: any = {
    company_id: companyId,
    code: chartAccount.code,
    name: chartAccount.name,
    type: mapCategoryToType(chartAccount.category || 'Expenses'),
    balance: balance, // Use 'balance' column (actual schema column name)
    is_active: chartAccount.active !== false,
  };
  
  // Add optional parent_id only if provided
  if (chartAccount.parent_account_id || chartAccount.parent_id) {
    accountData.parent_id = chartAccount.parent_account_id || chartAccount.parent_id || null;
  }
  
  // DO NOT include these fields - they don't exist in actual schema:
  // - subtype
  // - opening_balance
  // - current_balance
  // - is_system
  
  return accountData;
}

// ============================================
// 🎯 CHART ACCOUNTS SERVICE (USES EXISTING accounts TABLE)
// ============================================

export const chartAccountService = {
  // Get all accounts (requires companyId)
  async getAllAccounts(companyId: string): Promise<ChartAccount[]> {
    try {
      const accounts = await accountService.getAllAccounts(companyId);
      return accounts.map(acc => mapAccountToChartAccount(acc, companyId));
    } catch (error: any) {
      console.error('[CHART ACCOUNT SERVICE] Error fetching accounts:', error);
      toast.error('Failed to load accounts', { description: error.message });
      return [];
    }
  },

  // Get account by ID
  async getAccountById(id: string, companyId: string): Promise<ChartAccount | null> {
    try {
      const account = await accountService.getAccount(id);
      if (!account) return null;
      return mapAccountToChartAccount(account, companyId);
    } catch (error: any) {
      console.error('[CHART ACCOUNT SERVICE] Error fetching account:', error);
      return null;
    }
  },

  // Create account
  async createAccount(account: Partial<ChartAccount>, companyId: string): Promise<ChartAccount | null> {
    try {
      // Map to accounts table structure (without subtype, opening_balance, is_system)
      const accountData = mapChartAccountToAccount(account, companyId);
      
      // Clean data - ONLY include fields that exist in actual schema
      // Actual schema columns: id, company_id, code, name, type, parent_id, balance, is_active, created_at, updated_at
      const cleanData: any = {
        company_id: accountData.company_id,
        code: accountData.code,
        name: accountData.name,
        type: accountData.type,
        balance: accountData.balance, // Use 'balance' not 'current_balance'
        is_active: accountData.is_active,
      };
      
      // Add optional parent_id only if provided
      if (accountData.parent_id) {
        cleanData.parent_id = accountData.parent_id;
      }
      
      // Explicitly exclude fields that don't exist in schema:
      // - subtype (doesn't exist)
      // - opening_balance (doesn't exist)
      // - current_balance (doesn't exist, use 'balance' instead)
      // - is_system (doesn't exist)
      
      const created = await accountService.createAccount(cleanData);
      if (!created) return null;
      
      toast.success('Account created successfully');
      return mapAccountToChartAccount(created, companyId);
    } catch (error: any) {
      console.error('[CHART ACCOUNT SERVICE] Error creating account:', error);
      toast.error('Failed to create account', { description: error.message });
      return null;
    }
  },

  // Update account
  async updateAccount(
    id: string, 
    updates: Partial<ChartAccount>, 
    companyId: string,
    existingAccount?: ChartAccount
  ): Promise<ChartAccount | null> {
    try {
      // Check if system account - protect name (is_system doesn't exist in schema, but we track it in ChartAccount)
      if (existingAccount?.is_system) {
        // Remove protected fields from updates
        const { name, is_system, active, ...allowedUpdates } = updates;
        if (name !== undefined || is_system !== undefined || active !== undefined) {
          console.warn('[CHART ACCOUNT SERVICE] Attempted to modify protected system account fields');
        }
        updates = allowedUpdates;
      }

      // Map to accounts table structure (without subtype, opening_balance, is_system)
      const updateData = mapChartAccountToAccount(updates, companyId);
      
      // Clean data - ONLY include fields that exist in actual schema
      const cleanData: any = {
        name: updateData.name,
        type: updateData.type,
        balance: updateData.balance,
        is_active: updateData.is_active,
      };
      
      // Add optional fields only if provided
      if (updateData.parent_id !== undefined) {
        cleanData.parent_id = updateData.parent_id;
      }
      if (updateData.code !== undefined) {
        cleanData.code = updateData.code;
      }
      
      // DO NOT include subtype, opening_balance, current_balance, is_system
      
      const updated = await accountService.updateAccount(id, cleanData);
      if (!updated) return null;
      
      toast.success('Account updated successfully');
      return mapAccountToChartAccount(updated, companyId);
    } catch (error: any) {
      console.error('[CHART ACCOUNT SERVICE] Error updating account:', error);
      toast.error('Failed to update account', { description: error.message });
      return null;
    }
  },

  // Check if account has transactions (check journal_entry_lines)
  async hasTransactions(accountId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select('id')
        .eq('account_id', accountId)
        .limit(1);

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          return false;
        }
        console.error('[CHART ACCOUNT SERVICE] Error checking transactions:', error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (error: any) {
      console.error('[CHART ACCOUNT SERVICE] Error:', error);
      return false;
    }
  },

  // Delete account
  async deleteAccount(id: string, companyId: string, account?: ChartAccount): Promise<boolean> {
    try {
      // Check if system account
      if (account?.is_system) {
        toast.error('Cannot delete system account', {
          description: 'System accounts are protected and cannot be deleted.',
        });
        return false;
      }

      // Check if account has transactions
      const hasTxns = await this.hasTransactions(id);
      if (hasTxns) {
        toast.error('Cannot delete account', {
          description: 'This account has existing transactions and cannot be deleted.',
        });
        return false;
      }

      // Soft delete by setting is_active = false
      await accountService.deleteAccount(id);
      toast.success('Account deleted successfully');
      return true;
    } catch (error: any) {
      console.error('[CHART ACCOUNT SERVICE] Error:', error);
      toast.error('Failed to delete account', { description: error.message });
      return false;
    }
  },

  // Toggle active status
  async toggleActive(
    id: string, 
    active: boolean, 
    companyId: string,
    account?: ChartAccount
  ): Promise<ChartAccount | null> {
    // Check if system account
    if (account?.is_system) {
      toast.error('Cannot deactivate system account', {
        description: 'System accounts are protected and cannot be deactivated.',
      });
      return null;
    }

    return this.updateAccount(id, { active }, companyId, account);
  },

  // Create default accounts (using existing accounts table structure)
  async createDefaultAccounts(companyId: string): Promise<ChartAccount[]> {
    const defaultAccounts: Partial<ChartAccount>[] = [
      // ASSETS
      { 
        code: '1000', 
        name: 'Cash', 
        category: 'Assets', 
        sub_category: 'Current Assets', 
        nature: 'Debit', 
        opening_balance: 0, 
        current_balance: 0, 
        is_system: true, 
        active: true 
      },
      { 
        code: '1010', 
        name: 'Bank', 
        category: 'Assets', 
        sub_category: 'Current Assets', 
        nature: 'Debit', 
        opening_balance: 0, 
        current_balance: 0, 
        is_system: true, 
        active: true 
      },
      { 
        code: '1100', 
        name: 'Accounts Receivable', 
        category: 'Assets', 
        sub_category: 'Current Assets', 
        nature: 'Debit', 
        opening_balance: 0, 
        current_balance: 0, 
        is_system: true, 
        active: true 
      },
      
      // LIABILITIES
      { 
        code: '2000', 
        name: 'Accounts Payable', 
        category: 'Liabilities', 
        sub_category: 'Current Liabilities', 
        nature: 'Credit', 
        opening_balance: 0, 
        current_balance: 0, 
        is_system: true, 
        active: true 
      },
      
      // EQUITY
      { 
        code: '3000', 
        name: 'Capital', 
        category: 'Equity', 
        sub_category: 'Capital', 
        nature: 'Credit', 
        opening_balance: 0, 
        current_balance: 0, 
        is_system: true, 
        active: true 
      },
      
      // EXPENSES
      { 
        code: '5100', 
        name: 'Cost of Goods Sold', 
        category: 'Cost of Sales', 
        sub_category: 'Cost of Sales', 
        nature: 'Debit', 
        opening_balance: 0, 
        current_balance: 0, 
        is_system: true, 
        active: true 
      },
      { 
        code: '6000', 
        name: 'Operating Expense', 
        category: 'Expenses', 
        sub_category: 'Operating Expenses', 
        nature: 'Debit', 
        opening_balance: 0, 
        current_balance: 0, 
        is_system: true, 
        active: true 
      },
    ];

    const createdAccounts: ChartAccount[] = [];

    for (const account of defaultAccounts) {
      try {
        // Check if account already exists by code
        const existingAccounts = await accountService.getAllAccounts(companyId);
        const existing = existingAccounts.find(a => a.code === account.code);

        if (existing) {
          continue; // Account exists, skip
        }

        // Create account
        const created = await this.createAccount(account, companyId);
        if (created) {
          createdAccounts.push(created);
        }
      } catch (error: any) {
        console.warn(`[CHART ACCOUNT SERVICE] Error creating default account ${account.code}:`, error.message);
      }
    }

    if (createdAccounts.length > 0) {
      console.log(`[CHART ACCOUNT SERVICE] ✅ Created ${createdAccounts.length} default accounts`);
    }

    return createdAccounts;
  },

  // Get accounts by category
  async getAccountsByCategory(category: AccountCategory, companyId: string): Promise<ChartAccount[]> {
    const allAccounts = await this.getAllAccounts(companyId);
    return allAccounts.filter(acc => acc.category === category && acc.active);
  },

  // Get child accounts
  async getChildAccounts(parentId: string, companyId: string): Promise<ChartAccount[]> {
    const allAccounts = await this.getAllAccounts(companyId);
    return allAccounts.filter(acc => acc.parent_account_id === parentId);
  },
};
