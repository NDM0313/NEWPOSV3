import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSupabase } from './SupabaseContext';
import { settingsService } from '@/app/services/settingsService';
import { branchService } from '@/app/services/branchService';
import { accountService } from '@/app/services/accountService';
import { saleService } from '@/app/services/saleService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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

/** LOCKED: Each module has its own prefix and counter. Do not share counters. */
export interface NumberingRules {
  salePrefix: string;           // SL – Regular Sale
  saleNextNumber: number;
  quotationPrefix?: string;
  quotationNextNumber?: number;
  draftPrefix?: string;
  draftNextNumber?: number;
  orderPrefix?: string;
  orderNextNumber?: number;
  purchasePrefix: string;       // PUR – Purchase
  purchaseNextNumber: number;
  rentalPrefix: string;
  rentalNextNumber: number;
  expensePrefix: string;        // EXP – Expense
  expenseNextNumber: number;
  productPrefix: string;
  productNextNumber: number;
  studioPrefix: string;         // STD – Studio Sale
  studioNextNumber: number;
  posPrefix: string;
  posNextNumber: number;
  productionPrefix?: string;
  productionNextNumber?: number;
  /** PAY – Payment (customer/supplier/worker) */
  paymentPrefix?: string;
  paymentNextNumber?: number;
  /** JOB – Worker job (studio stage payable) */
  jobPrefix?: string;
  jobNextNumber?: number;
  /** JV – Journal voucher */
  journalPrefix?: string;
  journalNextNumber?: number;
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
  /** Purchase delete restricted - default false for non-Admin */
  canEditPurchase?: boolean;
  canDeletePurchase?: boolean;
}

export interface CompanySettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  taxId: string;
  currency: string;
  decimalPrecision?: number;
  logoUrl?: string;
  /** Date display format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD */
  dateFormat?: string;
  /** Time format: 12h or 24h */
  timeFormat?: '12h' | '24h';
  /** IANA timezone e.g. Asia/Karachi */
  timezone?: string;
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
  cashAccountId?: string;
  bankAccountId?: string;
  posCashDrawerId?: string;
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
  enablePacking: boolean; // Global toggle: ON = boxes/pieces enabled everywhere, OFF = completely hidden
  defaultUnitId: string | null; // Default unit for new products / dropdowns when none selected
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
  combosEnabled: boolean;
}

interface SettingsContextType {
  // Loading state
  loading: boolean;
  
  // Company Info
  company: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
  
  // Branch Management
  branches: BranchSettings[];
  updateBranches: (branches: BranchSettings[]) => void;
  addBranch: (branch: BranchSettings) => void;
  
  // POS Settings
  posSettings: POSSettings;
  updatePOSSettings: (settings: Partial<POSSettings>) => Promise<void>;
  
  // Sales Settings
  salesSettings: SalesSettings;
  updateSalesSettings: (settings: Partial<SalesSettings>) => Promise<void>;
  
  // Purchase Settings
  purchaseSettings: PurchaseSettings;
  updatePurchaseSettings: (settings: Partial<PurchaseSettings>) => Promise<void>;
  
  // Inventory Settings
  inventorySettings: InventorySettings;
  updateInventorySettings: (settings: Partial<InventorySettings>, options?: { silent?: boolean }) => Promise<void>;
  
  // Rental Settings
  rentalSettings: RentalSettings;
  updateRentalSettings: (settings: Partial<RentalSettings>) => Promise<void>;
  
  // Accounting Settings
  accountingSettings: AccountingSettings;
  updateAccountingSettings: (settings: Partial<AccountingSettings>) => Promise<void>;
  
  // Default Accounts
  defaultAccounts: DefaultAccounts;
  updateDefaultAccounts: (accounts: Partial<DefaultAccounts>) => Promise<void>;
  
  // Numbering
  numberingRules: NumberingRules;
  updateNumberingRules: (rules: Partial<NumberingRules>) => Promise<void>;
  getNextNumber: (module: keyof NumberingRules) => Promise<string>;
  
  // Permissions
  currentUser: UserPermissions;
  updatePermissions: (permissions: Partial<UserPermissions>) => Promise<void>;
  
  // Module Toggles
  modules: ModuleToggles;
  updateModules: (modules: Partial<ModuleToggles>) => Promise<void>;
  
  // Refresh
  refreshSettings: () => Promise<void>;
}

