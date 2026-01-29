import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSupabase } from './SupabaseContext';
import { settingsService } from '@/app/services/settingsService';
import { branchService } from '@/app/services/branchService';
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

export interface NumberingRules {
  salePrefix: string;
  saleNextNumber: number;
  quotationPrefix?: string; // CRITICAL FIX: Add quotation prefix
  quotationNextNumber?: number; // CRITICAL FIX: Add quotation next number
  draftNextNumber?: number; // CRITICAL FIX: Add draft next number
  orderNextNumber?: number; // CRITICAL FIX: Add order next number
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
  updateInventorySettings: (settings: Partial<InventorySettings>) => Promise<void>;
  
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
  const { companyId, branchId } = useSupabase();
  const [loading, setLoading] = useState<boolean>(true);

  // Company Settings
  const [company, setCompany] = useState<CompanySettings>({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
    taxId: '',
    currency: 'PKR',
    logoUrl: undefined,
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
    invoicePrefix: 'SAL-',
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

  // Numbering Rules
  const [numberingRules, setNumberingRules] = useState<NumberingRules>({
    salePrefix: 'INV-', // CRITICAL FIX: Changed from SAL- to INV- for invoices
    saleNextNumber: 1,
    quotationPrefix: 'QT-', // CRITICAL FIX: Add quotation prefix
    quotationNextNumber: 1, // CRITICAL FIX: Add quotation next number
    draftNextNumber: 1, // CRITICAL FIX: Add draft next number
    orderNextNumber: 1, // CRITICAL FIX: Add order next number
    purchasePrefix: 'PO-',
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
        setCompany({
          businessName: companyData.name || '',
          businessAddress: companyData.address || '',
          businessPhone: companyData.phone || '',
          businessEmail: companyData.email || '',
          taxId: companyData.tax_number || '',
          currency: companyData.currency || 'PKR',
          logoUrl: companyData.logo_url || undefined,
        });
      }

      // Load branches
      const branchesData = await branchService.getAllBranches(companyId);
      const convertedBranches: BranchSettings[] = branchesData.map(b => ({
        id: b.id,
        branchCode: b.code || '',
        branchName: b.name || '',
        address: b.address || '',
        phone: b.phone || '',
        isActive: b.is_active !== false,
        isDefault: false, // TODO: Get from user_branches or branch settings
        cashAccount: '', // TODO: Load from branch settings
        bankAccount: '', // TODO: Load from branch settings
        posCashDrawer: '', // TODO: Load from branch settings
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
        invoicePrefix: salesData.invoicePrefix || 'SAL-',
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
      setInventorySettings({
        lowStockThreshold: inventoryData.lowStockThreshold || 0,
        reorderAlertDays: inventoryData.reorderAlertDays || 0,
        negativeStockAllowed: inventoryData.negativeStockAllowed || false,
        valuationMethod: inventoryData.valuationMethod || 'FIFO',
        autoReorderEnabled: inventoryData.autoReorderEnabled || false,
        barcodeRequired: inventoryData.barcodeRequired || false,
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
      
      setNumberingRules({
        salePrefix: getSequence('sale')?.prefix || 'SAL-',
        saleNextNumber: getSequence('sale')?.current_number || 1,
        purchasePrefix: getSequence('purchase')?.prefix || 'PO-',
        purchaseNextNumber: getSequence('purchase')?.current_number || 1,
        rentalPrefix: getSequence('rental')?.prefix || 'RNT-',
        rentalNextNumber: getSequence('rental')?.current_number || 1,
        expensePrefix: getSequence('expense')?.prefix || 'EXP-',
        expenseNextNumber: getSequence('expense')?.current_number || 1,
        productPrefix: getSequence('product')?.prefix || 'PRD-',
        productNextNumber: getSequence('product')?.current_number || 1,
        studioPrefix: getSequence('studio')?.prefix || 'STD-',
        studioNextNumber: getSequence('studio')?.current_number || 1,
        posPrefix: getSequence('pos')?.prefix || 'POS-',
        posNextNumber: getSequence('pos')?.current_number || 1,
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
      });

      console.log('✅ Settings loaded from database');
    } catch (error) {
      console.error('[SETTINGS CONTEXT] Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

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

  const updateInventorySettings = async (settings: Partial<InventorySettings>) => {
    if (!companyId) return;
    
    const updated = { ...inventorySettings, ...settings };
    setInventorySettings(updated);
    
    try {
      await settingsService.setSetting(companyId, 'inventory_settings', updated, 'inventory', 'Inventory module settings');
      toast.success('Inventory settings saved');
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