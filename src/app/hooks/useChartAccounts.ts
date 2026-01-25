import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { chartAccountService, ChartAccount, AccountCategory } from '@/app/services/chartAccountService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';

// ============================================
// 🎯 USE CHART ACCOUNTS HOOK
// ============================================

export const useChartAccounts = () => {
  const { companyId } = useSupabase();
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedDefaults = useRef(false);

  // Fetch all accounts
  const fetchAccounts = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('Company ID is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await chartAccountService.getAllAccounts(companyId);
      setAccounts(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load accounts';
      setError(errorMessage);
      console.error('[USE CHART ACCOUNTS] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Create account
  const createAccount = useCallback(async (account: Partial<ChartAccount>) => {
    if (!companyId) {
      toast.error('Company ID is required');
      return null;
    }
    try {
      const newAccount = await chartAccountService.createAccount(account, companyId);
      if (newAccount) {
        await fetchAccounts(); // Refresh list
        return newAccount;
      }
      return null;
    } catch (err: any) {
      console.error('[USE CHART ACCOUNTS] Error creating account:', err);
      return null;
    }
  }, [fetchAccounts, companyId]);

  // Update account
  const updateAccount = useCallback(async (id: string, updates: Partial<ChartAccount>) => {
    if (!companyId) {
      toast.error('Company ID is required');
      return null;
    }
    try {
      const existingAccount = accounts.find(a => a.id === id);
      const updatedAccount = await chartAccountService.updateAccount(id, updates, companyId, existingAccount);
      if (updatedAccount) {
        await fetchAccounts(); // Refresh list
        return updatedAccount;
      }
      return null;
    } catch (err: any) {
      console.error('[USE CHART ACCOUNTS] Error updating account:', err);
      return null;
    }
  }, [fetchAccounts, accounts, companyId]);

  // Delete account
  const deleteAccount = useCallback(async (id: string) => {
    if (!companyId) {
      toast.error('Company ID is required');
      return false;
    }
    try {
      const account = accounts.find(a => a.id === id);
      const success = await chartAccountService.deleteAccount(id, companyId, account);
      if (success) {
        await fetchAccounts(); // Refresh list
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[USE CHART ACCOUNTS] Error deleting account:', err);
      return false;
    }
  }, [fetchAccounts, accounts, companyId]);

  // Toggle active status
  const toggleActive = useCallback(async (id: string, active: boolean) => {
    if (!companyId) {
      toast.error('Company ID is required');
      return null;
    }
    try {
      const account = accounts.find(a => a.id === id);
      const result = await chartAccountService.toggleActive(id, active, companyId, account);
      if (result) {
        await fetchAccounts(); // Refresh list
        return result;
      }
      return null;
    } catch (err: any) {
      console.error('[USE CHART ACCOUNTS] Error toggling active:', err);
      return null;
    }
  }, [accounts, fetchAccounts, companyId]);

  // Get accounts by category
  const getAccountsByCategory = useCallback((category: AccountCategory): ChartAccount[] => {
    return accounts.filter(acc => acc.category === category && acc.active);
  }, [accounts]);

  // Build account tree
  const buildAccountTree = useCallback((accountsList: ChartAccount[]): ChartAccount[] => {
    const accountMap = new Map<string, ChartAccount & { children?: ChartAccount[] }>();
    const rootAccounts: ChartAccount[] = [];

    // First pass: create map
    accountsList.forEach(account => {
      accountMap.set(account.id!, { ...account, children: [] });
    });

    // Second pass: build tree
    accountsList.forEach(account => {
      const currentAccount = accountMap.get(account.id!)!;
      if (account.parent_account_id && accountMap.has(account.parent_account_id)) {
        const parent = accountMap.get(account.parent_account_id)!;
        if (!parent.children) parent.children = [];
        parent.children.push(currentAccount);
      } else {
        rootAccounts.push(currentAccount);
      }
    });

    // Sort by category and code
    const categoryOrder: AccountCategory[] = ['Assets', 'Liabilities', 'Equity', 'Income', 'Cost of Sales', 'Expenses'];
    return rootAccounts.sort((a, b) => {
      const categoryCompare = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
      if (categoryCompare !== 0) return categoryCompare;
      return a.code.localeCompare(b.code);
    });
  }, []);

  // Get account tree
  const accountTree = useMemo(() => buildAccountTree(accounts), [accounts, buildAccountTree]);

  // Initial fetch
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Auto-create defaults after first load (only once)
  useEffect(() => {
    // Only run once, after initial load completes and companyId is available
    if (!loading && !hasInitializedDefaults.current && companyId) {
      hasInitializedDefaults.current = true;
      
      // Small delay to ensure everything is ready
      const timer = setTimeout(async () => {
        try {
          // Check if accounts exist
          const existingAccounts = await chartAccountService.getAllAccounts(companyId);
          
          // If no accounts, create defaults
          if (existingAccounts.length === 0) {
            console.log('[USE CHART ACCOUNTS] No accounts found, creating default accounts...');
            const created = await chartAccountService.createDefaultAccounts(companyId);
            if (created.length > 0) {
              // Refresh accounts list
              const refreshed = await chartAccountService.getAllAccounts(companyId);
              setAccounts(refreshed);
            }
          }
        } catch (err: any) {
          console.warn('[USE CHART ACCOUNTS] Error initializing default accounts:', err.message);
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [loading, companyId]); // Depend on loading and companyId

  return {
    accounts,
    accountTree,
    loading,
    error,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleActive,
    getAccountsByCategory,
    buildAccountTree,
  };
};
