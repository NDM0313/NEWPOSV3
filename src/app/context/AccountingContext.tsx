import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDateRange } from '@/app/context/DateRangeContext';
import { accountService, Account as SupabaseAccount } from '@/app/services/accountService';
import { accountingService, JournalEntryWithLines, JournalEntryLine } from '@/app/services/accountingService';
import { toast } from 'sonner';

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
  recordRentalReturn: (params: RentalReturnParams) => Promise<boolean>;
  recordStudioSale: (params: StudioSaleParams) => Promise<boolean>;
  recordWorkerJobCompletion: (params: WorkerJobParams) => Promise<boolean>;
  recordWorkerPayment: (params: WorkerPaymentParams) => Promise<boolean>;
  recordExpense: (params: ExpenseParams) => Promise<boolean>;
  recordPurchase: (params: PurchaseParams) => Promise<boolean>;
  recordSupplierPayment: (params: SupplierPaymentParams) => Promise<boolean>;
  
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
  referenceNo: string;
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
  isActive: boolean;
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
  const { companyId, branchId, user } = useSupabase();
  const { startDate, endDate } = useDateRange();

  // Current user (from auth context)
  const currentUser = user?.email || 'Admin';
  const currentUserId = user?.id;

  // Convert Supabase account format to app format
  const convertFromSupabaseAccount = useCallback((supabaseAccount: any): Account => {
    return {
      id: supabaseAccount.id,
      name: supabaseAccount.name || '',
      type: (supabaseAccount.type || 'Cash') as PaymentMethod,
      accountType: supabaseAccount.account_type || supabaseAccount.type || 'Cash',
      balance: parseFloat(supabaseAccount.balance || supabaseAccount.current_balance || 0),
      branch: supabaseAccount.branch_name || supabaseAccount.branch_id || '',
      isActive: supabaseAccount.is_active !== false,
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
      'manual': 'Manual',
    };

    const source = sourceMap[journalEntry.reference_type || 'manual'] || 'Manual';

    // Extract metadata from description or reference
    const metadata: AccountingEntry['metadata'] = {};
    if (journalEntry.reference_id) {
      if (source === 'Sale') metadata.invoiceId = journalEntry.reference_id;
      if (source === 'Purchase') metadata.purchaseId = journalEntry.reference_id;
      if (source === 'Expense') metadata.expenseId = journalEntry.reference_id;
    }

    return {
      id: journalEntry.id || '',
      date: new Date(journalEntry.entry_date),
      source,
      referenceNo: journalEntry.entry_no,
      debitAccount: (debitLine?.account_name || 'Expense') as AccountType,
      creditAccount: (creditLine?.account_name || 'Cash') as AccountType,
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
      const data = await accountService.getAllAccounts(companyId, branchId || undefined);
      const convertedAccounts = data.map(convertFromSupabaseAccount);
      setAccounts(convertedAccounts);
      console.log('✅ Accounts loaded from database:', convertedAccounts.length);
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
      const data = await accountingService.getAllEntries(
        companyId, 
        branchId || undefined,
        startDate,
        endDate
      );
      const convertedEntries = data.map(convertFromJournalEntry);
      setEntries(convertedEntries);
      console.log('✅ Journal entries loaded from database:', convertedEntries.length);
      
      // Recalculate balances from real entries
      recalculateBalances(convertedEntries);
    } catch (error) {
      console.error('[ACCOUNTING CONTEXT] Error loading journal entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, startDate, endDate, convertFromJournalEntry]);

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
  }, [companyId, branchId, startDate, endDate, loadAccounts, loadEntries]);
  
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
    if (!companyId || !branchId) {
      console.error('[ACCOUNTING] Cannot create entry: companyId or branchId missing');
      toast.error('Cannot create entry: Company or branch not set');
      return false;
    }

    if (!validateEntry(entry.debitAccount, entry.creditAccount, entry.amount)) {
      return false;
    }

    try {
      // Generate entry number
      const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const entryDate = new Date().toISOString().split('T')[0];

      // CRITICAL FIX: Case-insensitive account lookup with fallback mapping
      // Map common account name variations to actual account names
      const accountNameMap: Record<string, string> = {
        'cash': 'Cash',
        'Cash': 'Cash',
        'bank': 'Bank',
        'Bank': 'Bank',
        'accounts receivable': 'Accounts Receivable',
        'Accounts Receivable': 'Accounts Receivable',
        'sales income': 'Sales Revenue',
        'Sales Income': 'Sales Revenue',
        'Sales Revenue': 'Sales Revenue',
      };

      const normalizedDebitAccount = accountNameMap[entry.debitAccount] || entry.debitAccount;
      const normalizedCreditAccount = accountNameMap[entry.creditAccount] || entry.creditAccount;

      // Find account IDs for debit and credit (case-insensitive)
      const debitAccountObj = accounts.find(acc => 
        acc.accountType?.toLowerCase() === normalizedDebitAccount.toLowerCase() || 
        acc.name?.toLowerCase() === normalizedDebitAccount.toLowerCase()
      );
      const creditAccountObj = accounts.find(acc => 
        acc.accountType?.toLowerCase() === normalizedCreditAccount.toLowerCase() || 
        acc.name?.toLowerCase() === normalizedCreditAccount.toLowerCase()
      );

      if (!debitAccountObj || !creditAccountObj) {
        console.error('[ACCOUNTING] Account not found:', { 
          debitAccount: entry.debitAccount, 
          normalizedDebit: normalizedDebitAccount,
          creditAccount: entry.creditAccount,
          normalizedCredit: normalizedCreditAccount,
          availableAccounts: accounts.map(a => ({ name: a.name, type: a.accountType }))
        });
        toast.error(`Account not found: ${!debitAccountObj ? normalizedDebitAccount : normalizedCreditAccount}. Please create the account first.`);
        return false;
      }

      // Create journal entry (matching database schema)
      // CRITICAL FIX: Use null instead of undefined for optional UUID fields to prevent "undefinedundefined" error
      const journalEntry: JournalEntry = {
        company_id: companyId,
        branch_id: branchId || null,
        entry_no: entryNo,
        entry_date: entryDate,
        description: entry.description,
        reference_type: entry.source.toLowerCase(),
        // CRITICAL FIX: reference_id must be UUID, not invoice number
        // Use saleId/purchaseId/expenseId from metadata (UUIDs), not invoiceId (string)
        reference_id: entry.metadata?.saleId || entry.metadata?.purchaseId || entry.metadata?.expenseId || entry.metadata?.bookingId || null,
        created_by: currentUserId || null,
      };

      // Create journal entry lines (matching database schema - no account_name)
      const lines: JournalEntryLine[] = [
        {
          account_id: debitAccountObj.id,
          debit: entry.amount,
          credit: 0,
          description: entry.description,
        },
        {
          account_id: creditAccountObj.id,
          debit: 0,
          credit: entry.amount,
          description: entry.description,
        },
      ];

      // Save to database
      const savedEntry = await accountingService.createEntry(journalEntry, lines);
      
      // Convert and add to local state
      const convertedEntry = convertFromJournalEntry(savedEntry as JournalEntryWithLines);
      setEntries(prev => [convertedEntry, ...prev]);
      
      // Update balances
    updateBalances(entry.debitAccount, entry.creditAccount, entry.amount);

      console.log('✅ Accounting Entry Created and Saved:', convertedEntry);
      toast.success('Accounting entry created successfully');
    return true;
    } catch (error: any) {
      console.error('[ACCOUNTING] Error creating entry:', error);
      toast.error(error.message || 'Failed to create accounting entry');
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
    const { saleId, invoiceNo, customerName, customerId, amount, paymentMethod } = params;

    // CRITICAL FIX: Find default account based on payment method
    // Map payment method to account type
    const paymentMethodToType: Record<string, 'Cash' | 'Bank' | 'Mobile Wallet'> = {
      'cash': 'Cash',
      'Cash': 'Cash',
      'bank': 'Bank',
      'Bank': 'Bank',
      'card': 'Bank', // Card payments go to bank account
      'other': 'Bank',
      'mobile wallet': 'Mobile Wallet',
      'Mobile Wallet': 'Mobile Wallet',
    };
    
    const accountType = paymentMethodToType[paymentMethod as string] || 'Cash';
    
    // Find default account for this type
    let defaultAccount = null;
    if (accountType === 'Cash') {
      defaultAccount = accounts.find(acc => 
        (acc.type === 'Cash' || acc.accountType === 'Cash') && 
        (acc as any).is_default_cash && 
        acc.isActive
      );
    } else if (accountType === 'Bank') {
      defaultAccount = accounts.find(acc => 
        (acc.type === 'Bank' || acc.accountType === 'Bank') && 
        (acc as any).is_default_bank && 
        acc.isActive
      );
    } else {
      // For Mobile Wallet or other types, find first active account of that type
      defaultAccount = accounts.find(acc => 
        (acc.type === accountType || acc.accountType === accountType) && 
        acc.isActive
      );
    }
    
    // If no default found, try to find any active account of that type
    if (!defaultAccount) {
      defaultAccount = accounts.find(acc => 
        (acc.type === accountType || acc.accountType === accountType) && 
        acc.isActive
      );
    }
    
    if (!defaultAccount) {
      const errorMsg = `No ${accountType} account found. Please create and set a default ${accountType} account first.`;
      console.error('[ACCOUNTING]', errorMsg);
      toast.error(errorMsg);
      return false;
    }

    // Use account name for createEntry (it will find the account by name/type)
    // Fallback to accountType if name is not available
    const debitAccountName = defaultAccount.name || accountType;
    
    return await createEntry({
      source: 'Payment',
      referenceNo: invoiceNo,
      debitAccount: debitAccountName as AccountType,
      creditAccount: 'Accounts Receivable',
      amount: amount,
      description: `Payment received from ${customerName}`,
      module: 'Sales',
      metadata: { customerId, customerName, saleId, invoiceNo } // CRITICAL FIX: saleId (UUID) for reference_id, invoiceNo for display
    });
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

    return await createEntry({
      source: 'Rental',
      referenceNo: bookingId,
      debitAccount: paymentMethod as AccountType,
      creditAccount: 'Rental Income',
      amount: remainingAmount,
      description: `Rental remaining payment - ${customerName}`,
      module: 'Rental',
      metadata: { customerId, customerName, bookingId }
    });
  };

  const recordRentalReturn = async (params: RentalReturnParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, securityDepositAmount, damageCharge, paymentMethod } = params;

    if (damageCharge && damageCharge > 0) {
      // Damage charge recorded
      await createEntry({
        source: 'Rental',
        referenceNo: bookingId,
        debitAccount: (paymentMethod || 'Cash') as AccountType,
        creditAccount: 'Rental Damage Income',
        amount: damageCharge,
        description: `Damage charge - ${customerName}`,
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

  const recordWorkerPayment = async (params: WorkerPaymentParams): Promise<boolean> => {
    const { workerName, workerId, amount, paymentMethod, referenceNo } = params;

    return await createEntry({
      source: 'Payment',
      referenceNo: referenceNo,
      debitAccount: 'Worker Payable',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `Payment to worker ${workerName}`,
      module: 'Accounting',
      metadata: { workerId, workerName }
    });
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
      metadata: {}
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

    return await createEntry({
      source: 'Payment',
      referenceNo: referenceNo,
      debitAccount: 'Accounts Payable',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `Payment to supplier ${supplierName}`,
      module: 'Accounting',
      metadata: { supplierId, supplierName, purchaseId }
    });
  };

  // ============================================
  // 🎯 CONTEXT VALUE
  // ============================================

  // Refresh both accounts and entries
  const refreshEntries = useCallback(async () => {
    await Promise.all([loadAccounts(), loadEntries()]);
  }, [loadAccounts, loadEntries]);

  const value: AccountingContextType = {
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
    recordRentalReturn,
    recordStudioSale,
    recordWorkerJobCompletion,
    recordWorkerPayment,
    recordExpense,
    recordPurchase,
    recordSupplierPayment,
    
    // Account management
    accounts,
    getAccountsByType: (type: PaymentMethod) => accounts.filter(account => account.type === type),
    getAccountById: (id: string) => accounts.find(account => account.id === id)
  };

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