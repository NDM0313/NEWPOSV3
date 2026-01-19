import React, { createContext, useContext, useState, ReactNode } from 'react';

// ============================================
// 🎯 TYPES & INTERFACES
// ============================================

export interface PaymentMethodConfig {
  id: string;
  method: string;
  enabled: boolean;
  defaultAccount: string;
}

export interface DefaultAccounts {
  paymentMethods: PaymentMethodConfig[];
}

export interface NumberingRules {
  salePrefix: string;
  saleNextNumber: number;
  purchasePrefix: string;
  purchaseNextNumber: number;
  rentalPrefix: string;
  rentalNextNumber: number;
  expensePrefix: string;
  expenseNextNumber: number;
  productPrefix: string;
  productNextNumber: number;
  studioPrefix: string;
  studioNextNumber: number;
  posPrefix: string;
  posNextNumber: number;
}

export interface UserPermissions {
  role: 'Admin' | 'Manager' | 'Staff';
  canCreateSale: boolean;
  canEditSale: boolean;
  canDeleteSale: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;
  canAccessAccounting: boolean;
  canMakePayments: boolean;
  canReceivePayments: boolean;
  canManageExpenses: boolean;
  canManageProducts: boolean;
  canManagePurchases: boolean;
  canManageRentals: boolean;
}

export interface CompanySettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  taxId: string;
  currency: string;
  logoUrl?: string;
}

export interface BranchSettings {
  id: string;
  branchCode: string;
  branchName: string;
  address: string;
  phone: string;
  isActive: boolean;
  isDefault: boolean;
  cashAccount: string;
  bankAccount: string;
  posCashDrawer: string;
}

export interface POSSettings {
  defaultCashAccount: string;
  creditSaleAllowed: boolean;
  autoPrintReceipt: boolean;
  defaultTaxRate: number;
  invoicePrefix: string;
  negativeStockAllowed: boolean;
  allowDiscount: boolean;
  maxDiscountPercent: number;
}

export interface SalesSettings {
  partialPaymentAllowed: boolean;
  defaultPaymentMethod: 'Cash' | 'Bank' | 'Mobile Wallet';
  autoLedgerEntry: boolean;
  invoicePrefix: string;
  autoDueDays: number;
  allowCreditSale: boolean;
  requireCustomerInfo: boolean;
}

export interface PurchaseSettings {
  defaultSupplierPayableAccount: string;
  overReceiveAllowed: boolean;
  purchaseApprovalRequired: boolean;
  grnRequired: boolean;
  autoPostToInventory: boolean;
  defaultPaymentTerms: number;
}

export interface InventorySettings {
  lowStockThreshold: number;
  reorderAlertDays: number;
  negativeStockAllowed: boolean;
  valuationMethod: 'FIFO' | 'LIFO' | 'Weighted Average';
  autoReorderEnabled: boolean;
  barcodeRequired: boolean;
}

export interface RentalSettings {
  defaultLateFeePerDay: number;
  gracePeriodDays: number;
  advanceRequired: boolean;
  advancePercentage: number;
  securityDepositRequired: boolean;
  securityDepositAmount: number;
  damageChargeEnabled: boolean;
  autoExtendAllowed: boolean;
}

export interface AccountingSettings {
  fiscalYearStart: string; // YYYY-MM-DD
  fiscalYearEnd: string;
  lockAccountingDate?: string;
  manualJournalEnabled: boolean;
  defaultCurrency: string;
  multiCurrencyEnabled: boolean;
  taxCalculationMethod: 'Inclusive' | 'Exclusive';
  defaultTaxRate: number;
}

export interface ModuleToggles {
  rentalModuleEnabled: boolean;
  studioModuleEnabled: boolean;
  accountingModuleEnabled: boolean;
  productionModuleEnabled: boolean;
  posModuleEnabled: boolean;
}

interface SettingsContextType {
  // Company Info
  company: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  
  // Branch Management
  branches: BranchSettings[];
  updateBranches: (branches: BranchSettings[]) => void;
  addBranch: (branch: BranchSettings) => void;
  
  // POS Settings
  posSettings: POSSettings;
  updatePOSSettings: (settings: Partial<POSSettings>) => void;
  
  // Sales Settings
  salesSettings: SalesSettings;
  updateSalesSettings: (settings: Partial<SalesSettings>) => void;
  
  // Purchase Settings
  purchaseSettings: PurchaseSettings;
  updatePurchaseSettings: (settings: Partial<PurchaseSettings>) => void;
  
