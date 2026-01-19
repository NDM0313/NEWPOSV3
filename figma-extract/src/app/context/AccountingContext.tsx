import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  
  // Core functions
  createEntry: (entry: Omit<AccountingEntry, 'id' | 'date' | 'createdBy'>) => boolean;
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
  recordSale: (params: SaleAccountingParams) => boolean;
  recordSalePayment: (params: SalePaymentParams) => boolean;
  recordRentalBooking: (params: RentalBookingParams) => boolean;
  recordRentalDelivery: (params: RentalDeliveryParams) => boolean;
  recordRentalReturn: (params: RentalReturnParams) => boolean;
  recordStudioSale: (params: StudioSaleParams) => boolean;
  recordWorkerJobCompletion: (params: WorkerJobParams) => boolean;
  recordWorkerPayment: (params: WorkerPaymentParams) => boolean;
  recordExpense: (params: ExpenseParams) => boolean;
  recordPurchase: (params: PurchaseParams) => boolean;
  recordSupplierPayment: (params: SupplierPaymentParams) => boolean;
  
  // Account management
  accounts: Account[];
  getAccountsByType: (type: PaymentMethod) => Account[];
  getAccountById: (id: string) => Account | undefined;
}

// ============================================
// 🎯 PARAMETER INTERFACES
// ============================================

export interface SaleAccountingParams {
  invoiceNo: string;
  customerName: string;
  customerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  module: string;
}

export interface SalePaymentParams {
  invoiceNo: string;
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

  // Current user (from auth context in real app)
  const currentUser = 'Admin';
  
  // ============================================
  // 🎯 DEMO DATA: Initialize Accounts
  // ============================================
  React.useEffect(() => {
    if (accounts.length === 0) {
      const demoAccounts: Account[] = [
        // Cash Accounts
        { id: 'cash-001', name: 'Cash - Main Counter', type: 'Cash', accountType: 'Cash', balance: 150000, branch: 'Main Branch (HQ)', isActive: true },
        { id: 'cash-002', name: 'Cash - Petty Cash', type: 'Cash', accountType: 'Cash', balance: 25000, branch: 'Main Branch (HQ)', isActive: true },
        { id: 'cash-003', name: 'Cash - Mall Outlet', type: 'Cash', accountType: 'Cash', balance: 75000, branch: 'Mall Outlet', isActive: true },
        
        // Bank Accounts
        { id: 'bank-001', name: 'HBL - Business Account', type: 'Bank', accountType: 'Bank', balance: 2500000, branch: 'Main Branch (HQ)', isActive: true },
        { id: 'bank-002', name: 'MCB - Current Account', type: 'Bank', accountType: 'Bank', balance: 1800000, branch: 'Main Branch (HQ)', isActive: true },
        { id: 'bank-003', name: 'Meezan Bank - Islamic', type: 'Bank', accountType: 'Bank', balance: 950000, branch: 'Main Branch (HQ)', isActive: true },
        { id: 'bank-004', name: 'Allied Bank - Outlet', type: 'Bank', accountType: 'Bank', balance: 450000, branch: 'Mall Outlet', isActive: true },
        
        // Mobile Wallet Accounts
        { id: 'wallet-001', name: 'JazzCash - Business', type: 'Mobile Wallet', accountType: 'Mobile Wallet', balance: 45000, branch: 'Main Branch (HQ)', isActive: true },
        { id: 'wallet-002', name: 'Easypaisa - Store', type: 'Mobile Wallet', accountType: 'Mobile Wallet', balance: 32000, branch: 'Mall Outlet', isActive: true },
        { id: 'wallet-003', name: 'SadaPay - Digital', type: 'Mobile Wallet', accountType: 'Mobile Wallet', balance: 18000, branch: 'Main Branch (HQ)', isActive: true },
      ];
      
      setAccounts(demoAccounts);
      console.log('✅ Demo accounts initialized:', demoAccounts.length);
    }
  }, []);
  
