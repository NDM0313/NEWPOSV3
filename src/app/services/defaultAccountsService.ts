// ============================================
// 🎯 DEFAULT ACCOUNTS SERVICE
// ============================================
// Ensures mandatory default accounts exist for every company
// Uses EXISTING accounts table only

import { accountService } from './accountService';

export interface DefaultAccount {
  code: string;
  name: string;
  type: string;
}

// ============================================
// 🎯 CORE ACCOUNTING BACKBONE (NON-NEGOTIABLE)
// ============================================
// These 3 accounts are MANDATORY for EVERY business
// They exist regardless of Accounting Module ON/OFF status
// They CANNOT be deleted, only renamed
// ============================================
const CORE_PAYMENT_ACCOUNTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash', type: 'cash' }, // Core payment account - NEVER DELETE
  { code: '1010', name: 'Bank', type: 'bank' }, // Core payment account - NEVER DELETE
  { code: '1020', name: 'Mobile Wallet', type: 'mobile_wallet' }, // Core payment account - NEVER DELETE
];

// Additional mandatory accounts (for accounting module)
const ADDITIONAL_MANDATORY_ACCOUNTS: DefaultAccount[] = [
  { code: '1100', name: 'Accounts Receivable', type: 'asset' }, // Required for customer payment entries
  { code: '2000', name: 'Accounts Payable', type: 'liability' }, // Required for supplier/purchase payment entries
];

// Combined list (for backward compatibility)
const MANDATORY_ACCOUNTS: DefaultAccount[] = [
  ...CORE_PAYMENT_ACCOUNTS,
  ...ADDITIONAL_MANDATORY_ACCOUNTS,
];

export const defaultAccountsService = {
  /**
   * 🔒 CORE ACCOUNTING BACKBONE - Ensure mandatory payment accounts exist
   * 
   * CRITICAL RULES:
   * - These 3 accounts (Cash, Bank, Mobile Wallet) are MANDATORY for EVERY business
   * - They exist regardless of Accounting Module ON/OFF status
   * - They CANNOT be deleted (enforced in accountService.deleteAccount)
   * - They are ALWAYS active
   * - Only rename is allowed (optional)
   * 
   * Called on:
   * - Business creation (create_business_transaction.sql)
   * - System init (SupabaseContext)
   * - Branch creation (branchService)
   */
  async ensureDefaultAccounts(companyId: string): Promise<void> {
    try {
      const existingAccounts = await accountService.getAllAccounts(companyId);
      
      // 🔒 STEP 1: Ensure CORE payment accounts (NON-NEGOTIABLE)
      for (const coreAccount of CORE_PAYMENT_ACCOUNTS) {
        const exists = existingAccounts.some(
          acc => acc.code === coreAccount.code || 
          (acc.name?.toLowerCase() === coreAccount.name.toLowerCase() && 
           (acc.type?.toLowerCase() === coreAccount.type.toLowerCase() || 
            acc.type?.toLowerCase() === 'asset'))
        );
        
        if (!exists) {
          try {
            // Create missing CORE account
            await accountService.createAccount({
              company_id: companyId,
              code: coreAccount.code,
              name: coreAccount.name,
              type: coreAccount.type, // 'cash', 'bank', 'mobile_wallet'
              balance: 0,
              is_active: true, // ALWAYS active
            });
            
            console.log(`[CORE ACCOUNTS] ✅ Created ${coreAccount.name} account (${coreAccount.code}) - MANDATORY`);
          } catch (createError: any) {
            console.error(`[CORE ACCOUNTS] ❌ CRITICAL: Failed to create ${coreAccount.name}:`, createError);
            // CRITICAL: Core accounts are non-negotiable - throw error
            throw new Error(`Failed to create mandatory ${coreAccount.name} account: ${createError.message}`);
          }
        }
      }
      
      // STEP 2: Ensure additional mandatory accounts (for accounting module)
      // These are created but not critical for payment flows
      for (const mandatoryAccount of ADDITIONAL_MANDATORY_ACCOUNTS) {
        const exists = existingAccounts.some(
          acc => acc.code === mandatoryAccount.code || 
          (acc.name?.toLowerCase() === mandatoryAccount.name.toLowerCase() && 
           acc.type?.toLowerCase() === mandatoryAccount.type.toLowerCase())
        );
        
        if (!exists) {
          try {
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
            // Continue with other accounts even if one fails (non-critical)
          }
        }
      }
    } catch (error: any) {
      console.error('[CORE ACCOUNTS] ❌ CRITICAL ERROR ensuring default accounts:', error);
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
   * 🔒 Check if account is a CORE payment account (cannot be deleted)
   * 
   * CORE accounts (Cash, Bank, Mobile Wallet) are:
   * - Non-negotiable
   * - Cannot be deleted
   * - Always active
   * - Only rename allowed
   */
  isCorePaymentAccount(account: { code?: string; name?: string; type?: string }): boolean {
    return CORE_PAYMENT_ACCOUNTS.some(
      ca => ca.code === account.code || 
      (ca.name.toLowerCase() === account.name?.toLowerCase() &&
       (ca.type === account.type?.toLowerCase() || 
        (ca.type === 'cash' && account.type?.toLowerCase() === 'asset' && account.name?.toLowerCase().includes('cash')) ||
        (ca.type === 'bank' && account.type?.toLowerCase() === 'asset' && account.name?.toLowerCase().includes('bank')) ||
        (ca.type === 'mobile_wallet' && account.type?.toLowerCase()?.includes('wallet'))))
    );
  },

  /**
   * Check if account is a mandatory default account (cannot be deleted)
   * @deprecated Use isCorePaymentAccount for payment accounts
   */
  isMandatoryAccount(account: { code?: string; name?: string }): boolean {
    return MANDATORY_ACCOUNTS.some(
      ma => ma.code === account.code || 
      ma.name.toLowerCase() === account.name?.toLowerCase()
    );
  },

  /**
   * Get core payment accounts list (for frontend/validation)
   */
  getCorePaymentAccounts(): DefaultAccount[] {
    return [...CORE_PAYMENT_ACCOUNTS];
  },
};