// ============================================
// 🎯 CONTEXT & PROVIDER
// ============================================

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Safe fallback when context is undefined (e.g. during HMR or error recovery)
const noop = () => Promise.resolve();
const noopSync = () => {};
function getDefaultSettingsStub(): SettingsContextType {
  return {
    loading: false,
    company: { businessName: '', businessAddress: '', businessPhone: '', businessEmail: '', taxId: '', currency: 'PKR', decimalPrecision: 2, logoUrl: undefined, dateFormat: 'DD/MM/YYYY', timeFormat: '12h', timezone: 'Asia/Karachi' },
    updateCompanySettings: noop,
    branches: [],
    updateBranches: noopSync,
    addBranch: noopSync,
    posSettings: { defaultCashAccount: '', creditSaleAllowed: true, autoPrintReceipt: false, defaultTaxRate: 0, invoicePrefix: 'POS-', negativeStockAllowed: false, allowDiscount: true, maxDiscountPercent: 100 },
    updatePOSSettings: noop,
    salesSettings: { partialPaymentAllowed: true, defaultPaymentMethod: 'Cash', autoLedgerEntry: true, invoicePrefix: 'SL-', autoDueDays: 0, allowCreditSale: true, requireCustomerInfo: false },
    updateSalesSettings: noop,
    purchaseSettings: { defaultSupplierPayableAccount: '', overReceiveAllowed: false, purchaseApprovalRequired: false, grnRequired: false, autoPostToInventory: true, defaultPaymentTerms: 0 },
    updatePurchaseSettings: noop,
    inventorySettings: { lowStockThreshold: 0, reorderAlertDays: 0, negativeStockAllowed: false, valuationMethod: 'FIFO', autoReorderEnabled: false, barcodeRequired: false, enablePacking: false, defaultUnitId: null },
    updateInventorySettings: noop,
    rentalSettings: { defaultLateFeePerDay: 0, gracePeriodDays: 0, advanceRequired: false, advancePercentage: 0, securityDepositRequired: false, securityDepositAmount: 0, damageChargeEnabled: false, autoExtendAllowed: false },
    updateRentalSettings: noop,
    accountingSettings: { fiscalYearStart: '', fiscalYearEnd: '', manualJournalEnabled: true, defaultCurrency: 'PKR', multiCurrencyEnabled: false, taxCalculationMethod: 'Inclusive', defaultTaxRate: 0 },
    updateAccountingSettings: noop,
    defaultAccounts: { paymentMethods: [] },
    updateDefaultAccounts: noop,
    numberingRules: { salePrefix: 'SL-', saleNextNumber: 1, purchasePrefix: 'PUR-', purchaseNextNumber: 1, rentalPrefix: 'RNT-', rentalNextNumber: 1, expensePrefix: 'EXP-', expenseNextNumber: 1, productPrefix: 'PRD-', productNextNumber: 1, studioPrefix: 'STD-', studioNextNumber: 1, posPrefix: 'POS-', posNextNumber: 1, paymentPrefix: 'PAY-', paymentNextNumber: 1, jobPrefix: 'JOB-', jobNextNumber: 1, journalPrefix: 'JV-', journalNextNumber: 1 },
    updateNumberingRules: noopSync,
    getNextNumber: async () => '',
    currentUser: { role: 'Admin', canCreateSale: true, canEditSale: true, canDeleteSale: true, canViewReports: true, canManageSettings: true, canManageUsers: true, canAccessAccounting: true, canMakePayments: true, canReceivePayments: true, canManageExpenses: true, canManageProducts: true, canManagePurchases: true, canManageRentals: true },
    updatePermissions: noop,
    modules: { rentalModuleEnabled: true, studioModuleEnabled: true, accountingModuleEnabled: true, productionModuleEnabled: true, posModuleEnabled: true, combosEnabled: false },
    updateModules: noop,
    refreshSettings: noop,
  };
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  return context ?? getDefaultSettingsStub();
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const { companyId, branchId, user } = useSupabase();
  const [loading, setLoading] = useState<boolean>(true);

  // Company Settings
  const [company, setCompany] = useState<CompanySettings>({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
    taxId: '',
    currency: 'PKR',
    decimalPrecision: 2,
    logoUrl: undefined,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    timezone: 'Asia/Karachi',
  });

  // Branch Management
  const [branches, setBranches] = useState<BranchSettings[]>([]);

  // POS Settings
  const [posSettings, setPOSSettings] = useState<POSSettings>({
    defaultCashAccount: '',
    creditSaleAllowed: false,
    autoPrintReceipt: false,
    defaultTaxRate: 0,
    invoicePrefix: 'POS-',
    negativeStockAllowed: false,
    allowDiscount: false,
    maxDiscountPercent: 0,
  });

  // Sales Settings
  const [salesSettings, setSalesSettings] = useState<SalesSettings>({
    partialPaymentAllowed: false,
    defaultPaymentMethod: 'Cash',
    autoLedgerEntry: false,
    invoicePrefix: 'SL-',
    autoDueDays: 0,
    allowCreditSale: false,
    requireCustomerInfo: false,
  });

  // Purchase Settings
  const [purchaseSettings, setPurchaseSettings] = useState<PurchaseSettings>({
    defaultSupplierPayableAccount: '',
    overReceiveAllowed: false,
    purchaseApprovalRequired: false,
    grnRequired: false,
    autoPostToInventory: false,
    defaultPaymentTerms: 0,
  });

  // Inventory Settings
  const [inventorySettings, setInventorySettings] = useState<InventorySettings>({
    lowStockThreshold: 0,
    reorderAlertDays: 0,
    negativeStockAllowed: false,
    valuationMethod: 'FIFO',
    autoReorderEnabled: false,
    barcodeRequired: false,
    enablePacking: false, // Default: Packing disabled
    defaultUnitId: null,
  });

  // Rental Settings
  const [rentalSettings, setRentalSettings] = useState<RentalSettings>({
    defaultLateFeePerDay: 0,
    gracePeriodDays: 0,
    advanceRequired: false,
    advancePercentage: 0,
    securityDepositRequired: false,
    securityDepositAmount: 0,
    damageChargeEnabled: false,
    autoExtendAllowed: false,
  });

  // Accounting Settings
  const [accountingSettings, setAccountingSettings] = useState<AccountingSettings>({
    fiscalYearStart: new Date().toISOString().split('T')[0],
    fiscalYearEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    lockAccountingDate: undefined,
    manualJournalEnabled: false,
    defaultCurrency: 'PKR',
    multiCurrencyEnabled: false,
    taxCalculationMethod: 'Inclusive',
    defaultTaxRate: 0,
  });

  // Default Accounts
  const [defaultAccounts, setDefaultAccounts] = useState<DefaultAccounts>({
    paymentMethods: [
      { id: '1', method: 'Cash', enabled: true, defaultAccount: '' },
      { id: '2', method: 'Bank', enabled: true, defaultAccount: '' },
      { id: '3', method: 'Mobile Wallet', enabled: true, defaultAccount: '' },
    ],
  });

  // Numbering Rules (LOCKED: SL, STD, PUR, EXP, PAY, JOB, JV – separate counters)
  const [numberingRules, setNumberingRules] = useState<NumberingRules>({
    salePrefix: 'SL-',
    saleNextNumber: 1,
    quotationPrefix: 'QT-',
    quotationNextNumber: 1,
    draftNextNumber: 1,
    orderNextNumber: 1,
    purchasePrefix: 'PUR-',
    purchaseNextNumber: 1,
    rentalPrefix: 'RNT-',
    rentalNextNumber: 1,
    expensePrefix: 'EXP-',
    expenseNextNumber: 1,
    productPrefix: 'PRD-',
    productNextNumber: 1,
    studioPrefix: 'STD-',
    studioNextNumber: 1,
    posPrefix: 'POS-',
    posNextNumber: 1,
    productionPrefix: 'PRD-',
    productionNextNumber: 1,
    paymentPrefix: 'PAY-',
    paymentNextNumber: 1,
    jobPrefix: 'JOB-',
    jobNextNumber: 1,
    journalPrefix: 'JV-',
    journalNextNumber: 1,
  });

  // User Permissions
  const [currentUser, setCurrentUser] = useState<UserPermissions>({
    role: 'Staff',
    canCreateSale: false,
    canEditSale: false,
    canDeleteSale: false,
    canViewReports: false,
    canManageSettings: false,
    canManageUsers: false,
    canAccessAccounting: false,
    canMakePayments: false,
    canReceivePayments: false,
    canManageExpenses: false,
    canManageProducts: false,
    canManagePurchases: false,
    canManageRentals: false,
  });

  // Module Toggles
  const [modules, setModules] = useState<ModuleToggles>({
    rentalModuleEnabled: false,
    studioModuleEnabled: false,
    accountingModuleEnabled: false,
    productionModuleEnabled: false,
    posModuleEnabled: false,
    combosEnabled: false,
  });

  // ============================================
  // 🎯 LOAD SETTINGS FROM DATABASE
  // ============================================

  const loadAllSettings = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load company info from companies table
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyData) {
        const c = companyData as any;
        setCompany({
          businessName: companyData.name || '',
          businessAddress: companyData.address || '',
          businessPhone: companyData.phone || '',
          businessEmail: companyData.email || '',
          taxId: companyData.tax_number || '',
          currency: companyData.currency || 'PKR',
          decimalPrecision: c.decimal_precision ?? 2,
          logoUrl: companyData.logo_url || undefined,
          dateFormat: c.date_format || 'DD/MM/YYYY',
          timeFormat: (c.time_format === '24h' ? '24h' : '12h') as '12h' | '24h',
          timezone: c.timezone || 'Asia/Karachi',
        });
      }

      // Load branches and resolve default account names
      const [branchesData, accountsList] = await Promise.all([
        branchService.getAllBranches(companyId),
        accountService.getAllAccounts(companyId),
      ]);
      const accountNameById = new Map<string, string>();
      (accountsList || []).forEach((a: any) => { if (a.id && a.name) accountNameById.set(a.id, a.name); });
      const convertedBranches: BranchSettings[] = (branchesData || []).map((b: any) => ({
        id: b.id,
        branchCode: b.code || '',
        branchName: b.name || '',
        address: b.address || '',
        phone: b.phone || '',
        isActive: b.is_active !== false,
        isDefault: !!b.is_default,
        cashAccount: (b.default_cash_account_id && accountNameById.get(b.default_cash_account_id)) || '',
        bankAccount: (b.default_bank_account_id && accountNameById.get(b.default_bank_account_id)) || '',
        posCashDrawer: (b.default_pos_drawer_account_id && accountNameById.get(b.default_pos_drawer_account_id)) || '',
        cashAccountId: b.default_cash_account_id || undefined,
        bankAccountId: b.default_bank_account_id || undefined,
        posCashDrawerId: b.default_pos_drawer_account_id || undefined,
      }));
      setBranches(convertedBranches);

      // Load all settings
      const allSettings = await settingsService.getAllSettings(companyId);
      const settingsMap = new Map(allSettings.map(s => [s.key, s.value]));

      // Load POS Settings
      const posData = (settingsMap.get('pos_settings') as any) || {};
      setPOSSettings({
        defaultCashAccount: posData.defaultCashAccount || '',
        creditSaleAllowed: posData.creditSaleAllowed || false,
        autoPrintReceipt: posData.autoPrintReceipt || false,
        defaultTaxRate: posData.defaultTaxRate || 0,
        invoicePrefix: posData.invoicePrefix || 'POS-',
        negativeStockAllowed: posData.negativeStockAllowed || false,
        allowDiscount: posData.allowDiscount || false,
        maxDiscountPercent: posData.maxDiscountPercent || 0,
      });

      // Load Sales Settings
      const salesData = (settingsMap.get('sales_settings') as any) || {};
      setSalesSettings({
        partialPaymentAllowed: salesData.partialPaymentAllowed || false,
        defaultPaymentMethod: salesData.defaultPaymentMethod || 'Cash',
        autoLedgerEntry: salesData.autoLedgerEntry || false,
        invoicePrefix: salesData.invoicePrefix || 'SL-',
        autoDueDays: salesData.autoDueDays || 0,
        allowCreditSale: salesData.allowCreditSale || false,
        requireCustomerInfo: salesData.requireCustomerInfo || false,
      });

      // Load Purchase Settings
      const purchaseData = (settingsMap.get('purchase_settings') as any) || {};
      setPurchaseSettings({
        defaultSupplierPayableAccount: purchaseData.defaultSupplierPayableAccount || '',
        overReceiveAllowed: purchaseData.overReceiveAllowed || false,
        purchaseApprovalRequired: purchaseData.purchaseApprovalRequired || false,
        grnRequired: purchaseData.grnRequired || false,
        autoPostToInventory: purchaseData.autoPostToInventory || false,
        defaultPaymentTerms: purchaseData.defaultPaymentTerms || 0,
      });

      // Load Inventory Settings
      const inventoryData = (settingsMap.get('inventory_settings') as any) || {};
      
      // Load Enable Packing setting (separate key for global control)
      const enablePacking = await settingsService.getEnablePacking(companyId);
      
      setInventorySettings({
        lowStockThreshold: inventoryData.lowStockThreshold || 0,
        reorderAlertDays: inventoryData.reorderAlertDays || 0,
        negativeStockAllowed: inventoryData.negativeStockAllowed || false,
        valuationMethod: inventoryData.valuationMethod || 'FIFO',
        autoReorderEnabled: inventoryData.autoReorderEnabled || false,
        barcodeRequired: inventoryData.barcodeRequired || false,
        enablePacking: enablePacking || false,
        defaultUnitId: inventoryData.defaultUnitId ?? null,
      });

      // Load Rental Settings
      const rentalData = (settingsMap.get('rental_settings') as any) || {};
      setRentalSettings({
        defaultLateFeePerDay: rentalData.defaultLateFeePerDay || 0,
        gracePeriodDays: rentalData.gracePeriodDays || 0,
        advanceRequired: rentalData.advanceRequired || false,
        advancePercentage: rentalData.advancePercentage || 0,
        securityDepositRequired: rentalData.securityDepositRequired || false,
        securityDepositAmount: rentalData.securityDepositAmount || 0,
        damageChargeEnabled: rentalData.damageChargeEnabled || false,
        autoExtendAllowed: rentalData.autoExtendAllowed || false,
      });

      // Load Accounting Settings
      const accountingData = (settingsMap.get('accounting_settings') as any) || {};
      setAccountingSettings({
        fiscalYearStart: accountingData.fiscalYearStart || new Date().toISOString().split('T')[0],
        fiscalYearEnd: accountingData.fiscalYearEnd || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        lockAccountingDate: accountingData.lockAccountingDate || undefined,
        manualJournalEnabled: accountingData.manualJournalEnabled || false,
        defaultCurrency: accountingData.defaultCurrency || 'PKR',
        multiCurrencyEnabled: accountingData.multiCurrencyEnabled || false,
        taxCalculationMethod: accountingData.taxCalculationMethod || 'Inclusive',
        defaultTaxRate: accountingData.defaultTaxRate || 0,
      });

      // Load Default Accounts
      const accountsData = (settingsMap.get('default_accounts') as any) || {};
      setDefaultAccounts({
        paymentMethods: accountsData.paymentMethods || [
          { id: '1', method: 'Cash', enabled: true, defaultAccount: '' },
          { id: '2', method: 'Bank', enabled: true, defaultAccount: '' },
          { id: '3', method: 'Mobile Wallet', enabled: true, defaultAccount: '' },
        ],
      });

      // Load Numbering Rules from document_sequences
      const sequences = await settingsService.getAllDocumentSequences(companyId, branchId === 'all' ? undefined : branchId || undefined);
      const sequencesMap = new Map(sequences.map(s => [s.document_type, s]));
      
      const getSequence = (type: string) => sequencesMap.get(type);
      // When document_sequences has no 'studio' row, derive next number from sales (STD-*) so header shows latest
      let studioNext = getSequence('studio')?.current_number ?? null;
      if (studioNext == null) {
        try {
          studioNext = await saleService.getNextStudioInvoiceNumber(companyId);
        } catch {
          studioNext = 1;
        }
      }
      
      setNumberingRules({
        salePrefix: getSequence('sale')?.prefix || 'SL-',
        saleNextNumber: getSequence('sale')?.current_number || 1,
        purchasePrefix: getSequence('purchase')?.prefix || 'PUR-',
        purchaseNextNumber: getSequence('purchase')?.current_number || 1,
        rentalPrefix: getSequence('rental')?.prefix || 'RNT-',
        rentalNextNumber: getSequence('rental')?.current_number || 1,
        expensePrefix: getSequence('expense')?.prefix || 'EXP-',
        expenseNextNumber: getSequence('expense')?.current_number || 1,
        productPrefix: getSequence('product')?.prefix || 'PRD-',
        productNextNumber: getSequence('product')?.current_number || 1,
        studioPrefix: getSequence('studio')?.prefix || 'STD-',
        studioNextNumber: studioNext,
        posPrefix: getSequence('pos')?.prefix || 'POS-',
        posNextNumber: getSequence('pos')?.current_number || 1,
        paymentPrefix: getSequence('payment')?.prefix || 'PAY-',
        paymentNextNumber: getSequence('payment')?.current_number ?? 1,
        jobPrefix: getSequence('job')?.prefix || 'JOB-',
        jobNextNumber: getSequence('job')?.current_number ?? 1,
        journalPrefix: getSequence('journal')?.prefix || 'JV-',
        journalNextNumber: getSequence('journal')?.current_number ?? 1,
      });

      // Load Module Toggles
      const moduleConfigs = await settingsService.getAllModuleConfigs(companyId);
      const modulesMap = new Map(moduleConfigs.map(m => [m.module_name, m.is_enabled]));
      
      const getModuleEnabled = (name: string): boolean => {
        const enabled = modulesMap.get(name);
        return enabled === true;
      };
      
      setModules({
        rentalModuleEnabled: getModuleEnabled('rentals'),
        studioModuleEnabled: getModuleEnabled('studio'),
        accountingModuleEnabled: getModuleEnabled('accounting'),
        productionModuleEnabled: getModuleEnabled('production'),
        posModuleEnabled: getModuleEnabled('pos'),
        combosEnabled: getModuleEnabled('combos'),
      });

      // Load current user permissions from users table (role-based + granular)
      if (user?.id && companyId) {
        const { data: userData } = await supabase
          .from('users')
          .select('role, permissions')
          .eq('id', user.id)
          .eq('company_id', companyId)
          .maybeSingle();

        if (userData) {
          const r = (userData.role || 'staff').toLowerCase();
          const role: 'Admin' | 'Manager' | 'Staff' =
            r === 'admin' ? 'Admin' : r === 'manager' ? 'Manager' : 'Staff';
          const p = (userData.permissions as Record<string, boolean | undefined>) || {};
          setCurrentUser({
            role,
            canCreateSale: p.canCreateSale ?? (role === 'Admin' || role === 'Manager'),
            canEditSale: p.canEditSale ?? (role === 'Admin' || role === 'Manager'),
            canDeleteSale: p.canDeleteSale ?? (role === 'Admin'),
            canViewReports: p.canViewReports ?? (role === 'Admin' || role === 'Manager'),
            canManageSettings: p.canManageSettings ?? (role === 'Admin'),
            canManageUsers: p.canManageUsers ?? (role === 'Admin'),
            canAccessAccounting: p.canAccessAccounting ?? (role === 'Admin' || role === 'Manager'),
            canMakePayments: p.canMakePayments ?? (role === 'Admin' || role === 'Manager'),
            canReceivePayments: p.canReceivePayments ?? (role === 'Admin' || role === 'Manager'),
            canManageExpenses: p.canManageExpenses ?? (role === 'Admin' || role === 'Manager'),
            canManageProducts: p.canManageProducts ?? (role === 'Admin' || role === 'Manager'),
            canManagePurchases: p.canManagePurchases ?? (role === 'Admin' || role === 'Manager'),
            canManageRentals: p.canManageRentals ?? (role === 'Admin' || role === 'Manager'),
            canEditPurchase: p.canEditPurchase ?? (role === 'Admin' || role === 'Manager'),
            canDeletePurchase: p.canDeletePurchase ?? (role === 'Admin'),
          });
        }
      }

      if (import.meta.env?.DEV) console.log('✅ Settings loaded');
    } catch (error) {
      console.error('[SETTINGS CONTEXT] Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, user?.id]);

  // Load settings on mount
  useEffect(() => {
    loadAllSettings();
  }, [loadAllSettings]);

  // ============================================
  // 🎯 UPDATE FUNCTIONS (SAVE TO DATABASE)
  // ============================================

  const updateCompanySettings = async (settings: Partial<CompanySettings>) => {
    if (!companyId) return;
    
    setCompany(prev => ({ ...prev, ...settings }));
    
    try {
      // Update companies table
      await supabase
        .from('companies')
        .update({
          name: settings.businessName,
          address: settings.businessAddress,
          phone: settings.businessPhone,
          email: settings.businessEmail,
          tax_number: settings.taxId,
          currency: settings.currency,
          logo_url: settings.logoUrl,
        })
        .eq('id', companyId);
      
      toast.success('Company settings saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving company settings:', error);
      toast.error('Failed to save company settings');
    }
  };

  const updateBranches = (branches: BranchSettings[]) => {
    setBranches(branches);
  };

  const addBranch = (branch: BranchSettings) => {
    setBranches(prev => [...prev, branch]);
  };

  const updatePOSSettings = async (settings: Partial<POSSettings>) => {
    if (!companyId) return;
    
    const updated = { ...posSettings, ...settings };
    setPOSSettings(updated);
    
    try {
      await settingsService.setSetting(companyId, 'pos_settings', updated, 'pos', 'POS module settings');
      toast.success('POS settings saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving POS settings:', error);
      toast.error('Failed to save POS settings');
    }
  };

  const updateSalesSettings = async (settings: Partial<SalesSettings>) => {
    if (!companyId) return;
    
    const updated = { ...salesSettings, ...settings };
    setSalesSettings(updated);
    
    try {
      await settingsService.setSetting(companyId, 'sales_settings', updated, 'sales', 'Sales module settings');
      toast.success('Sales settings saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving sales settings:', error);
      toast.error('Failed to save sales settings');
    }
  };

  const updatePurchaseSettings = async (settings: Partial<PurchaseSettings>) => {
    if (!companyId) return;
    
    const updated = { ...purchaseSettings, ...settings };
    setPurchaseSettings(updated);
    
    try {
      await settingsService.setSetting(companyId, 'purchase_settings', updated, 'purchase', 'Purchase module settings');
      toast.success('Purchase settings saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving purchase settings:', error);
      toast.error('Failed to save purchase settings');
    }
  };

  const updateInventorySettings = async (settings: Partial<InventorySettings>, options?: { silent?: boolean }) => {
    if (!companyId) return;
    
    const updated = { ...inventorySettings, ...settings };
    setInventorySettings(updated);
    
    try {
      // Save inventory_settings (excluding enablePacking; defaultUnitId is included)
      const { enablePacking, ...otherSettings } = updated;
      await settingsService.setSetting(companyId, 'inventory_settings', otherSettings, 'inventory', 'Inventory module settings');
      
      // Save enablePacking separately (global setting)
      if (settings.enablePacking !== undefined) {
        await settingsService.setEnablePacking(companyId, settings.enablePacking);
      }
      
      if (!options?.silent) toast.success('Inventory settings saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving inventory settings:', error);
      toast.error('Failed to save inventory settings');
    }
  };

  const updateRentalSettings = async (settings: Partial<RentalSettings>) => {
    if (!companyId) return;
    
    const updated = { ...rentalSettings, ...settings };
    setRentalSettings(updated);
    
    try {
      await settingsService.setSetting(companyId, 'rental_settings', updated, 'rental', 'Rental module settings');
      toast.success('Rental settings saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving rental settings:', error);
      toast.error('Failed to save rental settings');
    }
  };

  const updateAccountingSettings = async (settings: Partial<AccountingSettings>) => {
    if (!companyId) return;
    
    const updated = { ...accountingSettings, ...settings };
    setAccountingSettings(updated);
    
    try {
      await settingsService.setSetting(companyId, 'accounting_settings', updated, 'accounting', 'Accounting module settings');
      toast.success('Accounting settings saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving accounting settings:', error);
      toast.error('Failed to save accounting settings');
    }
  };

  const updateDefaultAccounts = async (accounts: Partial<DefaultAccounts>) => {
    if (!companyId) return;
    
    const updated = { ...defaultAccounts, ...accounts };
    setDefaultAccounts(updated);
    
    try {
      await settingsService.setSetting(companyId, 'default_accounts', updated, 'accounts', 'Default payment accounts');
      toast.success('Default accounts saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving default accounts:', error);
      toast.error('Failed to save default accounts');
    }
  };

  const updateNumberingRules = async (rules: Partial<NumberingRules>) => {
    if (!companyId) return;
    
    const updated = { ...numberingRules, ...rules };
    setNumberingRules(updated);
    
    try {
      // Map numbering rules to document sequences
      const documentTypeMap: Record<string, { prefix: string; nextNumber: number }> = {
        sale: { prefix: updated.salePrefix, nextNumber: updated.saleNextNumber },
        purchase: { prefix: updated.purchasePrefix, nextNumber: updated.purchaseNextNumber },
        rental: { prefix: updated.rentalPrefix, nextNumber: updated.rentalNextNumber },
        expense: { prefix: updated.expensePrefix, nextNumber: updated.expenseNextNumber },
        product: { prefix: updated.productPrefix, nextNumber: updated.productNextNumber },
        studio: { prefix: updated.studioPrefix, nextNumber: updated.studioNextNumber },
        pos: { prefix: updated.posPrefix, nextNumber: updated.posNextNumber },
        payment: { prefix: updated.paymentPrefix ?? 'PAY-', nextNumber: updated.paymentNextNumber ?? 1 },
        job: { prefix: updated.jobPrefix ?? 'JOB-', nextNumber: updated.jobNextNumber ?? 1 },
        journal: { prefix: updated.journalPrefix ?? 'JV-', nextNumber: updated.journalNextNumber ?? 1 },
      };

      // Save each document sequence
      for (const [docType, { prefix, nextNumber }] of Object.entries(documentTypeMap)) {
        await settingsService.setDocumentSequence(companyId, branchId === 'all' ? undefined : branchId || undefined, docType, prefix, nextNumber, 4);
      }
      
      toast.success('Numbering rules saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving numbering rules:', error);
      toast.error('Failed to save numbering rules');
    }
  };

  const getNextNumber = async (module: keyof NumberingRules): Promise<string> => {
    if (!companyId) {
      // Fallback to local increment if no company
      const prefixKey = module.replace('NextNumber', 'Prefix') as keyof NumberingRules;
      const prefix = numberingRules[prefixKey] as string;
      const nextNum = numberingRules[module] as number;
      setNumberingRules(prev => ({
        ...prev,
        [module]: nextNum + 1,
      }));
      return `${prefix}${String(nextNum).padStart(4, '0')}`;
    }

    // Map module to document type
    const docTypeMap: Record<string, string> = {
      saleNextNumber: 'sale',
      purchaseNextNumber: 'purchase',
      rentalNextNumber: 'rental',
      expenseNextNumber: 'expense',
      productNextNumber: 'product',
      studioNextNumber: 'studio',
      posNextNumber: 'pos',
      paymentNextNumber: 'payment',
      jobNextNumber: 'job',
      journalNextNumber: 'journal',
    };

    const docType = docTypeMap[module];
    if (!docType) {
      throw new Error(`Unknown module: ${module}`);
    }

    try {
      const nextNumber = await settingsService.getNextDocumentNumber(companyId, branchId === 'all' ? undefined : branchId || undefined, docType);
      // Update local state
      const prefixKey = module.replace('NextNumber', 'Prefix') as keyof NumberingRules;
      const prefix = numberingRules[prefixKey] as string;
      const currentNum = parseInt(nextNumber.replace(prefix, '')) || 0;
      setNumberingRules(prev => ({
        ...prev,
        [module]: currentNum + 1,
      }));
      return nextNumber;
    } catch (error) {
      console.error('[SETTINGS] Error getting next number:', error);
      // Fallback to local increment
      const prefixKey = module.replace('NextNumber', 'Prefix') as keyof NumberingRules;
      const prefix = numberingRules[prefixKey] as string;
      const nextNum = numberingRules[module] as number;
      setNumberingRules(prev => ({
        ...prev,
        [module]: nextNum + 1,
      }));
      return `${prefix}${String(nextNum).padStart(4, '0')}`;
    }
  };

  const updatePermissions = async (permissions: Partial<UserPermissions>) => {
    if (!companyId) return;
    
    const updated = { ...currentUser, ...permissions };
    setCurrentUser(updated);
    
    try {
      await settingsService.setSetting(companyId, 'user_permissions', updated, 'permissions', 'User permissions');
      toast.success('Permissions saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving permissions:', error);
      toast.error('Failed to save permissions');
    }
  };

  const updateModules = async (newModules: Partial<ModuleToggles>) => {
    if (!companyId) return;
    
    const updated = { ...modules, ...newModules };
    setModules(updated);
    
    try {
      // Save each module toggle
      const moduleNameMap: Record<keyof ModuleToggles, string> = {
        rentalModuleEnabled: 'rentals',
        studioModuleEnabled: 'studio',
        accountingModuleEnabled: 'accounting',
        productionModuleEnabled: 'production',
        posModuleEnabled: 'pos',
        combosEnabled: 'combos',
      };

      for (const [key, moduleName] of Object.entries(moduleNameMap)) {
        if (key in newModules) {
          await settingsService.setModuleEnabled(companyId, moduleName, updated[key as keyof ModuleToggles] as boolean);
        }
      }
      
      toast.success('Module toggles saved');
    } catch (error) {
      console.error('[SETTINGS] Error saving module toggles:', error);
      toast.error('Failed to save module toggles');
    }
  };

  const value: SettingsContextType = {
    loading,
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
    refreshSettings: loadAllSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};