  // ============================================
  // 🎯 DEMO DATA: Initialize Transactions
  // ============================================
  React.useEffect(() => {
    if (entries.length === 0) {
      const demoEntries: AccountingEntry[] = [
        // 1. Sale Transaction - Full Payment
        {
          id: 'TXN-001',
          date: new Date('2024-01-18'),
          source: 'Sale',
          referenceNo: 'INV-001',
          debitAccount: 'Cash',
          creditAccount: 'Sales Income',
          amount: 45500,
          description: 'Sale to Ahmed Ali - Wedding Dress Collection - Full Payment',
          createdBy: 'Admin',
          module: 'Sales',
          metadata: { customerName: 'Ahmed Ali', invoiceId: 'INV-001' }
        },
        
        // 2. Sale Transaction - Credit Sale (Receivable)
        {
          id: 'TXN-002',
          date: new Date('2024-01-18'),
          source: 'Sale',
          referenceNo: 'INV-002',
          debitAccount: 'Accounts Receivable',
          creditAccount: 'Sales Income',
          amount: 78000,
          description: 'Sale to Sara Khan - Premium Bridal Dress - Credit Sale',
          createdBy: 'Admin',
          module: 'Sales',
          metadata: { customerName: 'Sara Khan', invoiceId: 'INV-002' }
        },
        
        // 3. Purchase Transaction - Credit Purchase
        {
          id: 'TXN-003',
          date: new Date('2024-01-17'),
          source: 'Purchase',
          referenceNo: 'PO-001',
          debitAccount: 'Inventory',
          creditAccount: 'Accounts Payable',
          amount: 150000,
          description: 'Purchase from Bilal Fabrics - Raw Materials - Credit',
          createdBy: 'Admin',
          module: 'Purchases',
          metadata: { supplierName: 'Bilal Fabrics', purchaseId: 'PO-001' }
        },
        
        // 4. Supplier Payment
        {
          id: 'TXN-004',
          date: new Date('2024-01-17'),
          source: 'Payment',
          referenceNo: 'PAY-001',
          debitAccount: 'Accounts Payable',
          creditAccount: 'Bank',
          amount: 50000,
          description: 'Partial payment to Bilal Fabrics via HBL Bank',
          createdBy: 'Admin',
          module: 'Purchases',
          metadata: { supplierName: 'Bilal Fabrics', purchaseId: 'PO-001' }
        },
        
        // 5. Rental Booking - Advance Payment
        {
          id: 'TXN-005',
          date: new Date('2024-01-16'),
          source: 'Rental',
          referenceNo: 'RENT-001',
          debitAccount: 'Cash',
          creditAccount: 'Rental Advance',
          amount: 15000,
          description: 'Rental booking advance - Ayesha Malik - Wedding on Feb 5',
          createdBy: 'Admin',
          module: 'Rental',
          metadata: { customerName: 'Ayesha Malik', bookingId: 'RENT-001' }
        },
        
        // 6. Rental Delivery - Security Deposit
        {
          id: 'TXN-006',
          date: new Date('2024-01-16'),
          source: 'Rental',
          referenceNo: 'RENT-001',
          debitAccount: 'Cash',
          creditAccount: 'Security Deposit',
          amount: 25000,
          description: 'Security deposit collected - Ayesha Malik rental',
          createdBy: 'Admin',
          module: 'Rental',
          metadata: { customerName: 'Ayesha Malik', bookingId: 'RENT-001' }
        },
        
        // 7. Rental Delivery - Remaining Payment
        {
          id: 'TXN-007',
          date: new Date('2024-01-16'),
          source: 'Rental',
          referenceNo: 'RENT-001',
          debitAccount: 'Bank',
          creditAccount: 'Rental Income',
          amount: 35000,
          description: 'Remaining rental payment - Ayesha Malik - Bank transfer',
          createdBy: 'Admin',
          module: 'Rental',
          metadata: { customerName: 'Ayesha Malik', bookingId: 'RENT-001' }
        },
        
        // 8. Expense - Office Supplies
        {
          id: 'TXN-008',
          date: new Date('2024-01-15'),
          source: 'Expense',
          referenceNo: 'EXP-001',
          debitAccount: 'Expense',
          creditAccount: 'Cash',
          amount: 8500,
          description: 'Office supplies - Stationery, printing materials',
          createdBy: 'Admin',
          module: 'Expenses',
          metadata: {}
        },
        
        // 9. Expense - Utilities
        {
          id: 'TXN-009',
          date: new Date('2024-01-15'),
          source: 'Expense',
          referenceNo: 'EXP-002',
          debitAccount: 'Expense',
          creditAccount: 'Bank',
          amount: 25000,
          description: 'Monthly utilities - Electricity and gas bills',
          createdBy: 'Admin',
          module: 'Expenses',
          metadata: {}
        },
        
        // 10. Studio Sale - Custom Order
        {
          id: 'TXN-010',
          date: new Date('2024-01-14'),
          source: 'Studio',
          referenceNo: 'STUDIO-001',
          debitAccount: 'Mobile Wallet',
          creditAccount: 'Studio Sales Income',
          amount: 125000,
          description: 'Custom bridal dress order - Zara Ahmed - JazzCash payment',
          createdBy: 'Admin',
          module: 'Studio',
          metadata: { customerName: 'Zara Ahmed' }
        },
        
        // 11. Studio Production Cost - Worker Job
        {
          id: 'TXN-011',
          date: new Date('2024-01-14'),
          source: 'Studio',
          referenceNo: 'JOB-001',
          debitAccount: 'Cost of Production',
          creditAccount: 'Worker Payable',
          amount: 35000,
          description: 'Embroidery work completed - Master Khalid - Job STUDIO-001',
          createdBy: 'Admin',
          module: 'Studio',
          metadata: { workerName: 'Master Khalid', stage: 'Embroidery' }
        },
        
        // 12. Worker Payment
        {
          id: 'TXN-012',
          date: new Date('2024-01-13'),
          source: 'Payment',
          referenceNo: 'WPAY-001',
          debitAccount: 'Worker Payable',
          creditAccount: 'Cash',
          amount: 35000,
          description: 'Payment to Master Khalid - Embroidery work',
          createdBy: 'Admin',
          module: 'Studio',
          metadata: { workerName: 'Master Khalid' }
        },
        
        // 13. Customer Payment (Receivable)
        {
          id: 'TXN-013',
          date: new Date('2024-01-12'),
          source: 'Payment',
          referenceNo: 'CPAY-001',
          debitAccount: 'Bank',
          creditAccount: 'Accounts Receivable',
          amount: 40000,
          description: 'Partial payment received from Sara Khan - Invoice INV-002',
          createdBy: 'Admin',
          module: 'Sales',
          metadata: { customerName: 'Sara Khan', invoiceId: 'INV-002' }
        },
        
        // 14. Purchase - Cash Purchase
        {
          id: 'TXN-014',
          date: new Date('2024-01-12'),
          source: 'Purchase',
          referenceNo: 'PO-002',
          debitAccount: 'Inventory',
          creditAccount: 'Cash',
          amount: 45000,
          description: 'Cash purchase - Accessories from Local Supplier',
          createdBy: 'Admin',
          module: 'Purchases',
          metadata: { supplierName: 'Local Supplier', purchaseId: 'PO-002' }
        },
        
        // 15. Rental Return - Damage Charge
        {
          id: 'TXN-015',
          date: new Date('2024-01-11'),
          source: 'Rental',
          referenceNo: 'RENT-RETURN-001',
          debitAccount: 'Security Deposit',
          creditAccount: 'Rental Damage Income',
          amount: 5000,
          description: 'Damage charge deducted - Minor stain on dress',
          createdBy: 'Admin',
          module: 'Rental',
          metadata: { customerName: 'Previous Customer', bookingId: 'RENT-OLD-001' }
        },
        
        // 16. Rental Return - Security Refund
        {
          id: 'TXN-016',
          date: new Date('2024-01-11'),
          source: 'Rental',
          referenceNo: 'RENT-RETURN-001',
          debitAccount: 'Security Deposit',
          creditAccount: 'Cash',
          amount: 20000,
          description: 'Security deposit refunded - After damage deduction',
          createdBy: 'Admin',
          module: 'Rental',
          metadata: { customerName: 'Previous Customer', bookingId: 'RENT-OLD-001' }
        },
        
        // 17. Sale - Mixed Payment
        {
          id: 'TXN-017',
          date: new Date('2024-01-10'),
          source: 'Sale',
          referenceNo: 'INV-003',
          debitAccount: 'Cash',
          creditAccount: 'Sales Income',
          amount: 25000,
          description: 'Sale to Fatima Ali - Cash portion',
          createdBy: 'Admin',
          module: 'Sales',
          metadata: { customerName: 'Fatima Ali', invoiceId: 'INV-003' }
        },
        
        // 18. Sale - Card Payment portion
        {
          id: 'TXN-018',
          date: new Date('2024-01-10'),
          source: 'Sale',
          referenceNo: 'INV-003',
          debitAccount: 'Bank',
          creditAccount: 'Sales Income',
          amount: 30000,
          description: 'Sale to Fatima Ali - Card payment portion',
          createdBy: 'Admin',
          module: 'Sales',
          metadata: { customerName: 'Fatima Ali', invoiceId: 'INV-003' }
        },
      ];
      
      setEntries(demoEntries);
      console.log('✅ Demo transactions initialized:', demoEntries.length);
    }
  }, []);

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
  // 🎯 CORE: Create Entry
  // ============================================
  const createEntry = (entry: Omit<AccountingEntry, 'id' | 'date' | 'createdBy'>): boolean => {
    if (!validateEntry(entry.debitAccount, entry.creditAccount, entry.amount)) {
      return false;
    }

    const newEntry: AccountingEntry = {
      ...entry,
      id: generateId(),
      date: new Date(),
      createdBy: currentUser
    };

    setEntries(prev => [newEntry, ...prev]);
    updateBalances(entry.debitAccount, entry.creditAccount, entry.amount);

    console.log('✅ Accounting Entry Created:', newEntry);
    return true;
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
  
  const recordSale = (params: SaleAccountingParams): boolean => {
    const { invoiceNo, customerName, customerId, amount, paymentMethod, paidAmount, module } = params;

    // Full payment
    if (paidAmount >= amount) {
      return createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Sales Income',
        amount: amount,
        description: `Sale to ${customerName} - Full Payment`,
        module: module,
        metadata: { customerId, customerName, invoiceId: invoiceNo }
      });
    }
    
