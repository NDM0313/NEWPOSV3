import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useGlobalFilterOptional } from '@/app/context/GlobalFilterContext';
import { accountService, Account as SupabaseAccount } from '@/app/services/accountService';
import { accountingService, JournalEntryWithLines, JournalEntryLine } from '@/app/services/accountingService';
import { documentNumberService } from '@/app/services/documentNumberService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';
import { getOrCreateLedger, addLedgerEntry } from '@/app/services/ledgerService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/** True if account is a payment account (Cash/Bank/Mobile Wallet) – used for Manual Entry → Roznamcha rule */
function isPaymentAccount(acc: { code?: string; type?: string; name?: string } | null): boolean {
  if (!acc) return false;
  const code = (acc.code || '').trim();
  const type = (acc.type || acc.accountType || '').toLowerCase();
  const name = (acc.name || '').toLowerCase();
  if (['1000', '1010', '1020'].includes(code)) return true;
  if (['cash', 'bank'].includes(type)) return true;
  if (/cash|bank|mobile wallet|wallet|jazz|easypaisa/.test(name)) return true;
  return false;
}

/** Infer payments.payment_method from payment account (for manual payment/receipt) */
function paymentMethodFromAccount(acc: { code?: string; type?: string; name?: string }): string {
  const code = (acc.code || '').trim();
  const name = (acc.name || '').toLowerCase();
  if (code === '1000' || name.includes('cash')) return 'cash';
  if (code === '1010' || name.includes('bank')) return 'bank';
  return 'other';
}

// ============================================
// 🎯 TYPES & INTERFACES
// ============================================

export type AccountType = 
  | 'Cash' 
  | 'Bank' 
  | 'Mobile Wallet' 
  | 'Accounts Receivable' 
  | 'Accounts Payable'
  | 'Worker Payable'
  | 'Security Deposit'
  | 'Rental Advance'
  | 'Sales Income'
  | 'Rental Income'
  | 'Studio Sales Income'
  | 'Rental Damage Income'
  | 'Cost of Production'
  | 'Inventory'
  | 'Purchase Expense'
  | 'Expense';

export type TransactionSource = 
  | 'Sale' 
  | 'Rental' 
  | 'Studio' 
  | 'Expense' 
  | 'Payment'
  | 'Purchase'
  | 'Manual';

export type PaymentMethod = 'Cash' | 'Bank' | 'Mobile Wallet';

export interface AccountingEntry {
  id: string;
  date: Date;
  source: TransactionSource;
  referenceNo: string;
  debitAccount: AccountType;
  creditAccount: AccountType;
  amount: number;
  description: string;
  createdBy: string;
  module: string;
  metadata?: {
    customerId?: string;
    customerName?: string;
    workerId?: string;
    workerName?: string;
    supplierId?: string;
    supplierName?: string;
    bookingId?: string;
    invoiceId?: string;
    purchaseId?: string;
    stage?: string;
    /** Attachments for journal entry (saved to journal_entries.attachments). */
    attachments?: { url: string; name: string }[];
    /** Optional user reference (e.g. voucher no); saved with description, primary reference is always entry_no. */
    optionalReference?: string;
    /** Journal entry created_at for date+time display (ISO string). */
    createdAt?: string;
  };
}

export interface AccountBalance {
  accountType: AccountType;
  balance: number;
  lastUpdated: Date;
}

interface AccountingContextType {
  entries: AccountingEntry[];
  balances: Map<AccountType, number>;
  loading: boolean;
  
  // Core functions
  createEntry: (entry: Omit<AccountingEntry, 'id' | 'date' | 'createdBy'>) => Promise<boolean>;
  refreshEntries: () => Promise<void>;
  getEntriesByReference: (referenceNo: string) => AccountingEntry[];
  getEntriesBySource: (source: TransactionSource) => AccountingEntry[];
  getAccountBalance: (accountType: AccountType) => number;
  
  // Query helpers
  getEntriesBySupplier: (supplierName: string, supplierId?: string) => AccountingEntry[];
  getEntriesByCustomer: (customerName: string, customerId?: string) => AccountingEntry[];
  getEntriesByWorker: (workerName: string, workerId?: string) => AccountingEntry[];
  getSupplierBalance: (supplierName: string, supplierId?: string) => number;
  getCustomerBalance: (customerName: string, customerId?: string) => number;
  getWorkerBalance: (workerName: string, workerId?: string) => number;
  
  // Module-specific functions
  recordSale: (params: SaleAccountingParams) => Promise<boolean>;
  recordSalePayment: (params: SalePaymentParams) => Promise<boolean>;
  recordRentalBooking: (params: RentalBookingParams) => Promise<boolean>;
  recordRentalDelivery: (params: RentalDeliveryParams) => Promise<boolean>;
  recordRentalCreditDelivery: (params: RentalDeliveryParams) => Promise<boolean>;
  recordRentalReturn: (params: RentalReturnParams) => Promise<boolean>;
  recordStudioSale: (params: StudioSaleParams) => Promise<boolean>;
  recordWorkerJobCompletion: (params: WorkerJobParams) => Promise<boolean>;
  recordWorkerPayment: (params: WorkerPaymentParams) => Promise<boolean | { referenceNumber: string }>;
  recordExpense: (params: ExpenseParams) => Promise<boolean>;
  recordPurchase: (params: PurchaseParams) => Promise<boolean>;
  recordSupplierPayment: (params: SupplierPaymentParams) => Promise<boolean>;
  /** On-account customer payment (no invoice): Dr Cash/Bank, Cr AR; ledger by customerId */
  recordOnAccountCustomerPayment: (params: OnAccountCustomerPaymentParams) => Promise<boolean>;
  
  // Account management
  accounts: Account[];
  getAccountsByType: (type: PaymentMethod) => Account[];
  getAccountById: (id: string) => Account | undefined;
}

// ============================================
// 🎯 PARAMETER INTERFACES
// ============================================

export interface SaleAccountingParams {
  saleId: string; // CRITICAL FIX: UUID of the sale (for reference_id)
  invoiceNo: string; // Invoice number (for referenceNo)
  customerName: string;
  customerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  module: string;
}

export interface SalePaymentParams {
  saleId: string; // CRITICAL FIX: UUID of the sale (for reference_id)
  invoiceNo: string; // Invoice number (for referenceNo)
  customerName: string;
  customerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  accountId?: string; // CRITICAL: Account ID for payment_account_id
}

export interface RentalBookingParams {
  bookingId: string;
  customerName: string;
  customerId?: string;
  advanceAmount: number;
  securityDepositAmount: number;
  securityDepositType: 'Cash' | 'Document';
  paymentMethod: PaymentMethod;
}

export interface RentalDeliveryParams {
  bookingId: string;
  customerName: string;
  customerId?: string;
  remainingAmount: number;
  paymentMethod: PaymentMethod;
}

export interface RentalReturnParams {
  bookingId: string;
  customerName: string;
  customerId?: string;
  securityDepositAmount: number;
  damageCharge?: number;
  paymentMethod?: PaymentMethod;
}

export interface StudioSaleParams {
  invoiceNo: string;
  customerName: string;
  customerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
}

export interface WorkerJobParams {
  invoiceNo: string;
  workerName: string;
  workerId?: string;
  stage: 'Dyeing' | 'Stitching' | 'Handwork';
  cost: number;
}

export interface WorkerPaymentParams {
  workerName: string;
  workerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  /** Payment account (Cash/Bank) ID – required for canonical flow (payments row → Roznamcha). */
  paymentAccountId?: string;
  /** Ignored when using canonical worker payment service (ref generated there). */
  referenceNo?: string;
  /** When paying for a specific stage (Pay Now), pass stageId and optionally stageAmount (job amount) so full payment skips extra ledger row */
  stageId?: string;
  /** Job amount for this stage; when amount >= stageAmount we skip recordAccountingPaymentToLedger and rely on markStageLedgerPaid */
  stageAmount?: number;
}

export interface ExpenseParams {
  expenseId: string;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
}

export interface PurchaseParams {
  purchaseId: string;
  supplierName: string;
  supplierId?: string;
  amount: number;
  purchaseType: 'Inventory' | 'Expense';
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  description: string;
}

