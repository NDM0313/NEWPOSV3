// ============================================
// 🎯 DEFAULT ACCOUNTS SERVICE
// ============================================
// Ensures mandatory default accounts exist for every company
// Uses EXISTING accounts table only

import { accountService } from './accountService';
import { supabase } from './supabase';

export interface DefaultAccount {
  code: string;
  name: string;
  type: string;
}

// Mandatory default accounts
const MANDATORY_ACCOUNTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1010', name: 'Bank', type: 'asset' },
  { code: '2000', name: 'Accounts Receivable', type: 'asset' }, // Required for payment entries
];

export const defaultAccountsService = {
  /**
   * Ensure mandatory default accounts exist for a company
   * Called on system init or when accounts are missing
   */
  async ensureDefaultAccounts(companyId: string): Promise<void> {
    try {
      const existingAccounts = await accountService.getAllAccounts(companyId);
      
      // Check which mandatory accounts are missing
      for (const mandatoryAccount of MANDATORY_ACCOUNTS) {
        const exists = existingAccounts.some(
          acc => acc.code === mandatoryAccount.code || 
          (acc.name?.toLowerCase() === mandatoryAccount.name.toLowerCase() && 
           acc.type?.toLowerCase() === mandatoryAccount.type.toLowerCase())
        );
        
        if (!exists) {
          try {
            // Create missing account
            await accountService.createAccount({
              company_id: companyId,
              code: mandatoryAccount.code,
              name: mandatoryAccount.name,
              type: mandatoryAccount.type,
              balance: 0,
              is_active: true,
            });
            
            console.log(`[DEFAULT ACCOUNTS] ✅ Created ${mandatoryAccount.name} account (${mandatoryAccount.code})`);
          } catch (createError: any) {
            console.error(`[DEFAULT ACCOUNTS] ❌ Failed to create ${mandatoryAccount.name}:`, createError);
            // Continue with other accounts even if one fails
          }
        }
      }
    } catch (error: any) {
      console.error('[DEFAULT ACCOUNTS] Error ensuring default accounts:', error);
      throw error;
    }
  },

  /**
   * Get default account by payment method
   * Cash → code '1000'
   * Bank/Card/Cheque → code '1010'
   * Wallet → code '1020' (if exists, otherwise Bank)
   */
  async getDefaultAccountByPaymentMethod(
    paymentMethod: string,
    companyId: string
  ): Promise<string | null> {
    try {
      const allAccounts = await accountService.getAllAccounts(companyId);
      const method = paymentMethod.toLowerCase();
      
      let targetCode: string | null = null;
      
      if (method === 'cash') {
        targetCode = '1000';
      } else if (method === 'bank' || method === 'card' || method === 'cheque') {
        targetCode = '1010';
      } else if (method === 'mobile_wallet' || method.includes('wallet')) {
        // Try wallet first, fallback to bank
        const walletAccount = allAccounts.find(acc => acc.code === '1020');
        if (walletAccount) {
          return walletAccount.id;
        }
        targetCode = '1010'; // Fallback to Bank
      }
      
      if (targetCode) {
        const account = allAccounts.find(acc => acc.code === targetCode);
        return account?.id || null;
      }
      
      return null;
    } catch (error: any) {
      console.error('[DEFAULT ACCOUNTS] Error getting default account:', error);
      return null;
    }
  },

  /**
   * Check if account is a mandatory default account (cannot be deleted)
   */
  isMandatoryAccount(account: { code?: string; name?: string }): boolean {
    return MANDATORY_ACCOUNTS.some(
      ma => ma.code === account.code || 
      ma.name.toLowerCase() === account.name?.toLowerCase()
    );
  },
};