    // Partial or credit sale
    if (paidAmount > 0) {
      // Record payment
      createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Sales Income',
        amount: paidAmount,
        description: `Sale to ${customerName} - Partial Payment`,
        module: module,
        metadata: { customerId, customerName, invoiceId: invoiceNo }
      });

      // Record receivable
      return createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: 'Accounts Receivable',
        creditAccount: 'Sales Income',
        amount: amount - paidAmount,
        description: `Sale to ${customerName} - Credit`,
        module: module,
        metadata: { customerId, customerName, invoiceId: invoiceNo }
      });
    }

    // Full credit
    return createEntry({
      source: 'Sale',
      referenceNo: invoiceNo,
      debitAccount: 'Accounts Receivable',
      creditAccount: 'Sales Income',
      amount: amount,
      description: `Sale to ${customerName} - Credit`,
      module: module,
      metadata: { customerId, customerName, invoiceId: invoiceNo }
    });
  };

  const recordSalePayment = (params: SalePaymentParams): boolean => {
    const { invoiceNo, customerName, customerId, amount, paymentMethod } = params;

    return createEntry({
      source: 'Payment',
      referenceNo: invoiceNo,
      debitAccount: paymentMethod as AccountType,
      creditAccount: 'Accounts Receivable',
      amount: amount,
      description: `Payment received from ${customerName}`,
      module: 'Sales',
      metadata: { customerId, customerName, invoiceId: invoiceNo }
    });
  };

  // ============================================
  // 🏠 RENTAL MODULE → ACCOUNTING
  // ============================================

  const recordRentalBooking = (params: RentalBookingParams): boolean => {
    const { bookingId, customerName, customerId, advanceAmount, securityDepositAmount, securityDepositType, paymentMethod } = params;

    // Record advance
    const advanceSuccess = createEntry({
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
      createEntry({
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

  const recordRentalDelivery = (params: RentalDeliveryParams): boolean => {
    const { bookingId, customerName, customerId, remainingAmount, paymentMethod } = params;

    return createEntry({
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

  const recordRentalReturn = (params: RentalReturnParams): boolean => {
    const { bookingId, customerName, customerId, securityDepositAmount, damageCharge, paymentMethod } = params;

    if (damageCharge && damageCharge > 0) {
      // Damage charge recorded
      createEntry({
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
      return createEntry({
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

  const recordStudioSale = (params: StudioSaleParams): boolean => {
    const { invoiceNo, customerName, customerId, amount, paymentMethod, paidAmount } = params;

    // Full payment
    if (paidAmount >= amount) {
      return createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Studio Sales Income',
        amount: amount,
        description: `Studio sale to ${customerName} - Full Payment`,
        module: 'Studio',
        metadata: { customerId, customerName, invoiceId: invoiceNo }
      });
    }

    // Partial or credit
    if (paidAmount > 0) {
      createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Studio Sales Income',
        amount: paidAmount,
        description: `Studio sale to ${customerName} - Partial Payment`,
        module: 'Studio',
        metadata: { customerId, customerName, invoiceId: invoiceNo }
      });

      return createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: 'Accounts Receivable',
        creditAccount: 'Studio Sales Income',
        amount: amount - paidAmount,
        description: `Studio sale to ${customerName} - Credit`,
        module: 'Studio',
        metadata: { customerId, customerName, invoiceId: invoiceNo }
      });
    }

    // Full credit
    return createEntry({
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

  const recordWorkerJobCompletion = (params: WorkerJobParams): boolean => {
    const { invoiceNo, workerName, workerId, stage, cost } = params;

    return createEntry({
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

  const recordWorkerPayment = (params: WorkerPaymentParams): boolean => {
    const { workerName, workerId, amount, paymentMethod, referenceNo } = params;

    return createEntry({
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

  const recordExpense = (params: ExpenseParams): boolean => {
    const { expenseId, category, amount, paymentMethod, description } = params;

    return createEntry({
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

  const recordPurchase = (params: PurchaseParams): boolean => {
    const { purchaseId, supplierName, supplierId, amount, purchaseType, paidAmount, paymentMethod, description } = params;

    // Full payment
    if (paidAmount && paidAmount >= amount) {
      return createEntry({
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
      createEntry({
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
      return createEntry({
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
    return createEntry({
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

  const recordSupplierPayment = (params: SupplierPaymentParams): boolean => {
    const { purchaseId, supplierName, supplierId, amount, paymentMethod, referenceNo } = params;

    return createEntry({
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

  const value: AccountingContextType = {
    entries,
    balances,
    createEntry,
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