export interface SupplierPaymentParams {
  purchaseId?: string;
  supplierName: string;
  supplierId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
}

export interface OnAccountCustomerPaymentParams {
  customerId?: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  accountId?: string;
  referenceNo: string;
}

// ============================================
// 🎯 ACCOUNT STRUCTURE
// ============================================

export interface Account {
  id: string;
  name: string;
  type: PaymentMethod;
  accountType: AccountType;
  balance: number;
  branch?: string;
  branchId?: string; // UUID for branch filter in payment dialog
  isActive: boolean;
  code?: string; // Add code for account lookup
}

// ============================================
// 🎯 CONTEXT CREATION
// ============================================

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

// ============================================
// 🎯 PROVIDER COMPONENT
// ============================================

export const AccountingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [balances, setBalances] = useState<Map<AccountType, number>>(new Map());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { companyId, branchId, user, userRole } = useSupabase();
  const globalFilter = useGlobalFilterOptional();
const startDateISO = globalFilter?.startDate ?? (() => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return start.toISOString().slice(0, 10);
})();
const endDateISO = globalFilter?.endDate ?? new Date().toISOString().slice(0, 10);

  // Current user (from auth context)
  const currentUser = user?.email || 'Admin';
  const currentUserId = user?.id;

  // Convert Supabase account format to app format
  const convertFromSupabaseAccount = useCallback((supabaseAccount: any): Account => {
    // CRITICAL FIX: account_type doesn't exist in actual schema, use type instead
    const accountType = supabaseAccount.type || 'Cash';
    return {
      id: supabaseAccount.id,
      name: supabaseAccount.name || '',
      type: accountType as PaymentMethod,
      accountType: accountType, // Use type as accountType (no separate account_type column)
      balance: parseFloat(supabaseAccount.balance || supabaseAccount.current_balance || 0),
      branch: supabaseAccount.branch_name || supabaseAccount.branch_id || '',
      branchId: supabaseAccount.branch_id || undefined, // For payment dialog branch filter
      isActive: supabaseAccount.is_active !== false,
      code: supabaseAccount.code || undefined, // CRITICAL FIX: Include code for account lookup
    };
  }, []);
  
  // Convert journal entry from Supabase to AccountingEntry format
  const convertFromJournalEntry = useCallback((journalEntry: JournalEntryWithLines): AccountingEntry => {
    // Find debit and credit lines
    const debitLine = journalEntry.lines?.find(line => line.debit > 0);
    const creditLine = journalEntry.lines?.find(line => line.credit > 0);

    // Determine source from reference_type
    const sourceMap: Record<string, TransactionSource> = {
      'sale': 'Sale',
      'purchase': 'Purchase',
      'expense': 'Expense',
      'rental': 'Rental',
      'studio': 'Studio',
      'payment': 'Payment',
      'worker_payment': 'Payment',
      'manual': 'Manual',
    };

    const source = sourceMap[journalEntry.reference_type || 'manual'] || 'Manual';

    // Payment reference: no longer embedded in main query; use entry_no as primary
    const paymentRef = (journalEntry as any).payment ? (Array.isArray((journalEntry as any).payment) ? (journalEntry as any).payment[0]?.reference_number : (journalEntry as any).payment?.reference_number) : undefined;
    const paymentMethod = (journalEntry as any).payment ? (Array.isArray((journalEntry as any).payment) ? (journalEntry as any).payment[0]?.payment_method : (journalEntry as any).payment?.payment_method) : undefined;

    // Account names from embedded account (journal-based; no legacy ledger)
    const debitAccountName = debitLine?.account_name ?? (debitLine as any)?.account?.name ?? 'Expense';
    const creditAccountName = creditLine?.account_name ?? (creditLine as any)?.account?.name ?? 'Cash';

    // Extract metadata from description or reference
    const metadata: AccountingEntry['metadata'] = {
      journalEntryId: journalEntry.id,
      referenceId: journalEntry.reference_id,
      referenceType: journalEntry.reference_type,
      paymentId: journalEntry.payment_id,
      paymentMethod: paymentMethod,
      createdAt: (journalEntry as { created_at?: string }).created_at ?? undefined,
    };
    
    if (journalEntry.reference_id) {
      if (source === 'Sale') metadata.invoiceId = journalEntry.reference_id;
      if (source === 'Purchase') metadata.purchaseId = journalEntry.reference_id;
      if (source === 'Expense') metadata.expenseId = journalEntry.reference_id;
    }

    // Get reference number - prefer entry_no, then payment reference, then id
    const referenceNo = journalEntry.entry_no || paymentRef || journalEntry.id?.substring(0, 8) || 'N/A';

    return {
      id: journalEntry.id || '',
      date: new Date(journalEntry.entry_date),
      source,
      referenceNo: referenceNo,
      debitAccount: (debitAccountName || 'Expense') as AccountType,
      creditAccount: (creditAccountName || 'Cash') as AccountType,
      amount: debitLine?.debit || creditLine?.credit || 0,
      description: journalEntry.description,
      createdBy: journalEntry.created_by || 'System',
      module: source === 'Sale' ? 'Sales' : source === 'Purchase' ? 'Purchases' : source === 'Expense' ? 'Expenses' : source === 'Rental' ? 'Rental' : source === 'Studio' ? 'Studio' : 'Accounting',
      metadata,
    };
  }, []);

  // Load accounts from database
  const loadAccounts = useCallback(async () => {
    if (!companyId) return;
    
    try {
      const data = await accountService.getAllAccounts(companyId, branchId === 'all' ? undefined : branchId || undefined);
      const convertedAccounts = data.map(convertFromSupabaseAccount);
      setAccounts(convertedAccounts);
      if (import.meta.env?.DEV) console.log('✅ Accounts loaded:', convertedAccounts.length);
    } catch (error) {
      console.error('[ACCOUNTING CONTEXT] Error loading accounts:', error);
      setAccounts([]);
    }
  }, [companyId, branchId, convertFromSupabaseAccount]);

  // Load journal entries from database
  const loadEntries = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Convert ISO strings back to Date objects only at call time — deps stay as stable primitives
      const startDate = startDateISO ? new Date(startDateISO) : null;
      const endDate = endDateISO ? new Date(endDateISO) : null;
      const data = await accountingService.getAllEntries(
        companyId, 
        branchId === 'all' ? undefined : branchId || undefined,
        startDate,
        endDate
      );
      const convertedEntries = data.map(convertFromJournalEntry);
      setEntries(convertedEntries);
      if (import.meta.env?.DEV) console.log('✅ Journal entries loaded:', convertedEntries.length);
      
      // Recalculate balances from real entries
      recalculateBalances(convertedEntries);
    } catch (error) {
      console.error('[ACCOUNTING CONTEXT] Error loading journal entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, startDateISO, endDateISO, convertFromJournalEntry]);

  // Recalculate balances from entries
  const recalculateBalances = useCallback((entriesToUse: AccountingEntry[]) => {
    const newBalances = new Map<AccountType, number>();
    
    entriesToUse.forEach(entry => {
      // Update debit account
      const currentDebit = newBalances.get(entry.debitAccount) || 0;
      newBalances.set(entry.debitAccount, currentDebit + entry.amount);
      
      // Update credit account
      const currentCredit = newBalances.get(entry.creditAccount) || 0;
      newBalances.set(entry.creditAccount, currentCredit + entry.amount);
    });
    
    setBalances(newBalances);
  }, []);

  // Load accounts and entries on mount and when company/branch/date range changes
  useEffect(() => {
    if (companyId) {
      loadAccounts();
      loadEntries();
    }
  }, [companyId, branchId, startDateISO, endDateISO, loadAccounts, loadEntries]);

  // CRITICAL: Listen for purchase/sale delete events to refresh entries
  useEffect(() => {
    const handlePurchaseDelete = () => {
      console.log('[ACCOUNTING CONTEXT] Purchase deleted, refreshing entries...');
      loadEntries();
    };
    
    const handleSaleDelete = () => {
      console.log('[ACCOUNTING CONTEXT] Sale deleted, refreshing entries...');
      loadEntries();
    };

    window.addEventListener('purchaseDeleted', handlePurchaseDelete);
    window.addEventListener('saleDeleted', handleSaleDelete);
    
    return () => {
      window.removeEventListener('purchaseDeleted', handlePurchaseDelete);
      window.removeEventListener('saleDeleted', handleSaleDelete);
    };
  }, [loadEntries]);
  
  // ============================================
  // 🎯 REAL DATA LOADING (NO DEMO DATA)
  // ============================================
  // All data is now loaded from database via loadEntries() and loadAccounts()
  // No demo/static initialization - all entries come from journal_entries table

  // ============================================
  // 🔧 HELPER: Generate unique ID
  // ============================================
  const generateId = () => {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // ============================================
  // 🔧 HELPER: Validate double entry
  // ============================================
  const validateEntry = (debitAccount: AccountType, creditAccount: AccountType, amount: number): boolean => {
    if (amount <= 0) {
      console.error('Amount must be positive');
      return false;
    }
    if (debitAccount === creditAccount) {
      console.error('Debit and Credit accounts cannot be the same');
      return false;
    }
    return true;
  };

  // ============================================
  // 🔧 HELPER: Update balances
  // ============================================
  const updateBalances = (debitAccount: AccountType, creditAccount: AccountType, amount: number) => {
    const newBalances = new Map(balances);
    
    // Update debit account
    const currentDebit = newBalances.get(debitAccount) || 0;
    newBalances.set(debitAccount, currentDebit + amount);
    
    // Update credit account
    const currentCredit = newBalances.get(creditAccount) || 0;
    newBalances.set(creditAccount, currentCredit + amount);
    
    setBalances(newBalances);
  };

  // ============================================
  // 🎯 CORE: Create Entry (SAVES TO DATABASE)
  // ============================================
  const createEntry = async (entry: Omit<AccountingEntry, 'id' | 'date' | 'createdBy'>): Promise<boolean> => {
    // [WORKER LEDGER DEBUG] Log createEntry input
    if (typeof window !== 'undefined' && (entry.debitAccount === 'Worker Payable' || entry.creditAccount === 'Worker Payable')) {
      console.log('[WORKER LEDGER DEBUG] createEntry input', {
        source: entry.source,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount: entry.amount,
        metadataWorkerId: entry.metadata?.workerId ?? null,
        metadataWorkerName: entry.metadata?.workerName ?? null,
      });
    }

    // CRITICAL FIX: Validate branchId - must be valid UUID or null, not "all"
    const validBranchId = (branchId && branchId !== 'all') ? branchId : null;
    
    if (!companyId) {
      console.error('[ACCOUNTING] Cannot create entry: companyId missing');
      toast.error('Cannot create entry: Company not set');
      return false;
    }

    if (!validateEntry(entry.debitAccount, entry.creditAccount, entry.amount)) {
      return false;
    }

    // CRITICAL FIX: Declare variables outside try block to fix scope error
    let debitAccountObj: Account | undefined;
    let creditAccountObj: Account | undefined;
    let normalizedDebitAccount = '';
    let normalizedCreditAccount = '';

    try {
      // Map common account name variations to actual account names
      const accountNameMap: Record<string, string> = {
        'cash': 'Cash',
        'Cash': 'Cash',
        'bank': 'Bank',
        'Bank': 'Bank',
        'mobile wallet': 'Mobile Wallet',
        'Mobile Wallet': 'Mobile Wallet',
        'mobile_wallet': 'Mobile Wallet',
        'accounts receivable': 'Accounts Receivable',
        'Accounts Receivable': 'Accounts Receivable',
        'accounts payable': 'Accounts Payable',
        'Accounts Payable': 'Accounts Payable',
        'worker payable': 'Worker Payable',
        'Worker Payable': 'Worker Payable',
        'cost of production': 'Cost of Production',
        'Cost of Production': 'Cost of Production',
        'sales income': 'Sales Revenue',
        'Sales Income': 'Sales Revenue',
        'Sales Revenue': 'Sales Revenue',
        'rental income': 'Rental Income',
        'Rental Income': 'Rental Income',
        'rental damage income': 'Rental Damage Income',
        'Rental Damage Income': 'Rental Damage Income',
      };

      normalizedDebitAccount = accountNameMap[entry.debitAccount] || entry.debitAccount;
      normalizedCreditAccount = accountNameMap[entry.creditAccount] || entry.creditAccount;
      // Generate entry number
      const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const entryDate = new Date().toISOString().split('T')[0];

      // Find account IDs for debit and credit (case-insensitive)
      // When metadata.debitAccountId is set (e.g. on-account payment), use that for debit
      const debitAccountIdFromMeta = (entry.metadata as any)?.debitAccountId;
      if (debitAccountIdFromMeta) {
        debitAccountObj = accounts.find(acc => acc.id === debitAccountIdFromMeta);
      }
      if (!debitAccountObj) {
      // CRITICAL FIX: accountType might not exist, use type, name, and code for lookup
      debitAccountObj = accounts.find(acc => {
        const accType = acc.accountType || acc.type || '';
        const accName = acc.name || '';
        const accCode = acc.code || '';
        return (
          accType.toLowerCase() === normalizedDebitAccount.toLowerCase() ||
          accType.toLowerCase().replace(/_/g, ' ') === normalizedDebitAccount.toLowerCase() ||
          accName.toLowerCase() === normalizedDebitAccount.toLowerCase() ||
          accName.toLowerCase().includes(normalizedDebitAccount.toLowerCase()) ||
          // Match by code for default accounts
          (normalizedDebitAccount === 'Cash' && (accCode === '1000' || accName.toLowerCase().includes('cash'))) ||
          (normalizedDebitAccount === 'Bank' && (accCode === '1010' || accName.toLowerCase().includes('bank'))) ||
          (normalizedDebitAccount === 'Mobile Wallet' && (accCode === '1020' || accType.toLowerCase().includes('mobile') || accName.toLowerCase().includes('wallet'))) ||
          (normalizedDebitAccount === 'Accounts Receivable' && (accCode === '1100' || accName.toLowerCase().includes('receivable'))) ||
          (normalizedDebitAccount === 'Accounts Payable' && (accCode === '2000' || accName.toLowerCase().includes('payable'))) ||
          (normalizedDebitAccount === 'Worker Payable' && (accCode === '2010' || accName.toLowerCase().includes('worker'))) ||
          (normalizedDebitAccount === 'Expense' && (accCode === '5100' || accCode === '5200' || accCode === '6000' || accType.toLowerCase() === 'expense' || accName.toLowerCase().includes('expense')))
        );
      });
      }
      creditAccountObj = accounts.find(acc => {
        const accType = acc.accountType || acc.type || '';
        const accName = acc.name || '';
        const accCode = acc.code || '';
        return (
          accType.toLowerCase() === normalizedCreditAccount.toLowerCase() ||
          accName.toLowerCase() === normalizedCreditAccount.toLowerCase() ||
          accName.toLowerCase().includes(normalizedCreditAccount.toLowerCase()) ||
          // Match by code for default accounts
          (normalizedCreditAccount === 'Cash' && (accCode === '1000' || accName.toLowerCase().includes('cash'))) ||
          (normalizedCreditAccount === 'Bank' && (accCode === '1010' || accName.toLowerCase().includes('bank'))) ||
          (normalizedCreditAccount === 'Mobile Wallet' && (accCode === '1020' || accType.toLowerCase().includes('mobile') || accName.toLowerCase().includes('wallet') || accName.toLowerCase().includes('jazz') || accName.toLowerCase().includes('easypaisa'))) ||
          (normalizedCreditAccount === 'Accounts Receivable' && (accCode === '1100' || accName.toLowerCase().includes('receivable'))) ||
          (normalizedCreditAccount === 'Accounts Payable' && (accCode === '2000' || accName.toLowerCase().includes('payable'))) ||
          (normalizedCreditAccount === 'Worker Payable' && (accCode === '2010' || accName.toLowerCase().includes('worker'))) ||
          // Rental/Sales revenue fallback
          (normalizedCreditAccount === 'Rental Income' && (accName.toLowerCase().includes('rental') || accName.toLowerCase().includes('revenue') || accName.toLowerCase().includes('sales'))) ||
          (normalizedCreditAccount === 'Rental Damage Income' && (accName.toLowerCase().includes('rental') || accName.toLowerCase().includes('damage') || accName.toLowerCase().includes('income'))) ||
          (normalizedCreditAccount === 'Sales Revenue' && (accName.toLowerCase().includes('sales') || accName.toLowerCase().includes('revenue') || accName.toLowerCase().includes('income')))
        );
      });
      // Expense payment fallback: if credit (payment method) not found, use Cash (1000) so double-entry always completes
      if (!creditAccountObj && entry.debitAccount === 'Expense' && entry.source === 'Expense') {
        creditAccountObj = accounts.find(acc => acc.code === '1000' || (acc.name || '').toLowerCase().includes('cash'));
      }

      if (!debitAccountObj || !creditAccountObj) {
        console.error('[ACCOUNTING] Account not found:', { 
          debitAccount: entry.debitAccount, 
          normalizedDebit: normalizedDebitAccount,
          creditAccount: entry.creditAccount,
          normalizedCredit: normalizedCreditAccount,
          availableAccounts: accounts.map(a => ({ 
            id: a.id,
            name: a.name, 
            type: a.type,
            accountType: a.accountType 
          }))
        });
        
        // CRITICAL FIX: Ensure default accounts exist and reload (only admin/manager/accountant can INSERT per RLS)
        if (companyId) {
          try {
            const canCreateAccounts = ['admin', 'manager', 'accountant'].includes(String(userRole || '').toLowerCase());
            if (canCreateAccounts) {
              const { defaultAccountsService } = await import('@/app/services/defaultAccountsService');
              await defaultAccountsService.ensureDefaultAccounts(companyId);
            }
            // Reload accounts
            const refreshedData = await accountService.getAllAccounts(companyId, branchId === 'all' ? undefined : branchId || undefined);
            const refreshedAccounts = refreshedData.map((acc: any) => ({
              id: acc.id,
              name: acc.name || '',
              type: (acc.type || 'Cash') as PaymentMethod,
              accountType: acc.type || 'Cash',
              balance: parseFloat(acc.balance || 0),
              branch: acc.branch_name || acc.branch_id || '',
              isActive: acc.is_active !== false,
              code: acc.code || undefined, // CRITICAL FIX: Include code for account lookup
            }));
            setAccounts(refreshedAccounts);
            
            // Retry lookup with refreshed accounts (include code in search)
            const retryDebit = refreshedAccounts.find(acc => {
              const accType = (acc.accountType || acc.type || '').toString().toLowerCase();
              const accName = (acc.name || '').toLowerCase();
              const accCode = acc.code || '';
              return (
                accType === normalizedDebitAccount.toLowerCase() ||
                accName === normalizedDebitAccount.toLowerCase() ||
                accName.includes(normalizedDebitAccount.toLowerCase()) ||
                (normalizedDebitAccount === 'Cash' && (accCode === '1000' || accName.includes('cash'))) ||
                (normalizedDebitAccount === 'Bank' && (accCode === '1010' || accName.includes('bank'))) ||
                (normalizedDebitAccount === 'Mobile Wallet' && (accCode === '1020' || accType.includes('mobile') || accName.includes('wallet'))) ||
                (normalizedDebitAccount === 'Accounts Receivable' && (accCode === '1100' || accName.includes('receivable'))) ||
                (normalizedDebitAccount === 'Accounts Payable' && (accCode === '2000' || accName.includes('payable'))) ||
                (normalizedDebitAccount === 'Worker Payable' && (accCode === '2010' || accName.includes('worker')))
              );
            });
            const retryCredit = refreshedAccounts.find(acc => {
              const accType = (acc.accountType || acc.type || '').toString().toLowerCase();
              const accName = (acc.name || '').toLowerCase();
              const accCode = acc.code || '';
              return (
                accType === normalizedCreditAccount.toLowerCase() ||
                accName === normalizedCreditAccount.toLowerCase() ||
                accName.includes(normalizedCreditAccount.toLowerCase()) ||
                (normalizedCreditAccount === 'Cash' && (accCode === '1000' || accName.includes('cash'))) ||
                (normalizedCreditAccount === 'Bank' && (accCode === '1010' || accName.includes('bank'))) ||
                (normalizedCreditAccount === 'Accounts Receivable' && (accCode === '1100' || accName.includes('receivable'))) ||
                (normalizedCreditAccount === 'Accounts Payable' && (accCode === '2000' || accName.includes('payable'))) ||
                (normalizedCreditAccount === 'Worker Payable' && (accCode === '2010' || accName.includes('worker'))) ||
                (normalizedCreditAccount === 'Sales Revenue' && (accCode === '4000' || accName.includes('sales') || accName.includes('revenue')))
              );
            });
            
            if (retryDebit && retryCredit) {
              // Update the account objects for use in journal entry creation
              debitAccountObj = retryDebit;
              creditAccountObj = retryCredit;
              
              // Use retry accounts - continue with journal entry creation
              // Primary reference = auto entry_no; optional user ref in description
              let descRetry = entry.description || '';
              if (entry.metadata?.optionalReference?.trim()) {
                descRetry += (descRetry ? '\n' : '') + 'Ref: ' + entry.metadata.optionalReference.trim();
              }
      const isWorkerPaymentRetry = entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId;
      const journalEntry: JournalEntry = {
        company_id: companyId,
        branch_id: validBranchId,
        entry_no: `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        entry_date: new Date().toISOString().split('T')[0],
        description: descRetry || undefined,
        reference_type: isWorkerPaymentRetry ? 'worker_payment' : entry.source.toLowerCase(),
        reference_id: isWorkerPaymentRetry ? entry.metadata.workerId : (entry.metadata?.saleId || entry.metadata?.purchaseId || entry.metadata?.expenseId || entry.metadata?.bookingId || null),
        created_by: currentUserId || null,
        attachments: entry.metadata?.attachments && entry.metadata.attachments.length > 0 ? entry.metadata.attachments : undefined,
      };
      const lines: JournalEntryLine[] = [
        { account_id: retryDebit.id, debit: entry.amount, credit: 0, description: descRetry || entry.description },
        { account_id: retryCredit.id, debit: 0, credit: entry.amount, description: descRetry || entry.description },
      ];
      const paymentId = entry.metadata?.paymentId;
      const savedEntry = await accountingService.createEntry(journalEntry, lines, paymentId);
              if (typeof window !== 'undefined' && entry.debitAccount === 'Worker Payable') {
                console.log('[WORKER LEDGER DEBUG] (retry path) journal insert result', { journalEntryId: (savedEntry as any)?.id ?? null });
              }
              const retryPayNowFull =
                entry.metadata?.stageId != null &&
                entry.metadata?.stageAmount != null &&
                typeof entry.metadata.stageAmount === 'number' &&
                entry.amount >= entry.metadata.stageAmount;
              if (entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId && companyId && !retryPayNowFull) {
                if (typeof window !== 'undefined') {
                  console.log('[WORKER LEDGER DEBUG] (retry path) calling worker ledger sync', { workerId: entry.metadata.workerId });
                }
                try {
                  const { studioProductionService } = await import('@/app/services/studioProductionService');
                  await studioProductionService.recordAccountingPaymentToLedger({
                    companyId,
                    workerId: entry.metadata.workerId,
                    amount: entry.amount,
                    paymentReference: entry.referenceNo,
                    journalEntryId: (savedEntry as any)?.id,
                    notes: entry.description || `Payment to worker`,
                  });
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
                  }
                } catch (e) {
                  console.warn('[AccountingContext] Worker ledger entry failed (journal saved):', e);
                }
              } else if (entry.debitAccount === 'Worker Payable' && (retryPayNowFull || !entry.metadata?.workerId) && typeof window !== 'undefined') {
                if (retryPayNowFull) {
                  console.log('[WORKER LEDGER DEBUG] (retry path) Pay Now full payment – skip worker_ledger insert');
                  if (entry.metadata?.workerId) {
                    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
                  }
                } else {
                  console.warn('[WORKER LEDGER DEBUG] (retry path) Worker Payable debit but no metadata.workerId');
                }
              }
              const convertedEntry = convertFromJournalEntry(savedEntry as JournalEntryWithLines);
              setEntries(prev => [convertedEntry, ...prev]);
              updateBalances(entry.debitAccount, entry.creditAccount, entry.amount);
              console.log('✅ Accounting Entry Created and Saved:', convertedEntry);
              toast.success('Accounting entry created successfully');
              return true;
            }
          } catch (ensureError: any) {
            console.error('[ACCOUNTING] Error ensuring default accounts:', ensureError);
          }
        }
        
        toast.error(`Account not found: ${!debitAccountObj ? normalizedDebitAccount : normalizedCreditAccount}. Please create the account first.`);
        return false;
      }

      // Canonical rule: if a transaction touches Cash/Bank/Wallet, create payments row so Roznamcha shows it
      let manualPaymentId: string | null = null;
      let manualRefType: string | null = null;
      const debitIsPayment = debitAccountObj ? isPaymentAccount(debitAccountObj) : false;
      const creditIsPayment = creditAccountObj ? isPaymentAccount(creditAccountObj) : false;

      if (entry.source === 'Manual' && debitAccountObj && creditAccountObj) {
        if (debitIsPayment && !creditIsPayment) {
          const refNo = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'payment').catch(() => generatePaymentReference(null));
          const { data: { user } } = await supabase.auth.getUser();
          const { data: row, error } = await supabase.from('payments').insert({
            company_id: companyId,
            branch_id: validBranchId,
            payment_type: 'received',
            reference_type: 'manual_receipt',
            reference_id: null,
            amount: entry.amount,
            payment_method: paymentMethodFromAccount(debitAccountObj),
            payment_account_id: debitAccountObj.id,
            payment_date: entryDate,
            reference_number: refNo,
            received_by: (user as any)?.id ?? null,
            created_by: currentUserId ?? null,
          }).select('id').single();
          if (!error && row) { manualPaymentId = (row as { id: string }).id; manualRefType = 'manual_receipt'; }
        } else if (!debitIsPayment && creditIsPayment) {
          const refNo = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'payment').catch(() => generatePaymentReference(null));
          const { data: { user } } = await supabase.auth.getUser();
          const manualPaymentPayload: Record<string, unknown> = {
            company_id: companyId,
            branch_id: validBranchId,
            payment_type: 'paid',
            reference_type: 'manual_payment',
            reference_id: null,
            amount: entry.amount,
            payment_method: paymentMethodFromAccount(creditAccountObj),
            payment_account_id: creditAccountObj.id,
            payment_date: entryDate,
            reference_number: refNo,
            received_by: (user as any)?.id ?? null,
            created_by: currentUserId ?? null,
          };
          // Supplier ledger: set contact_id when Dr AP (supplier payment) and supplier selected (real schema: payments.contact_id)
          const manualSupplierContactId = (entry.debitAccount === 'Accounts Payable' && (entry.metadata as any)?.contactId) ? (entry.metadata as any).contactId : null;
          if (manualSupplierContactId) manualPaymentPayload.contact_id = manualSupplierContactId;
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.debug('[SUPPLIER_LEDGER] Manual payment payload', { contact_id: manualSupplierContactId ?? null, reference_type: 'manual_payment', amount: manualPaymentPayload.amount });
          }
          const { data: row, error } = await supabase.from('payments').insert(manualPaymentPayload).select('id').single();
          if (!error && row) { manualPaymentId = (row as { id: string }).id; manualRefType = 'manual_payment'; }
        }
      }

      // Expense: Dr Expense Cr Cash/Bank → must create payments row (reference_type = expense) so Roznamcha shows it
      if (entry.source === 'Expense' && creditAccountObj && debitAccountObj && creditIsPayment) {
        const refNo = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'payment').catch(() => generatePaymentReference(null));
        const { data: { user } } = await supabase.auth.getUser();
        const expenseId = (entry.metadata as any)?.expenseId ?? null;
        const { data: row, error } = await supabase.from('payments').insert({
          company_id: companyId,
          branch_id: validBranchId,
          payment_type: 'paid',
          reference_type: 'expense',
          reference_id: expenseId,
          amount: entry.amount,
          payment_method: paymentMethodFromAccount(creditAccountObj),
          payment_account_id: creditAccountObj.id,
          payment_date: entryDate,
          reference_number: refNo,
          received_by: (user as any)?.id ?? null,
          created_by: currentUserId ?? null,
        }).select('id').single();
        if (!error && row) { manualPaymentId = (row as { id: string }).id; manualRefType = 'expense'; }
      }

      // Primary reference is always auto (entry_no). Optional user reference saved in description.
      let descriptionToSave = entry.description || '';
      if (entry.metadata?.optionalReference?.trim()) {
        descriptionToSave += (descriptionToSave ? '\n' : '') + 'Ref: ' + entry.metadata.optionalReference.trim();
      }

      // Create journal entry (matching database schema)
      // CRITICAL FIX: Use null instead of undefined for optional UUID fields to prevent "undefinedundefined" error
      // CRITICAL FIX: Use validBranchId (not "all") to prevent UUID error
      // Worker payment: store worker_id in journal so ledger/backfill can trace (reference_type=worker_payment, reference_id=workerId)
      const isWorkerPayment = entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId;
      if (typeof window !== 'undefined' && entry.debitAccount === 'Worker Payable') {
        console.log('[WORKER LEDGER DEBUG] journal payload', {
          isWorkerPayment,
          reference_type: isWorkerPayment ? 'worker_payment' : entry.source.toLowerCase(),
          reference_id: isWorkerPayment ? entry.metadata?.workerId : null,
          debitAccountId: debitAccountObj?.id,
          creditAccountId: creditAccountObj?.id,
        });
      }
      const journalEntry: JournalEntry = {
        company_id: companyId,
        branch_id: validBranchId,
        entry_no: entryNo,
        entry_date: entryDate,
        description: descriptionToSave || undefined,
        reference_type: manualRefType || (isWorkerPayment ? 'worker_payment' : entry.source.toLowerCase()),
        reference_id: isWorkerPayment ? entry.metadata.workerId : (entry.metadata?.saleId || entry.metadata?.purchaseId || entry.metadata?.expenseId || entry.metadata?.bookingId || null),
        created_by: currentUserId || null,
        attachments: entry.metadata?.attachments && entry.metadata.attachments.length > 0 ? entry.metadata.attachments : undefined,
      };

      // Create journal entry lines (matching database schema - no account_name)
      const lines: JournalEntryLine[] = [
        {
          account_id: debitAccountObj.id,
          debit: entry.amount,
          credit: 0,
          description: descriptionToSave || entry.description,
        },
        {
          account_id: creditAccountObj.id,
          debit: 0,
          credit: entry.amount,
          description: descriptionToSave || entry.description,
        },
      ];

      // Save to database (link to payment when Manual entry involves payment account)
      const paymentIdToLink = manualPaymentId || (entry.metadata as any)?.paymentId;
      const savedEntry = await accountingService.createEntry(journalEntry, lines, paymentIdToLink);
      if (typeof window !== 'undefined' && entry.debitAccount === 'Worker Payable') {
        console.log('[WORKER LEDGER DEBUG] journal insert result', {
          journalEntryId: (savedEntry as any)?.id ?? null,
          entry_no: (savedEntry as any)?.entry_no ?? null,
        });
      }

      // Manual supplier payment (Dr AP, Cr Cash/Bank): sync to supplier ledger (ledger_master.entity_id = supplier contact id)
      if (manualRefType === 'manual_payment' && manualPaymentId && companyId && entry.debitAccount === 'Accounts Payable') {
        const supplierContactId = (entry.metadata as any)?.contactId;
        const supplierName = (entry.metadata as any)?.contactName ?? (entry.metadata as any)?.supplierName ?? 'Supplier';
        if (supplierContactId) {
          try {
            const ledger = await getOrCreateLedger(companyId, 'supplier', supplierContactId, supplierName);
            if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
              console.debug('[SUPPLIER_LEDGER] getOrCreateLedger result', { ledgerId: ledger?.id ?? null, entity_id: ledger?.entity_id ?? null, entity_name: ledger?.entity_name ?? null });
            }
            if (ledger) {
              const addParams = {
                companyId,
                ledgerId: ledger.id,
                entryDate,
                debit: entry.amount,
                credit: 0,
                source: 'payment' as const,
                referenceNo: (savedEntry as any)?.entry_no ?? manualPaymentId,
                referenceId: manualPaymentId,
                remarks: entry.description || `Manual payment to ${supplierName}`,
              };
              if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
                console.debug('[SUPPLIER_LEDGER] addLedgerEntry payload', addParams);
              }
              const ledgerEntryRow = await addLedgerEntry(addParams);
              if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
                console.debug('[SUPPLIER_LEDGER] addLedgerEntry result', { id: (ledgerEntryRow as any)?.id ?? null });
              }
              window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: supplierContactId } }));
            }
          } catch (e) {
            console.warn('[AccountingContext] Supplier ledger sync for manual payment failed:', e);
          }
        } else if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('[SUPPLIER_LEDGER] Skip supplier ledger sync: no contactId in metadata');
        }
      }

      // Worker Payable debit = worker payment → sync to worker_ledger_entries so worker ledger shows it (Journal already has reference_type=worker_payment, reference_id=workerId)
      // Pay Now (stageId): full payment (amount >= stageAmount) → skip ledger insert; caller will markStageLedgerPaid. Partial → add payment row.
      const isPayNowFullPayment =
        entry.metadata?.stageId != null &&
        entry.metadata?.stageAmount != null &&
        typeof entry.metadata.stageAmount === 'number' &&
        entry.amount >= entry.metadata.stageAmount;
      if (entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId && companyId && !isPayNowFullPayment) {
        if (typeof window !== 'undefined') {
          console.log('[WORKER LEDGER DEBUG] calling worker ledger sync', {
            workerId: entry.metadata.workerId,
            amount: entry.amount,
            journalEntryId: (savedEntry as any)?.id,
            stageId: entry.metadata.stageId ?? null,
            stageAmount: entry.metadata.stageAmount ?? null,
            isPayNowFullPayment,
          });
        }
        try {
          const { studioProductionService } = await import('@/app/services/studioProductionService');
          await studioProductionService.recordAccountingPaymentToLedger({
            companyId,
            workerId: entry.metadata.workerId,
            amount: entry.amount,
            paymentReference: entry.referenceNo,
            journalEntryId: (savedEntry as any)?.id,
            notes: entry.description || `Payment to worker`,
          });
          if (typeof window !== 'undefined') {
            console.log('[WORKER LEDGER DEBUG] worker ledger sync OK', { workerId: entry.metadata.workerId });
            window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
          }
        } catch (e) {
          console.warn('[AccountingContext] Worker ledger entry failed (journal saved):', e);
          if (typeof window !== 'undefined') {
            console.error('[WORKER LEDGER DEBUG] worker ledger sync FAILED', { workerId: entry.metadata.workerId, error: e });
          }
        }
      } else if (entry.debitAccount === 'Worker Payable' && isPayNowFullPayment && typeof window !== 'undefined') {
        console.log('[WORKER LEDGER DEBUG] Pay Now full payment – skip worker_ledger insert; caller will markStageLedgerPaid', {
          workerId: entry.metadata?.workerId,
          amount: entry.amount,
          stageId: entry.metadata?.stageId,
        });
        if (entry.metadata?.workerId) {
          window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
        }
      } else if (entry.debitAccount === 'Worker Payable' && !entry.metadata?.workerId && typeof window !== 'undefined') {
        console.warn('[WORKER LEDGER DEBUG] Worker Payable debit but no metadata.workerId – entry will NOT appear in worker ledger. Use Pay Worker flow or select worker in Manual Entry.');
      }

      // Convert and add to local state
      const convertedEntry = convertFromJournalEntry(savedEntry as JournalEntryWithLines);
      setEntries(prev => [convertedEntry, ...prev]);
      
      // Update balances
    updateBalances(entry.debitAccount, entry.creditAccount, entry.amount);

      console.log('✅ Accounting Entry Created and Saved:', convertedEntry);
      toast.success('Accounting entry created successfully');
    return true;
    } catch (error: any) {
      console.error('[ACCOUNTING] Error creating entry:', {
        error,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        debitAccountObj: debitAccountObj?.id,
        creditAccountObj: creditAccountObj?.id,
        companyId,
        branchId
      });
      
      // Show user-friendly error message
      if (error?.code === 'PGRST205' || error?.message?.includes('does not exist')) {
        toast.error('Journal Entries table not found. Please run CREATE_JOURNAL_ENTRIES_TABLE.sql in Supabase SQL Editor.', {
          duration: 10000,
        });
      } else {
        toast.error(error?.message || 'Failed to create accounting entry');
      }
      return false;
    }
  };

  // ============================================
  // 📊 QUERY FUNCTIONS
  // ============================================
  
  const getEntriesByReference = (referenceNo: string): AccountingEntry[] => {
    return entries.filter(entry => entry.referenceNo === referenceNo);
  };

  const getEntriesBySource = (source: TransactionSource): AccountingEntry[] => {
    return entries.filter(entry => entry.source === source);
  };

  const getAccountBalance = (accountType: AccountType): number => {
    return balances.get(accountType) || 0;
  };

  // Query helpers for entities
  const getEntriesBySupplier = (supplierName: string, supplierId?: string): AccountingEntry[] => {
    return entries.filter(entry => {
      const metadata = entry.metadata;
      if (!metadata) return false;
      return metadata.supplierName === supplierName || 
             (supplierId && metadata.supplierId === supplierId);
    });
  };

  const getEntriesByCustomer = (customerName: string, customerId?: string): AccountingEntry[] => {
    return entries.filter(entry => {
      const metadata = entry.metadata;
      if (!metadata) return false;
      return metadata.customerName === customerName || 
             (customerId && metadata.customerId === customerId);
    });
  };

  const getEntriesByWorker = (workerName: string, workerId?: string): AccountingEntry[] => {
    return entries.filter(entry => {
      const metadata = entry.metadata;
      if (!metadata) return false;
      return metadata.workerName === workerName || 
             (workerId && metadata.workerId === workerId);
    });
  };

  const getSupplierBalance = (supplierName: string, supplierId?: string): number => {
    const supplierEntries = getEntriesBySupplier(supplierName, supplierId);
    let balance = 0;
    supplierEntries.forEach(entry => {
      if (entry.debitAccount === 'Accounts Payable') {
        balance -= entry.amount; // Payment reduces balance
      } else if (entry.creditAccount === 'Accounts Payable') {
        balance += entry.amount; // Purchase increases balance
      }
    });
    return balance;
  };

  const getCustomerBalance = (customerName: string, customerId?: string): number => {
    const customerEntries = getEntriesByCustomer(customerName, customerId);
    let balance = 0;
    customerEntries.forEach(entry => {
      if (entry.debitAccount === 'Accounts Receivable') {
        balance += entry.amount; // Sale increases balance
      } else if (entry.creditAccount === 'Accounts Receivable') {
        balance -= entry.amount; // Payment reduces balance
      }
    });
    return balance;
  };

  const getWorkerBalance = (workerName: string, workerId?: string): number => {
    const workerEntries = getEntriesByWorker(workerName, workerId);
    let balance = 0;
    workerEntries.forEach(entry => {
      if (entry.debitAccount === 'Worker Payable') {
        balance -= entry.amount; // Payment reduces balance
      } else if (entry.creditAccount === 'Worker Payable') {
        balance += entry.amount; // Job completion increases balance
      }
    });
    return balance;
  };

  // ============================================
  // 💰 SALES MODULE → ACCOUNTING
  // ============================================
  
  const recordSale = async (params: SaleAccountingParams): Promise<boolean> => {
    const { saleId, invoiceNo, customerName, customerId, amount, paymentMethod, paidAmount, module } = params;

    // CRITICAL FIX: Map paymentMethod to correct account name
    const paymentAccountMap: Record<string, string> = {
      'cash': 'Cash',
      'Cash': 'Cash',
      'bank': 'Bank',
      'Bank': 'Bank',
      'card': 'Bank', // Card payments go to bank account
      'other': 'Bank',
    };
    const debitAccount = paymentAccountMap[paymentMethod as string] || paymentMethod || 'Cash';

    // Full payment
    if (paidAmount >= amount) {
      return await createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: debitAccount,
        creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
        amount: amount,
        description: `Sale to ${customerName} - Full Payment`,
        module: module,
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }
    
    // Partial or credit sale
    if (paidAmount > 0) {
      // Record payment
      await createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: debitAccount,
        creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
        amount: paidAmount,
        description: `Sale to ${customerName} - Partial Payment`,
        module: module,
        metadata: { customerId, customerName, saleId, invoiceNo }
      });

      // Record receivable
      return await createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: 'Accounts Receivable',
        creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
        amount: amount - paidAmount,
        description: `Sale to ${customerName} - Credit`,
        module: module,
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }

    // Full credit
    return await createEntry({
      source: 'Sale',
      referenceNo: invoiceNo,
      debitAccount: 'Accounts Receivable',
      creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
      amount: amount,
      description: `Sale to ${customerName} - Credit`,
      module: module,
      metadata: { customerId, customerName, invoiceId: invoiceNo }
    });
  };

  const recordSalePayment = async (params: SalePaymentParams): Promise<boolean> => {
    const { saleId, invoiceNo, customerName, customerId, amount, paymentMethod, accountId } = params;

    // CRITICAL FIX: Use provided accountId or find default account based on payment method
    let paymentAccountId = accountId;
    
    if (!paymentAccountId && companyId) {
      // Try to get default account by payment method
      const { accountHelperService } = await import('@/app/services/accountHelperService');
      paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
        paymentMethod,
        companyId
      ) || null;
    }
    
    // If still no account, find from accounts list
    if (!paymentAccountId) {
      const paymentMethodToType: Record<string, 'Cash' | 'Bank' | 'Mobile Wallet'> = {
        'cash': 'Cash',
        'Cash': 'Cash',
        'bank': 'Bank',
        'Bank': 'Bank',
        'card': 'Bank',
        'cheque': 'Bank',
        'other': 'Bank',
        'mobile wallet': 'Mobile Wallet',
        'Mobile Wallet': 'Mobile Wallet',
      };
      
      const accountType = paymentMethodToType[paymentMethod as string] || 'Cash';
      
      const defaultAccount = accounts.find(acc => 
        (acc.type === accountType || acc.accountType === accountType) && 
        acc.isActive
      );
      
      if (defaultAccount) {
        paymentAccountId = defaultAccount.id;
      }
    }
    
    if (!paymentAccountId) {
      const errorMsg = `No account found for ${paymentMethod} payment. Please select an account or create a default account.`;
      console.error('[ACCOUNTING]', errorMsg);
      toast.error(errorMsg);
      return false;
    }

    // CRITICAL FIX: Payment journal entry is now created automatically by database trigger
    // DO NOT create duplicate journal entry here
    // The trigger `trigger_auto_create_payment_journal` handles this automatically
    // We only need to ensure the payment exists (which it does, from SalesContext.recordPayment)
    
    // Verify payment exists and trigger will create journal entry
    try {
      if (companyId && branchId) {
        const { supabase } = await import('@/lib/supabase');
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('reference_type', 'sale')
          .eq('reference_id', saleId)
          .eq('amount', amount)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!existingPayment) {
          console.warn('[ACCOUNTING] Payment not found - trigger will create journal entry when payment is inserted');
        } else {
          // Check if journal entry already exists (from trigger)
          const { data: existingJournal } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('payment_id', existingPayment.id)
            .maybeSingle();
          
          if (!existingJournal) {
            console.warn('[ACCOUNTING] Journal entry not yet created by trigger - it should be created automatically');
          }
        }
      }
    } catch (error: any) {
      console.warn('[ACCOUNTING] Error verifying payment/journal entry (non-critical):', error);
    }
    
    // DO NOT call createEntry() here - trigger handles it automatically
    // This prevents duplicate journal entries
    return true;
  };

  // ============================================
  // 🏠 RENTAL MODULE → ACCOUNTING
  // ============================================

  const recordRentalBooking = async (params: RentalBookingParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, advanceAmount, securityDepositAmount, securityDepositType, paymentMethod } = params;

    // Record advance
    const advanceSuccess = await createEntry({
      source: 'Rental',
      referenceNo: bookingId,
      debitAccount: paymentMethod as AccountType,
      creditAccount: 'Rental Advance',
      amount: advanceAmount,
      description: `Rental booking advance - ${customerName}`,
      module: 'Rental',
      metadata: { customerId, customerName, bookingId }
    });

    // Record security deposit (only if cash)
    if (securityDepositType === 'Cash' && securityDepositAmount > 0) {
      await createEntry({
        source: 'Rental',
        referenceNo: bookingId,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Security Deposit',
        amount: securityDepositAmount,
        description: `Security deposit (Cash) - ${customerName}`,
        module: 'Rental',
        metadata: { customerId, customerName, bookingId }
      });
    }

    return advanceSuccess;
  };

  const recordRentalDelivery = async (params: RentalDeliveryParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, remainingAmount, paymentMethod } = params;

    // Use Sales Revenue (code 4000) - exists in default accounts; Rental Income falls back to it
    return await createEntry({
      source: 'Rental',
      referenceNo: bookingId,
      debitAccount: paymentMethod as AccountType,
      creditAccount: 'Sales Revenue',
      amount: remainingAmount,
      description: `Rental remaining payment - ${customerName}`,
      module: 'Rental',
      metadata: { customerId, customerName, bookingId }
    });
  };

  /** When delivering on credit: Debit AR, Credit Rental Income (customer owes) */
  const recordRentalCreditDelivery = async (params: RentalDeliveryParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, remainingAmount } = params;
    return await createEntry({
      source: 'Rental',
      referenceNo: bookingId,
      debitAccount: 'Accounts Receivable',
      creditAccount: 'Sales Revenue',
      amount: remainingAmount,
      description: `Rental credit - ${customerName}`,
      module: 'Rental',
      metadata: { customerId, customerName, bookingId }
    });
  };

  const recordRentalReturn = async (params: RentalReturnParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, securityDepositAmount, damageCharge, paymentMethod } = params;

    if (damageCharge && damageCharge > 0) {
      // Damage charge: Debit Cash, Credit Sales Revenue (or Other Income)
      await createEntry({
        source: 'Rental',
        referenceNo: bookingId,
        debitAccount: (paymentMethod || 'Cash') as AccountType,
        creditAccount: 'Sales Revenue',
        amount: damageCharge,
        description: `Rental damage charge - ${customerName}`,
        module: 'Rental',
        metadata: { customerId, customerName, bookingId }
      });
    }

    // Release security deposit
    if (securityDepositAmount > 0) {
      return await createEntry({
        source: 'Rental',
        referenceNo: bookingId,
        debitAccount: 'Security Deposit',
        creditAccount: 'Cash',
        amount: securityDepositAmount,
        description: `Security deposit returned - ${customerName}`,
        module: 'Rental',
        metadata: { customerId, customerName, bookingId }
      });
    }

    return true;
  };

  // ============================================
  // 🎨 STUDIO MODULE → ACCOUNTING
  // ============================================

  const recordStudioSale = async (params: StudioSaleParams): Promise<boolean> => {
    const { invoiceNo, customerName, customerId, amount, paymentMethod, paidAmount } = params;

    // Full payment
    if (paidAmount >= amount) {
      return await createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Studio Sales Income',
        amount: amount,
        description: `Studio sale to ${customerName} - Full Payment`,
        module: 'Studio',
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }

    // Partial or credit
    if (paidAmount > 0) {
      await createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Studio Sales Income',
        amount: paidAmount,
        description: `Studio sale to ${customerName} - Partial Payment`,
        module: 'Studio',
        metadata: { customerId, customerName, saleId, invoiceNo }
      });

      return await createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: 'Accounts Receivable',
        creditAccount: 'Studio Sales Income',
        amount: amount - paidAmount,
        description: `Studio sale to ${customerName} - Credit`,
        module: 'Studio',
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }

    // Full credit
    return await createEntry({
      source: 'Studio',
      referenceNo: invoiceNo,
      debitAccount: 'Accounts Receivable',
      creditAccount: 'Studio Sales Income',
      amount: amount,
      description: `Studio sale to ${customerName} - Credit`,
      module: 'Studio',
      metadata: { customerId, customerName, invoiceId: invoiceNo }
    });
  };

  const recordWorkerJobCompletion = async (params: WorkerJobParams): Promise<boolean> => {
    const { invoiceNo, workerName, workerId, stage, cost } = params;

    return await createEntry({
      source: 'Studio',
      referenceNo: invoiceNo,
      debitAccount: 'Cost of Production',
      creditAccount: 'Worker Payable',
      amount: cost,
      description: `${stage} job completed by ${workerName}`,
      module: 'Studio',
      metadata: { workerId, workerName, invoiceId: invoiceNo, stage }
    });
  };

  const recordWorkerPayment = async (params: WorkerPaymentParams): Promise<boolean | { referenceNumber: string }> => {
    const { workerName, workerId, amount, paymentMethod, paymentAccountId, referenceNo, stageId, stageAmount } = params;
    const effectiveWorkerId = workerId ?? null;
    const workerPaymentBranchId = (branchId && branchId !== 'all') ? branchId : null;

    // Canonical path: one payments row (Roznamcha) + journal + worker_ledger_entries (Phase-2)
    if (companyId && effectiveWorkerId && paymentAccountId) {
      try {
        const { createWorkerPayment } = await import('@/app/services/workerPaymentService');
        const result = await createWorkerPayment({
          companyId,
          branchId: workerPaymentBranchId,
          workerId: effectiveWorkerId,
          workerName,
          amount,
          paymentMethod: paymentMethod as string,
          paymentAccountId,
          stageId: stageId ?? null,
          stageAmount: stageAmount ?? null,
        });
        if (typeof window !== 'undefined' && effectiveWorkerId) {
          window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: effectiveWorkerId } }));
        }
        return { referenceNumber: result.referenceNumber };
      } catch (e: any) {
        console.error('[AccountingContext] recordWorkerPayment (canonical) failed:', e);
        toast.error(e?.message || 'Worker payment failed');
        return false;
      }
    }

    // Fallback: journal + worker_ledger only (no payments row – will not show in Roznamcha)
    const fallbackRef = referenceNo || `PAY-${Date.now()}`;
    const success = await createEntry({
      source: 'Payment',
      referenceNo: fallbackRef,
      debitAccount: 'Worker Payable',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `Payment to worker ${workerName}`,
      module: 'Accounting',
      metadata: { workerId: effectiveWorkerId, workerName, stageId, stageAmount }
    });
    return success;
  };

  // ============================================
  // 💸 EXPENSE MODULE → ACCOUNTING
  // ============================================

  const recordExpense = async (params: ExpenseParams): Promise<boolean> => {
    const { expenseId, category, amount, paymentMethod, description } = params;

    return await createEntry({
      source: 'Expense',
      referenceNo: expenseId,
      debitAccount: 'Expense',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `${category} - ${description}`,
      module: 'Expenses',
      metadata: { expenseId }
    });
  };

  const recordPurchase = async (params: PurchaseParams): Promise<boolean> => {
    const { purchaseId, supplierName, supplierId, amount, purchaseType, paidAmount, paymentMethod, description } = params;

    // Full payment
    if (paidAmount && paidAmount >= amount) {
      return await createEntry({
        source: 'Purchase',
        referenceNo: purchaseId,
        debitAccount: paymentMethod as AccountType,
        creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
        amount: amount,
        description: `Purchase from ${supplierName} - Full Payment`,
        module: 'Purchases',
        metadata: { supplierId, supplierName, purchaseId }
      });
    }
    
    // Partial or credit purchase
    if (paidAmount && paidAmount > 0) {
      // Record payment
      await createEntry({
        source: 'Purchase',
        referenceNo: purchaseId,
        debitAccount: paymentMethod as AccountType,
        creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
        amount: paidAmount,
        description: `Purchase from ${supplierName} - Partial Payment`,
        module: 'Purchases',
        metadata: { supplierId, supplierName, purchaseId }
      });

      // Record payable
      return await createEntry({
        source: 'Purchase',
        referenceNo: purchaseId,
        debitAccount: 'Accounts Payable',
        creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
        amount: amount - paidAmount,
        description: `Purchase from ${supplierName} - Credit`,
        module: 'Purchases',
        metadata: { supplierId, supplierName, purchaseId }
      });
    }

    // Full credit
    return await createEntry({
      source: 'Purchase',
      referenceNo: purchaseId,
      debitAccount: 'Accounts Payable',
      creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
      amount: amount,
      description: `Purchase from ${supplierName} - Credit`,
      module: 'Purchases',
      metadata: { supplierId, supplierName, purchaseId }
    });
  };

  const recordSupplierPayment = async (params: SupplierPaymentParams): Promise<boolean> => {
    const { purchaseId, supplierName, supplierId, amount, paymentMethod, referenceNo } = params;

    // STEP 2 FIX: Use 'purchase' as reference_type to match payment record
    return await createEntry({
      source: 'Purchase', // Changed from 'Payment' to 'Purchase' to match payment record reference_type
      referenceNo: referenceNo,
      debitAccount: 'Accounts Payable',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `Payment to supplier ${supplierName}`,
      module: 'Purchases',
      metadata: { supplierId, supplierName, purchaseId }
    });
  };

  /** On-account customer payment: no sale; Dr Cash/Bank, Cr AR. Ledger by metadata.customerId */
  const recordOnAccountCustomerPayment = async (params: OnAccountCustomerPaymentParams): Promise<boolean> => {
    const { customerId, customerName, amount, paymentMethod, accountId, referenceNo } = params;
    if (!accountId) {
      toast.error('Payment account is required for on-account payment.');
      return false;
    }
    return await createEntry({
      source: 'Payment',
      referenceNo,
      debitAccount: paymentMethod as AccountType,
      creditAccount: 'Accounts Receivable',
      amount,
      description: `On-account payment from ${customerName}`,
      module: 'Sales',
      metadata: { customerId, customerName, debitAccountId: accountId }
    });
  };

  // ============================================
  // 🎯 CONTEXT VALUE
  // ============================================

  // Refresh both accounts and entries
  const refreshEntries = useCallback(async () => {
    await Promise.all([loadAccounts(), loadEntries()]);
  }, [loadAccounts, loadEntries]);

  const getAccountsByType = useCallback((type: PaymentMethod) => accounts.filter(account => account.type === type), [accounts]);
  const getAccountById = useCallback((id: string) => accounts.find(account => account.id === id), [accounts]);

  const value = useMemo<AccountingContextType>(() => ({
    entries,
    balances,
    loading,
    createEntry,
    refreshEntries,
    getEntriesByReference,
    getEntriesBySource,
    getAccountBalance,
    getEntriesBySupplier,
    getEntriesByCustomer,
    getEntriesByWorker,
    getSupplierBalance,
    getCustomerBalance,
    getWorkerBalance,
    recordSale,
    recordSalePayment,
    recordRentalBooking,
    recordRentalDelivery,
    recordRentalCreditDelivery,
    recordRentalReturn,
    recordStudioSale,
    recordWorkerJobCompletion,
    recordWorkerPayment,
    recordExpense,
    recordPurchase,
    recordSupplierPayment,
    recordOnAccountCustomerPayment,
    accounts,
    getAccountsByType,
    getAccountById,
  }), [
    entries, balances, loading, accounts,
    createEntry, refreshEntries, getEntriesByReference, getEntriesBySource,
    getAccountBalance, getEntriesBySupplier, getEntriesByCustomer, getEntriesByWorker,
    getSupplierBalance, getCustomerBalance, getWorkerBalance,
    recordSale, recordSalePayment, recordRentalBooking, recordRentalDelivery,
    recordRentalCreditDelivery, recordRentalReturn, recordStudioSale,
    recordWorkerJobCompletion, recordWorkerPayment, recordExpense, recordPurchase,
    recordSupplierPayment, recordOnAccountCustomerPayment, getAccountsByType, getAccountById,
  ]);

  return (
    <AccountingContext.Provider value={value}>
      {children}
    </AccountingContext.Provider>
  );
};

// ============================================
// 🎯 HOOK
// ============================================

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within AccountingProvider');
  }
  return context;
};