  // Inventory Settings
  inventorySettings: InventorySettings;
  updateInventorySettings: (settings: Partial<InventorySettings>) => void;
  
  // Rental Settings
  rentalSettings: RentalSettings;
  updateRentalSettings: (settings: Partial<RentalSettings>) => void;
  
  // Accounting Settings
  accountingSettings: AccountingSettings;
  updateAccountingSettings: (settings: Partial<AccountingSettings>) => void;
  
  // Default Accounts
  defaultAccounts: DefaultAccounts;
  updateDefaultAccounts: (accounts: Partial<DefaultAccounts>) => void;
  
  // Numbering
  numberingRules: NumberingRules;
  updateNumberingRules: (rules: Partial<NumberingRules>) => void;
  getNextNumber: (module: keyof NumberingRules) => string;
  
  // Permissions
  currentUser: UserPermissions;
  updatePermissions: (permissions: Partial<UserPermissions>) => void;
  
  // Module Toggles
  modules: ModuleToggles;
  updateModules: (modules: Partial<ModuleToggles>) => void;
}

// ============================================
// 🎯 CONTEXT & PROVIDER
// ============================================

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  // Company Settings
  const [company, setCompany] = useState<CompanySettings>({
    businessName: 'Din Collection',
    businessAddress: 'Main Branch, Lahore, Pakistan',
    businessPhone: '+92 300 1234567',
    businessEmail: 'contact@dincollection.com',
    taxId: 'TAX-123456',
    currency: 'PKR',
    logoUrl: undefined,
  });

  // Branch Management
  const [branches, setBranches] = useState<BranchSettings[]>([
    {
      id: '1',
      branchCode: 'MB',
      branchName: 'Main Branch',
      address: 'Main Branch, Lahore, Pakistan',
      phone: '+92 300 1234567',
      isActive: true,
      isDefault: true,
      cashAccount: 'Cash Drawer',
      bankAccount: 'Meezan Bank - Business Account',
      posCashDrawer: 'POS Cash Drawer',
    },
  ]);

  // POS Settings
  const [posSettings, setPOSSettings] = useState<POSSettings>({
    defaultCashAccount: 'Cash Drawer',
    creditSaleAllowed: true,
    autoPrintReceipt: true,
    defaultTaxRate: 15,
    invoicePrefix: 'INV-',
    negativeStockAllowed: false,
    allowDiscount: true,
    maxDiscountPercent: 10,
  });

  // Sales Settings
  const [salesSettings, setSalesSettings] = useState<SalesSettings>({
    partialPaymentAllowed: true,
    defaultPaymentMethod: 'Cash',
    autoLedgerEntry: true,
    invoicePrefix: 'INV-',
    autoDueDays: 30,
    allowCreditSale: true,
    requireCustomerInfo: true,
  });

  // Purchase Settings
  const [purchaseSettings, setPurchaseSettings] = useState<PurchaseSettings>({
    defaultSupplierPayableAccount: 'Supplier Payable',
    overReceiveAllowed: true,
    purchaseApprovalRequired: true,
    grnRequired: true,
    autoPostToInventory: true,
    defaultPaymentTerms: 30,
  });

  // Inventory Settings
  const [inventorySettings, setInventorySettings] = useState<InventorySettings>({
    lowStockThreshold: 10,
    reorderAlertDays: 5,
    negativeStockAllowed: false,
    valuationMethod: 'FIFO',
    autoReorderEnabled: true,
    barcodeRequired: true,
  });

  // Rental Settings
  const [rentalSettings, setRentalSettings] = useState<RentalSettings>({
    defaultLateFeePerDay: 100,
    gracePeriodDays: 3,
    advanceRequired: true,
    advancePercentage: 20,
    securityDepositRequired: true,
    securityDepositAmount: 500,
    damageChargeEnabled: true,
    autoExtendAllowed: true,
  });

  // Accounting Settings
  const [accountingSettings, setAccountingSettings] = useState<AccountingSettings>({
    fiscalYearStart: '2023-01-01',
    fiscalYearEnd: '2023-12-31',
    lockAccountingDate: undefined,
    manualJournalEnabled: true,
    defaultCurrency: 'PKR',
    multiCurrencyEnabled: false,
    taxCalculationMethod: 'Inclusive',
    defaultTaxRate: 15,
  });

  // Default Accounts
  const [defaultAccounts, setDefaultAccounts] = useState<DefaultAccounts>({
    paymentMethods: [
      { id: '1', method: 'Cash', enabled: true, defaultAccount: 'Cash Drawer' },
      { id: '2', method: 'Bank', enabled: true, defaultAccount: 'Meezan Bank - Business Account' },
      { id: '3', method: 'Mobile Wallet', enabled: true, defaultAccount: 'JazzCash - Business' },
    ],
  });

  // Numbering Rules
  const [numberingRules, setNumberingRules] = useState<NumberingRules>({
    salePrefix: 'INV-',
    saleNextNumber: 1001,
    purchasePrefix: 'PO-',
    purchaseNextNumber: 5001,
    rentalPrefix: 'RNT-',
    rentalNextNumber: 3001,
    expensePrefix: 'EXP-',
    expenseNextNumber: 2001,
    productPrefix: 'PRD-',
    productNextNumber: 1001,
    studioPrefix: 'STD-',
    studioNextNumber: 4001,
    posPrefix: 'POS-',
    posNextNumber: 6001,
  });

  // User Permissions
  const [currentUser, setCurrentUser] = useState<UserPermissions>({
    role: 'Admin',
    canCreateSale: true,
    canEditSale: true,
    canDeleteSale: true,
    canViewReports: true,
    canManageSettings: true,
    canManageUsers: true,
    canAccessAccounting: true,
    canMakePayments: true,
    canReceivePayments: true,
    canManageExpenses: true,
    canManageProducts: true,
    canManagePurchases: true,
    canManageRentals: true,
  });

  // Module Toggles
  const [modules, setModules] = useState<ModuleToggles>({
    rentalModuleEnabled: true,
    studioModuleEnabled: true,
    accountingModuleEnabled: true,
    productionModuleEnabled: false,
    posModuleEnabled: true,
  });

  // Update Functions
  const updateCompanySettings = (settings: Partial<CompanySettings>) => {
    setCompany(prev => ({ ...prev, ...settings }));
  };

  const updateBranches = (branches: BranchSettings[]) => {
    setBranches(branches);
  };

  const addBranch = (branch: BranchSettings) => {
    setBranches(prev => [...prev, branch]);
  };

  const updatePOSSettings = (settings: Partial<POSSettings>) => {
    setPOSSettings(prev => ({ ...prev, ...settings }));
  };

  const updateSalesSettings = (settings: Partial<SalesSettings>) => {
    setSalesSettings(prev => ({ ...prev, ...settings }));
  };

  const updatePurchaseSettings = (settings: Partial<PurchaseSettings>) => {
    setPurchaseSettings(prev => ({ ...prev, ...settings }));
  };

  const updateInventorySettings = (settings: Partial<InventorySettings>) => {
    setInventorySettings(prev => ({ ...prev, ...settings }));
  };

  const updateRentalSettings = (settings: Partial<RentalSettings>) => {
    setRentalSettings(prev => ({ ...prev, ...settings }));
  };

  const updateAccountingSettings = (settings: Partial<AccountingSettings>) => {
    setAccountingSettings(prev => ({ ...prev, ...settings }));
  };

  const updateDefaultAccounts = (accounts: Partial<DefaultAccounts>) => {
    setDefaultAccounts(prev => ({ ...prev, ...accounts }));
  };

  const updateNumberingRules = (rules: Partial<NumberingRules>) => {
    setNumberingRules(prev => ({ ...prev, ...rules }));
  };

  const getNextNumber = (module: keyof NumberingRules): string => {
    const prefixKey = module.replace('NextNumber', 'Prefix') as keyof NumberingRules;
    const prefix = numberingRules[prefixKey] as string;
    const nextNum = numberingRules[module] as number;
    
    // Auto-increment
    setNumberingRules(prev => ({
      ...prev,
      [module]: nextNum + 1,
    }));
    
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  };

  const updatePermissions = (permissions: Partial<UserPermissions>) => {
    setCurrentUser(prev => ({ ...prev, ...permissions }));
  };

  const updateModules = (newModules: Partial<ModuleToggles>) => {
    setModules(prev => ({ ...prev, ...newModules }));
  };

  const value: SettingsContextType = {
    company,
    updateCompanySettings,
    branches,
    updateBranches,
    addBranch,
    posSettings,
    updatePOSSettings,
    salesSettings,
    updateSalesSettings,
    purchaseSettings,
    updatePurchaseSettings,
    inventorySettings,
    updateInventorySettings,
    rentalSettings,
    updateRentalSettings,
    accountingSettings,
    updateAccountingSettings,
    defaultAccounts,
    updateDefaultAccounts,
    numberingRules,
    updateNumberingRules,
    getNextNumber,
    currentUser,
    updatePermissions,
    modules,
    updateModules,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};