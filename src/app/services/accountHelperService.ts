// ============================================
// 🎯 ACCOUNT HELPER SERVICE
// ============================================
// Helper functions to get default accounts by payment method
// Uses existing accounts table structure

import { accountService } from './accountService';

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'cheque' | 'mobile_wallet' | 'other';

// ============================================
// 🎯 GET DEFAULT ACCOUNT BY PAYMENT METHOD
// ============================================

export const accountHelperService = {
  /**
   * Get default account ID based on payment method
   * Cash → Account with code '1000' (Cash)
   * Bank/Card/Cheque → Account with code '1010' (Bank)
   * Mobile Wallet → First active Mobile Wallet account
   */
  async getDefaultAccountByPaymentMethod(
    paymentMethod: PaymentMethod | string,
    companyId: string
  ): Promise<string | null> {
    try {
      const allAccounts = await accountService.getAllAccounts(companyId);
      
      // Normalize payment method
      const method = paymentMethod.toLowerCase();
      
      // Map payment method to account code/type
      if (method === 'cash') {
        // Find Cash account by code '1000' or type 'cash' or 'asset' with name containing 'Cash'
        const cashAccount = allAccounts.find(acc => 
          acc.code === '1000' || 
          acc.type?.toLowerCase() === 'cash' ||
          (acc.type?.toLowerCase() === 'asset' && acc.name?.toLowerCase().includes('cash'))
        );
        return cashAccount?.id || null;
      }
      
      if (method === 'bank' || method === 'card' || method === 'cheque') {
        // Find Bank account by code '1010' or type 'bank' or 'asset' with name containing 'Bank'
        const bankAccount = allAccounts.find(acc => 
          acc.code === '1010' ||
          acc.type?.toLowerCase() === 'bank' ||
          (acc.type?.toLowerCase() === 'asset' && acc.name?.toLowerCase().includes('bank'))
        );
        return bankAccount?.id || null;
      }
      
      if (method === 'mobile_wallet' || method.includes('wallet')) {
        // Find Mobile Wallet account
        const walletAccount = allAccounts.find(acc => 
          acc.type?.toLowerCase().includes('wallet') ||
          acc.name?.toLowerCase().includes('wallet')
        );
        return walletAccount?.id || null;
      }
      
      // Default: try to find any active account
      const firstActive = allAccounts.find(acc => acc.is_active !== false);
      return firstActive?.id || null;
      
    } catch (error: any) {
      console.error('[ACCOUNT HELPER] Error getting default account:', error);
      return null;
    }
  },

  /**
   * Get account by code (for system accounts)
   */
  async getAccountByCode(code: string, companyId: string): Promise<any | null> {
    try {
      const allAccounts = await accountService.getAllAccounts(companyId);
      return allAccounts.find(acc => acc.code === code) || null;
    } catch (error: any) {
      console.error('[ACCOUNT HELPER] Error getting account by code:', error);
      return null;
    }
  },

  /**
   * Get accounts by type
   */
  async getAccountsByType(
    type: string,
    companyId: string
  ): Promise<any[]> {
    try {
      const allAccounts = await accountService.getAllAccounts(companyId);
      return allAccounts.filter(acc => 
        acc.type?.toLowerCase() === type.toLowerCase() &&
        acc.is_active !== false
      );
    } catch (error: any) {
      console.error('[ACCOUNT HELPER] Error getting accounts by type:', error);
      return [];
    }
  },
};
