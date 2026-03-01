import React, { useState, useEffect } from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon,
  Palette,
  FileText,
  Package,
  ShoppingCart,
  Receipt,
  PieChart,
  Bell,
  Shield,
  Database,
  Globe,
  Printer,
  Mail,
  Key,
  Save,
  RotateCcw,
  Check,
  Building2,
  User,
  CreditCard,
  Percent,
  Calendar,
  Hash,
  ImageIcon,
  Type,
  DollarSign,
  Truck,
  Archive,
  Users,
  FileStack,
  BarChart3,
  AlertCircle,
  Layers,
  ToggleLeft,
  Activity
} from 'lucide-react';
import { getHealthDashboard, type ErpHealthRow } from '@/app/services/healthService';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";

type SettingsTab = 
  | 'general'
  | 'modules'
  | 'theme'
  | 'invoice'
  | 'product'
  | 'sales'
  | 'purchase'
  | 'rental'
  | 'reports'
  | 'notifications'
  | 'security'
  | 'systemHealth'
  | 'advanced';

interface Settings {
  // General
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessWebsite: string;
  taxId: string;
  currency: string;
  timezone: string;
  language: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  decimalPlaces: number;
  thousandSeparator: ',' | '.' | ' ';
  
  // Module Management
  enablePOSModule: boolean;
  enableInventoryModule: boolean;
  enableRentalModule: boolean;
  enableStudioModule: boolean;
  enableCustomizeModule: boolean;
  enableAccountingModule: boolean;
  enableExpensesModule: boolean;
  enableReportsModule: boolean;
  
  // Theme
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  darkMode: boolean;
  compactMode: boolean;
  sidebarPosition: 'left' | 'right';
  showBreadcrumbs: boolean;
  animationsEnabled: boolean;
  
  // Invoice
  invoicePrefix: string;
  invoiceNumberFormat: string;
  invoiceStartNumber: number;
  invoiceTemplate: 'modern' | 'classic' | 'minimal';
  showTaxOnInvoice: boolean;
  showDiscountOnInvoice: boolean;
  invoiceTerms: string;
  invoiceFooter: string;
  invoiceLogoPosition: 'left' | 'center' | 'right';
  invoiceDueDays: number;
  invoiceWatermark: string;
  
  // Product
  skuFormat: string;
  skuAutoGenerate: boolean;
  lowStockThreshold: number;
  enableBarcode: boolean;
  barcodeFormat: 'CODE128' | 'EAN13' | 'QR';
  defaultProductUnit: string;
  enableProductVariants: boolean;
  enableProductExpiry: boolean;
  enableProductImages: boolean;
  maxProductImages: number;
  productCodePrefix: string;
  trackSerialNumbers: boolean;
  enableBatchTracking: boolean;
  
  // Sales
  defaultTaxRate: number;
  enableMultipleTax: boolean;
  maxDiscountPercent: number;
  requireCustomerForSale: boolean;
  enableLayaway: boolean;
  allowNegativeStock: boolean;
  defaultPaymentMethod: string;
  printReceiptAutomatically: boolean;
  duplicateItemBehavior: 'increase_quantity' | 'add_new_row';
  autoSaveInterval: number;
  enableQuickSale: boolean;
  showStockInSale: boolean;
  requireSaleApproval: boolean;
  minimumSaleAmount: number;
  enableCustomerCredit: boolean;
  creditLimit: number;
  enableLoyaltyPoints: boolean;
  pointsPerCurrency: number;
  enableSaleReturns: boolean;
  returnDaysLimit: number;
  
  // Purchase
  purchaseOrderPrefix: string;
  requirePurchaseApproval: boolean;
  defaultPurchaseTax: number;
  enablePurchaseReturn: boolean;
  enableVendorRating: boolean;
  purchaseApprovalAmount: number;
  enableGRN: boolean;
  grnPrefix: string;
  enableQualityCheck: boolean;
  
  // Rental
  rentalPrefix: string;
  defaultRentalDuration: number;
  lateFeePerDay: number;
  securityDepositPercent: number;
  enableRentalReminders: boolean;
  reminderDaysBefore: number;
  enableDamageCharges: boolean;
  damageAssessmentRequired: boolean;
  autoCalculateLateFee: boolean;
  
  // Reports
  reportDateFormat: string;
  reportCurrency: string;
  enableAutoReports: boolean;
  reportEmailFrequency: 'daily' | 'weekly' | 'monthly';
  includeGraphsInReports: boolean;
  defaultReportPeriod: 'week' | 'month' | 'quarter' | 'year';
  enableExportPDF: boolean;
  enableExportExcel: boolean;
  enableExportCSV: boolean;
  
  // Notifications
  emailNotifications: boolean;
  smsNotifications: boolean;
  lowStockAlert: boolean;
  paymentDueAlert: boolean;
  rentalReturnAlert: boolean;
  expiryAlert: boolean;
  expiryAlertDays: number;
  orderStatusNotification: boolean;
  dailySalesSummary: boolean;
  
  // Security
  twoFactorAuth: boolean;
  sessionTimeout: number;
  passwordPolicy: 'weak' | 'medium' | 'strong';
  enableAuditLog: boolean;
  ipWhitelist: string;
  maxLoginAttempts: number;
  lockoutDuration: number;
  requireEmailVerification: boolean;
  enableRoleBasedAccess: boolean;
  
  // Advanced
  enableAPI: boolean;
  apiKey: string;
  webhookUrl: string;
  enableBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  debugMode: boolean;
  enableMultiLocation: boolean;
  defaultLocation: string;
  enableMultiCurrency: boolean;
  autoUpdateExchangeRate: boolean;
  enableDataEncryption: boolean;
  cacheDuration: number;
}

function SystemHealthTab() {
  const [rows, setRows] = useState<ErpHealthRow[]>([]);
  const [overall, setOverall] = useState<'PASS' | 'FAIL'>('PASS');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHealthDashboard();
      setRows(result.rows);
      setOverall(result.overall);
      if (result.error) setError(result.error);
    } catch {
      setError('Failed to load health data');
      setRows([]);
      setOverall('FAIL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statusColor = (status: string) => {
    if (status === 'OK') return 'text-green-400 bg-green-500/10';
    if (status === 'FAIL') return 'text-red-400 bg-red-500/10';
    return 'text-gray-400 bg-gray-500/10';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="text-emerald-400" size={24} />
          <h2 className="text-xl font-bold text-white">System Health</h2>
        </div>
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="text-emerald-400" size={24} />
          <h2 className="text-xl font-bold text-white">System Health</h2>
        </div>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const displayRows = [...rows];
  const overallStatus = rows.some((r) => r.status === 'FAIL') ? 'FAIL' : 'PASS';
  if (!rows.some((r) => r.component === 'OVERALL')) {
    displayRows.push({ component: 'OVERALL', status: overallStatus === 'PASS' ? 'OK' : 'FAIL', details: null });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="text-emerald-400" size={24} />
        <h2 className="text-xl font-bold text-white">System Health</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-700 rounded-lg border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="text-left text-gray-300 font-medium p-3 border-b border-gray-700">Component</th>
              <th className="text-left text-gray-300 font-medium p-3 border-b border-gray-700">Status</th>
              <th className="text-left text-gray-300 font-medium p-3 border-b border-gray-700">Details</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r, i) => (
              <tr key={i} className="border-b border-gray-800">
                <td className="p-3 text-white">{r.component}</td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${statusColor(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-3 text-gray-400">{r.details ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-amber-400 text-sm">{error}</p>}
      <Button
        type="button"
        variant="outline"
        onClick={load}
        className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
      >
        Refresh
      </Button>
    </div>
  );
}

export const SettingsPage = () => {
  const settingsContext = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { userRole } = useSupabase();
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner' || userRole === 'Admin' || userRole === 'Owner';
  const [settings, setSettings] = useState<Settings>({
    // General
    businessName: 'Din Collection',
    businessAddress: 'Main Market, Lahore, Pakistan',
    businessPhone: '+92 300 1234567',
    businessEmail: 'info@dincollection.com',
    businessWebsite: 'www.dincollection.com',
    taxId: 'TAX-123456',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    language: 'en',
    fiscalYearStart: '01-01',
    fiscalYearEnd: '12-31',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    decimalPlaces: 2,
    thousandSeparator: ',',
    
    // Module Management
    enablePOSModule: true,
    enableInventoryModule: true,
    enableRentalModule: true,
    enableStudioModule: true,
    enableCustomizeModule: true,
    enableAccountingModule: true,
    enableExpensesModule: true,
    enableReportsModule: true,
    
    // Theme
    primaryColor: '#9333EA',
    secondaryColor: '#3B82F6',
    accentColor: '#10B981',
    logoUrl: '',
    darkMode: true,
    compactMode: false,
    sidebarPosition: 'left',
    showBreadcrumbs: true,
    animationsEnabled: true,
    
    // Invoice
    invoicePrefix: 'INV',
    invoiceNumberFormat: 'YYYY-NNNN',
    invoiceStartNumber: 1,
    invoiceTemplate: 'modern',
    showTaxOnInvoice: true,
    showDiscountOnInvoice: true,
    invoiceTerms: 'Payment due within 30 days',
    invoiceFooter: 'Thank you for your business!',
    invoiceLogoPosition: 'left',
    invoiceDueDays: 30,
    invoiceWatermark: '',
    
    // Product
    skuFormat: 'PRD-NNNN',
    skuAutoGenerate: true,
    lowStockThreshold: 10,
    enableBarcode: true,
    barcodeFormat: 'CODE128',
    defaultProductUnit: 'piece',
    enableProductVariants: true,
    enableProductExpiry: false,
    enableProductImages: true,
    maxProductImages: 5,
    productCodePrefix: 'PRD',
    trackSerialNumbers: false,
    enableBatchTracking: false,
    
    // Sales
    defaultTaxRate: 17,
    enableMultipleTax: false,
    maxDiscountPercent: 50,
    requireCustomerForSale: false,
    enableLayaway: true,
    allowNegativeStock: false,
    defaultPaymentMethod: 'cash',
    printReceiptAutomatically: false,
    duplicateItemBehavior: 'increase_quantity',
    autoSaveInterval: 30,
    enableQuickSale: true,
    showStockInSale: true,
    requireSaleApproval: false,
    minimumSaleAmount: 0,
    enableCustomerCredit: true,
    creditLimit: 50000,
    enableLoyaltyPoints: false,
    pointsPerCurrency: 1,
    enableSaleReturns: true,
    returnDaysLimit: 7,
    
    // Purchase
    purchaseOrderPrefix: 'PO',
    requirePurchaseApproval: false,
    defaultPurchaseTax: 17,
    enablePurchaseReturn: true,
    enableVendorRating: true,
    purchaseApprovalAmount: 100000,
    enableGRN: false,
    grnPrefix: 'GRN',
    enableQualityCheck: false,
    
    // Rental
    rentalPrefix: 'RNT',
    defaultRentalDuration: 3,
    lateFeePerDay: 500,
    securityDepositPercent: 20,
    enableRentalReminders: true,
    reminderDaysBefore: 1,
    enableDamageCharges: true,
    damageAssessmentRequired: true,
    autoCalculateLateFee: true,
    
    // Reports
    reportDateFormat: 'DD/MM/YYYY',
    reportCurrency: 'PKR',
    enableAutoReports: false,
    reportEmailFrequency: 'weekly',
    includeGraphsInReports: true,
    defaultReportPeriod: 'month',
    enableExportPDF: true,
    enableExportExcel: true,
    enableExportCSV: true,
    
    // Notifications
    emailNotifications: true,
    smsNotifications: false,
    lowStockAlert: true,
    paymentDueAlert: true,
    rentalReturnAlert: true,
    expiryAlert: true,
    expiryAlertDays: 30,
    orderStatusNotification: true,
    dailySalesSummary: false,
    
    // Security
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordPolicy: 'medium',
    enableAuditLog: true,
    ipWhitelist: '',
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    requireEmailVerification: false,
    enableRoleBasedAccess: true,
    
    // Advanced
    enableAPI: false,
    apiKey: '',
    webhookUrl: '',
    enableBackup: true,
    backupFrequency: 'daily',
    debugMode: false,
    enableMultiLocation: false,
    defaultLocation: 'Main Store',
    enableMultiCurrency: false,
    autoUpdateExchangeRate: false,
    enableDataEncryption: false,
    cacheDuration: 60
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from context on mount
  useEffect(() => {
    if (settingsContext.company.businessName) {
      setSettings(prev => ({
        ...prev,
        businessName: settingsContext.company.businessName,
        businessAddress: settingsContext.company.businessAddress,
        businessPhone: settingsContext.company.businessPhone,
        businessEmail: settingsContext.company.businessEmail,
        taxId: settingsContext.company.taxId,
        currency: settingsContext.company.currency,
        logoUrl: settingsContext.company.logoUrl || '',
        // Module toggles
        enablePOSModule: settingsContext.modules.pos,
        enableInventoryModule: settingsContext.modules.inventory,
        enableRentalModule: settingsContext.modules.rental,
        enableStudioModule: settingsContext.modules.studio,
        enableAccountingModule: settingsContext.modules.accounting,
        enableExpensesModule: settingsContext.modules.expenses,
        enableReportsModule: settingsContext.modules.reports,
        // POS Settings
        defaultTaxRate: settingsContext.posSettings.defaultTaxRate,
        invoicePrefix: settingsContext.posSettings.invoicePrefix,
        maxDiscountPercent: settingsContext.posSettings.maxDiscountPercent || 50,
        // Sales Settings
        partialPaymentAllowed: settingsContext.salesSettings.partialPaymentAllowed,
        defaultPaymentMethod: settingsContext.salesSettings.defaultPaymentMethod || 'Cash',
        autoLedgerEntry: settingsContext.salesSettings.autoLedgerEntry,
        invoicePrefix: settingsContext.salesSettings.invoicePrefix,
        autoDueDays: settingsContext.salesSettings.autoDueDays || 30,
        allowCreditSale: settingsContext.salesSettings.allowCreditSale,
        // Purchase Settings
        purchaseOrderPrefix: settingsContext.purchaseSettings.poPrefix || 'PO',
        defaultPurchaseTax: settingsContext.purchaseSettings.defaultTaxRate || 17,
        // Numbering Rules
        invoiceNumberFormat: settingsContext.numberingRules.salePrefix || 'INV',
        purchaseOrderPrefix: settingsContext.numberingRules.purchasePrefix || 'PO',
        rentalPrefix: settingsContext.numberingRules.rentalPrefix || 'RNT',
      }));
    }
  }, [settingsContext]);

  const tabs = [
    { id: 'general', label: 'General', icon: Building2, color: 'blue' },
    { id: 'modules', label: 'Module Management', icon: Layers, color: 'emerald' },
    { id: 'theme', label: 'Theme & Appearance', icon: Palette, color: 'purple' },
    { id: 'invoice', label: 'Invoice Settings', icon: FileText, color: 'green' },
    { id: 'product', label: 'Product Settings', icon: Package, color: 'orange' },
    { id: 'sales', label: 'Sales Settings', icon: ShoppingCart, color: 'pink' },
    { id: 'purchase', label: 'Purchase Settings', icon: Truck, color: 'indigo' },
    { id: 'rental', label: 'Rental Settings', icon: Archive, color: 'teal' },
    { id: 'reports', label: 'Reports Settings', icon: PieChart, color: 'yellow' },
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'red' },
    { id: 'security', label: 'Security', icon: Shield, color: 'cyan' },
    ...(isAdminOrOwner ? [{ id: 'systemHealth' as const, label: 'System Health', icon: Activity, color: 'emerald' as const }] : []),
    { id: 'advanced', label: 'Advanced', icon: Database, color: 'gray' }
  ];

  const handleChange = (field: keyof Settings, value: any) => {
    setSettings({ ...settings, [field]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      // Update company settings
      await settingsContext.updateCompanySettings({
        businessName: settings.businessName,
        businessAddress: settings.businessAddress,
        businessPhone: settings.businessPhone,
        businessEmail: settings.businessEmail,
        taxId: settings.taxId,
        currency: settings.currency,
        logoUrl: settings.logoUrl || undefined,
      });

      // Update module toggles
      await settingsContext.updateModules({
        pos: settings.enablePOSModule,
        inventory: settings.enableInventoryModule,
        rental: settings.enableRentalModule,
        studio: settings.enableStudioModule,
        accounting: settings.enableAccountingModule,
        expenses: settings.enableExpensesModule,
        reports: settings.enableReportsModule,
      });

      // Update POS settings
      await settingsContext.updatePOSSettings({
        defaultTaxRate: settings.defaultTaxRate,
        invoicePrefix: settings.invoicePrefix,
        maxDiscountPercent: settings.maxDiscountPercent,
      });

      // Update Sales settings
      await settingsContext.updateSalesSettings({
        partialPaymentAllowed: settings.partialPaymentAllowed,
        defaultPaymentMethod: settings.defaultPaymentMethod as 'Cash' | 'Bank' | 'Mobile Wallet',
        autoLedgerEntry: settings.autoLedgerEntry,
        invoicePrefix: settings.invoicePrefix,
        autoDueDays: settings.autoDueDays,
        allowCreditSale: settings.allowCreditSale,
      });

      // Update Purchase settings
      await settingsContext.updatePurchaseSettings({
        poPrefix: settings.purchaseOrderPrefix,
        defaultTaxRate: settings.defaultPurchaseTax,
      });

      // Update Numbering rules
      await settingsContext.updateNumberingRules({
        salePrefix: settings.invoicePrefix,
        purchasePrefix: settings.purchaseOrderPrefix,
        rentalPrefix: settings.rentalPrefix,
      });

      setHasChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <SettingsIcon className="text-purple-400" size={32} />
                System Settings
              </h1>
              <p className="text-gray-400 mt-2">
                Configure every aspect of your ERP system - from modules to minute details
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
              >
                <RotateCcw size={16} className="mr-2" />
                Reset All
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges}
                className="bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                <Save size={16} className="mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Tabs Sidebar */}
          <div className="col-span-1 space-y-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'bg-purple-500/20 border-purple-500 text-white'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span className="font-medium text-sm">{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Settings Content */}
          <div className="col-span-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Building2 className="text-blue-400" size={24} />
                    <h2 className="text-xl font-bold text-white">General Business Settings</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Business Name *</Label>
                      <Input
                        value={settings.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Tax ID / NTN</Label>
                      <Input
                        value={settings.taxId}
                        onChange={(e) => handleChange('taxId', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-gray-400 mb-2 block">Business Address</Label>
                      <Textarea
                        value={settings.businessAddress}
                        onChange={(e) => handleChange('businessAddress', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Phone Number</Label>
                      <Input
                        value={settings.businessPhone}
                        onChange={(e) => handleChange('businessPhone', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Email Address</Label>
                      <Input
                        type="email"
                        value={settings.businessEmail}
                        onChange={(e) => handleChange('businessEmail', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Website</Label>
                      <Input
                        value={settings.businessWebsite}
                        onChange={(e) => handleChange('businessWebsite', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Currency</Label>
                      <select
                        value={settings.currency}
                        onChange={(e) => handleChange('currency', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="PKR">PKR - Pakistani Rupee</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="AED">AED - UAE Dirham</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Timezone</Label>
                      <select
                        value={settings.timezone}
                        onChange={(e) => handleChange('timezone', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Language</Label>
                      <select
                        value={settings.language}
                        onChange={(e) => handleChange('language', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="en">English</option>
                        <option value="ur">Urdu</option>
                        <option value="ar">Arabic</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Fiscal Year Start (MM-DD)</Label>
                      <Input
                        value={settings.fiscalYearStart}
                        onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
                        placeholder="01-01"
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">Start of financial year</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Fiscal Year End (MM-DD)</Label>
                      <Input
                        value={settings.fiscalYearEnd}
                        onChange={(e) => handleChange('fiscalYearEnd', e.target.value)}
                        placeholder="12-31"
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">End of financial year</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Date Format</Label>
                      <select
                        value={settings.dateFormat}
                        onChange={(e) => handleChange('dateFormat', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Time Format</Label>
                      <select
                        value={settings.timeFormat}
                        onChange={(e) => handleChange('timeFormat', e.target.value as '12h' | '24h')}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="12h">12 Hour (AM/PM)</option>
                        <option value="24h">24 Hour</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Decimal Places</Label>
                      <Input
                        type="number"
                        min="0"
                        max="4"
                        value={settings.decimalPlaces}
                        onChange={(e) => handleChange('decimalPlaces', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">For amounts (0-4)</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Thousand Separator</Label>
                      <select
                        value={settings.thousandSeparator}
                        onChange={(e) => handleChange('thousandSeparator', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value=",">, (Comma) - 1,000</option>
                        <option value=".">. (Period) - 1.000</option>
                        <option value=" ">  (Space) - 1 000</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Module Management */}
              {activeTab === 'modules' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Layers className="text-emerald-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Module Management</h2>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-blue-400 mt-0.5" size={20} />
                      <div>
                        <div className="text-blue-400 font-semibold">Module Control Center</div>
                        <div className="text-xs text-blue-300/80 mt-1">
                          Enable or disable modules to customize your ERP system. Disabled modules won't appear in the sidebar.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* POS System */}
                    <div 
                      onClick={() => handleChange('enablePOSModule', !settings.enablePOSModule)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        settings.enablePOSModule
                          ? 'bg-purple-500/10 border-purple-500 shadow-lg shadow-purple-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          settings.enablePOSModule ? 'bg-purple-500/20' : 'bg-gray-700/50'
                        }`}>
                          <ShoppingCart className={settings.enablePOSModule ? 'text-purple-400' : 'text-gray-500'} size={24} />
                        </div>
                        <Badge className={`${
                          settings.enablePOSModule 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}>
                          {settings.enablePOSModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className={`font-semibold text-lg mb-1 ${settings.enablePOSModule ? 'text-white' : 'text-gray-400'}`}>
                        POS System
                      </div>
                      <div className="text-xs text-gray-500">
                        Point of Sale module for quick transactions
                      </div>
                    </div>

                    {/* Inventory Management */}
                    <div 
                      onClick={() => handleChange('enableInventoryModule', !settings.enableInventoryModule)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        settings.enableInventoryModule
                          ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          settings.enableInventoryModule ? 'bg-blue-500/20' : 'bg-gray-700/50'
                        }`}>
                          <Package className={settings.enableInventoryModule ? 'text-blue-400' : 'text-gray-500'} size={24} />
                        </div>
                        <Badge className={`${
                          settings.enableInventoryModule 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}>
                          {settings.enableInventoryModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className={`font-semibold text-lg mb-1 ${settings.enableInventoryModule ? 'text-white' : 'text-gray-400'}`}>
                        Inventory Management
                      </div>
                      <div className="text-xs text-gray-500">
                        Complete stock and warehouse management
                      </div>
                    </div>

                    {/* Rental Management */}
                    <div 
                      onClick={() => handleChange('enableRentalModule', !settings.enableRentalModule)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        settings.enableRentalModule
                          ? 'bg-teal-500/10 border-teal-500 shadow-lg shadow-teal-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          settings.enableRentalModule ? 'bg-teal-500/20' : 'bg-gray-700/50'
                        }`}>
                          <Archive className={settings.enableRentalModule ? 'text-teal-400' : 'text-gray-500'} size={24} />
                        </div>
                        <Badge className={`${
                          settings.enableRentalModule 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}>
                          {settings.enableRentalModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className={`font-semibold text-lg mb-1 ${settings.enableRentalModule ? 'text-white' : 'text-gray-400'}`}>
                        Rental Management
                      </div>
                      <div className="text-xs text-gray-500">
                        Manage rental items and bookings
                      </div>
                    </div>

                    {/* Studio Production */}
                    <div 
                      onClick={() => handleChange('enableStudioModule', !settings.enableStudioModule)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        settings.enableStudioModule
                          ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          settings.enableStudioModule ? 'bg-orange-500/20' : 'bg-gray-700/50'
                        }`}>
                          <Building2 className={settings.enableStudioModule ? 'text-orange-400' : 'text-gray-500'} size={24} />
                        </div>
                        <Badge className={`${
                          settings.enableStudioModule 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}>
                          {settings.enableStudioModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className={`font-semibold text-lg mb-1 ${settings.enableStudioModule ? 'text-white' : 'text-gray-400'}`}>
                        Studio Production
                      </div>
                      <div className="text-xs text-gray-500">
                        Full production workflow with departments
                      </div>
                    </div>

                    {/* Accounting */}
                    <div 
                      onClick={() => handleChange('enableAccountingModule', !settings.enableAccountingModule)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        settings.enableAccountingModule
                          ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          settings.enableAccountingModule ? 'bg-green-500/20' : 'bg-gray-700/50'
                        }`}>
                          <DollarSign className={settings.enableAccountingModule ? 'text-green-400' : 'text-gray-500'} size={24} />
                        </div>
                        <Badge className={`${
                          settings.enableAccountingModule 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}>
                          {settings.enableAccountingModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className={`font-semibold text-lg mb-1 ${settings.enableAccountingModule ? 'text-white' : 'text-gray-400'}`}>
                        Accounting
                      </div>
                      <div className="text-xs text-gray-500">
                        Financial accounts and ledgers
                      </div>
                    </div>

                    {/* Expenses Management */}
                    <div 
                      onClick={() => handleChange('enableExpensesModule', !settings.enableExpensesModule)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        settings.enableExpensesModule
                          ? 'bg-red-500/10 border-red-500 shadow-lg shadow-red-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          settings.enableExpensesModule ? 'bg-red-500/20' : 'bg-gray-700/50'
                        }`}>
                          <Receipt className={settings.enableExpensesModule ? 'text-red-400' : 'text-gray-500'} size={24} />
                        </div>
                        <Badge className={`${
                          settings.enableExpensesModule 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}>
                          {settings.enableExpensesModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className={`font-semibold text-lg mb-1 ${settings.enableExpensesModule ? 'text-white' : 'text-gray-400'}`}>
                        Expenses Management
                      </div>
                      <div className="text-xs text-gray-500">
                        Track and manage business expenses
                      </div>
                    </div>

                    {/* Reports & Analytics */}
                    <div 
                      onClick={() => handleChange('enableReportsModule', !settings.enableReportsModule)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        settings.enableReportsModule
                          ? 'bg-yellow-500/10 border-yellow-500 shadow-lg shadow-yellow-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          settings.enableReportsModule ? 'bg-yellow-500/20' : 'bg-gray-700/50'
                        }`}>
                          <PieChart className={settings.enableReportsModule ? 'text-yellow-400' : 'text-gray-500'} size={24} />
                        </div>
                        <Badge className={`${
                          settings.enableReportsModule 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}>
                          {settings.enableReportsModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className={`font-semibold text-lg mb-1 ${settings.enableReportsModule ? 'text-white' : 'text-gray-400'}`}>
                        Reports & Analytics
                      </div>
                      <div className="text-xs text-gray-500">
                        Business insights and reports
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Check className="text-emerald-400 mt-0.5" size={20} />
                      <div>
                        <div className="text-emerald-400 font-semibold">Module Status Summary</div>
                        <div className="text-xs text-emerald-300/80 mt-1">
                          {[
                            settings.enablePOSModule,
                            settings.enableInventoryModule,
                            settings.enableRentalModule,
                            settings.enableStudioModule,
                            settings.enableAccountingModule,
                            settings.enableExpensesModule,
                            settings.enableReportsModule
                          ].filter(Boolean).length} of 7 modules are currently active
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Theme Settings */}
              {activeTab === 'theme' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Palette className="text-purple-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Theme & Appearance</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-gray-400 mb-3 block">Primary Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) => handleChange('primaryColor', e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 border-gray-700 cursor-pointer"
                        />
                        <div>
                          <div className="text-white font-semibold">{settings.primaryColor}</div>
                          <div className="text-xs text-gray-500">Main accent color</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-3 block">Secondary Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.secondaryColor}
                          onChange={(e) => handleChange('secondaryColor', e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 border-gray-700 cursor-pointer"
                        />
                        <div>
                          <div className="text-white font-semibold">{settings.secondaryColor}</div>
                          <div className="text-xs text-gray-500">Supporting color</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-3 block">Accent Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.accentColor}
                          onChange={(e) => handleChange('accentColor', e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 border-gray-700 cursor-pointer"
                        />
                        <div>
                          <div className="text-white font-semibold">{settings.accentColor}</div>
                          <div className="text-xs text-gray-500">Highlight color</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-3 block">Logo URL</Label>
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={settings.logoUrl}
                        onChange={(e) => handleChange('logoUrl', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-3 block">Sidebar Position</Label>
                      <select
                        value={settings.sidebarPosition}
                        onChange={(e) => handleChange('sidebarPosition', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="text-white font-medium">Dark Mode</div>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Recommended</Badge>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.darkMode}
                        onChange={(e) => handleChange('darkMode', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="text-white font-medium">Compact Mode</div>
                        <div className="text-xs text-gray-500">Reduce spacing for more content</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.compactMode}
                        onChange={(e) => handleChange('compactMode', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="text-white font-medium">Show Breadcrumbs</div>
                        <div className="text-xs text-gray-500">Navigation path at top</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showBreadcrumbs}
                        onChange={(e) => handleChange('showBreadcrumbs', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="text-white font-medium">Enable Animations</div>
                        <div className="text-xs text-gray-500">Smooth transitions & effects</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.animationsEnabled}
                        onChange={(e) => handleChange('animationsEnabled', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Invoice Settings */}
              {activeTab === 'invoice' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <FileText className="text-green-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Invoice Configuration</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Invoice Prefix</Label>
                      <Input
                        placeholder="INV"
                        value={settings.invoicePrefix}
                        onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">Example: INV-2026-0001</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Number Format</Label>
                      <select
                        value={settings.invoiceNumberFormat}
                        onChange={(e) => handleChange('invoiceNumberFormat', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="YYYY-NNNN">YYYY-NNNN (2026-0001)</option>
                        <option value="NNNN">NNNN (0001)</option>
                        <option value="YYMM-NNN">YYMM-NNN (2601-001)</option>
                        <option value="YYYYMMDD-NN">YYYYMMDD-NN (20260105-01)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Starting Number</Label>
                      <Input
                        type="number"
                        value={settings.invoiceStartNumber}
                        onChange={(e) => handleChange('invoiceStartNumber', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Template Style</Label>
                      <select
                        value={settings.invoiceTemplate}
                        onChange={(e) => handleChange('invoiceTemplate', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="modern">Modern</option>
                        <option value="classic">Classic</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Logo Position</Label>
                      <select
                        value={settings.invoiceLogoPosition}
                        onChange={(e) => handleChange('invoiceLogoPosition', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Payment Due (Days)</Label>
                      <Input
                        type="number"
                        value={settings.invoiceDueDays}
                        onChange={(e) => handleChange('invoiceDueDays', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-gray-400 mb-2 block">Watermark Text (Optional)</Label>
                      <Input
                        placeholder="PAID, DRAFT, etc."
                        value={settings.invoiceWatermark}
                        onChange={(e) => handleChange('invoiceWatermark', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-gray-400 mb-2 block">Invoice Terms & Conditions</Label>
                      <Textarea
                        value={settings.invoiceTerms}
                        onChange={(e) => handleChange('invoiceTerms', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-gray-400 mb-2 block">Invoice Footer Text</Label>
                      <Input
                        value={settings.invoiceFooter}
                        onChange={(e) => handleChange('invoiceFooter', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Show Tax on Invoice</span>
                      <input
                        type="checkbox"
                        checked={settings.showTaxOnInvoice}
                        onChange={(e) => handleChange('showTaxOnInvoice', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Show Discount on Invoice</span>
                      <input
                        type="checkbox"
                        checked={settings.showDiscountOnInvoice}
                        onChange={(e) => handleChange('showDiscountOnInvoice', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Product Settings */}
              {activeTab === 'product' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Package className="text-orange-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Product Configuration</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">SKU Format</Label>
                      <Input
                        placeholder="PRD-NNNN"
                        value={settings.skuFormat}
                        onChange={(e) => handleChange('skuFormat', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">Use NNNN for numbers</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Product Code Prefix</Label>
                      <Input
                        placeholder="PRD"
                        value={settings.productCodePrefix}
                        onChange={(e) => handleChange('productCodePrefix', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Low Stock Threshold</Label>
                      <Input
                        type="number"
                        value={settings.lowStockThreshold}
                        onChange={(e) => handleChange('lowStockThreshold', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Barcode Format</Label>
                      <select
                        value={settings.barcodeFormat}
                        onChange={(e) => handleChange('barcodeFormat', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="CODE128">CODE128</option>
                        <option value="EAN13">EAN13</option>
                        <option value="QR">QR Code</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Default Product Unit</Label>
                      <select
                        value={settings.defaultProductUnit}
                        onChange={(e) => handleChange('defaultProductUnit', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="piece">Piece</option>
                        <option value="meter">Meter</option>
                        <option value="kg">Kilogram</option>
                        <option value="liter">Liter</option>
                        <option value="box">Box</option>
                        <option value="set">Set</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Max Product Images</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.maxProductImages}
                        onChange={(e) => handleChange('maxProductImages', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Auto-Generate SKU</span>
                      <input
                        type="checkbox"
                        checked={settings.skuAutoGenerate}
                        onChange={(e) => handleChange('skuAutoGenerate', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Barcode System</span>
                      <input
                        type="checkbox"
                        checked={settings.enableBarcode}
                        onChange={(e) => handleChange('enableBarcode', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Product Variants</span>
                      <input
                        type="checkbox"
                        checked={settings.enableProductVariants}
                        onChange={(e) => handleChange('enableProductVariants', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Product Expiry Tracking</span>
                      <input
                        type="checkbox"
                        checked={settings.enableProductExpiry}
                        onChange={(e) => handleChange('enableProductExpiry', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Product Images</span>
                      <input
                        type="checkbox"
                        checked={settings.enableProductImages}
                        onChange={(e) => handleChange('enableProductImages', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Track Serial Numbers</span>
                      <input
                        type="checkbox"
                        checked={settings.trackSerialNumbers}
                        onChange={(e) => handleChange('trackSerialNumbers', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Batch Tracking</span>
                      <input
                        type="checkbox"
                        checked={settings.enableBatchTracking}
                        onChange={(e) => handleChange('enableBatchTracking', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>

                  {/* Inventory Settings Section */}
                  <div className="pt-6 border-t border-gray-800 mt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Package className="text-orange-400" size={20} />
                      <h3 className="text-lg font-bold text-white">Inventory Settings</h3>
                    </div>
                    
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="text-blue-400 mt-0.5" size={20} />
                        <div>
                          <div className="text-blue-400 font-semibold">Enable Packing (Boxes/Pieces)</div>
                          <div className="text-xs text-blue-300/80 mt-1">
                            When ON: Packing columns (Boxes/Pieces) visible in Sale, Purchase, Inventory, Ledger, Print/PDF
                            <br />
                            When OFF: Packing completely hidden system-wide - only Qty shown
                          </div>
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer border-2 border-blue-500/30">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-white font-semibold">Enable Packing System</div>
                          <div className="text-xs text-gray-400 mt-1">
                            Global toggle: Controls boxes/pieces visibility everywhere
                          </div>
                        </div>
                        <Badge className={settingsContext.inventorySettings.enablePacking ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}>
                          {settingsContext.inventorySettings.enablePacking ? "ON" : "OFF"}
                        </Badge>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsContext.inventorySettings.enablePacking}
                        onChange={async (e) => {
                          await settingsContext.updateInventorySettings({ enablePacking: e.target.checked });
                          setHasChanges(true);
                        }}
                        className="w-6 h-6 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Sales Settings */}
              {activeTab === 'sales' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <ShoppingCart className="text-pink-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Sales Configuration</h2>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-purple-400 mt-0.5" size={20} />
                      <div>
                        <div className="text-purple-400 font-semibold">Important: Duplicate Item Behavior</div>
                        <div className="text-xs text-purple-300/80 mt-1">
                          Choose how the system handles when the same item is added multiple times to a sale
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Default Tax Rate (%)</Label>
                      <Input
                        type="number"
                        value={settings.defaultTaxRate}
                        onChange={(e) => handleChange('defaultTaxRate', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Max Discount Allowed (%)</Label>
                      <Input
                        type="number"
                        value={settings.maxDiscountPercent}
                        onChange={(e) => handleChange('maxDiscountPercent', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Default Payment Method</Label>
                      <select
                        value={settings.defaultPaymentMethod}
                        onChange={(e) => handleChange('defaultPaymentMethod', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="online">Online Payment</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Duplicate Item Behavior ⭐</Label>
                      <select
                        value={settings.duplicateItemBehavior}
                        onChange={(e) => handleChange('duplicateItemBehavior', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-purple-600 rounded-lg text-white ring-2 ring-purple-500/30"
                      >
                        <option value="increase_quantity">Increase Quantity (Merge)</option>
                        <option value="add_new_row">Add New Row (Separate)</option>
                      </select>
                      <div className="text-xs text-purple-400 mt-1">
                        {settings.duplicateItemBehavior === 'increase_quantity' 
                          ? '✓ Same item will increase quantity in existing row' 
                          : '✓ Same item will be added as a new separate row'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Auto-Save Interval (seconds)</Label>
                      <Input
                        type="number"
                        min="10"
                        max="300"
                        value={settings.autoSaveInterval}
                        onChange={(e) => handleChange('autoSaveInterval', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Minimum Sale Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.minimumSaleAmount}
                        onChange={(e) => handleChange('minimumSaleAmount', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Customer Credit Limit</Label>
                      <Input
                        type="number"
                        value={settings.creditLimit}
                        onChange={(e) => handleChange('creditLimit', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Loyalty Points Per Currency</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.pointsPerCurrency}
                        onChange={(e) => handleChange('pointsPerCurrency', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Return Days Limit</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={settings.returnDaysLimit}
                        onChange={(e) => handleChange('returnDaysLimit', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Multiple Tax Rates</span>
                      <input
                        type="checkbox"
                        checked={settings.enableMultipleTax}
                        onChange={(e) => handleChange('enableMultipleTax', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Require Customer for Sale</span>
                      <input
                        type="checkbox"
                        checked={settings.requireCustomerForSale}
                        onChange={(e) => handleChange('requireCustomerForSale', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Layaway/Installment</span>
                      <input
                        type="checkbox"
                        checked={settings.enableLayaway}
                        onChange={(e) => handleChange('enableLayaway', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Allow Negative Stock</span>
                      <input
                        type="checkbox"
                        checked={settings.allowNegativeStock}
                        onChange={(e) => handleChange('allowNegativeStock', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Auto-Print Receipt</span>
                      <input
                        type="checkbox"
                        checked={settings.printReceiptAutomatically}
                        onChange={(e) => handleChange('printReceiptAutomatically', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Quick Sale Mode</span>
                      <input
                        type="checkbox"
                        checked={settings.enableQuickSale}
                        onChange={(e) => handleChange('enableQuickSale', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Show Stock in Sale</span>
                      <input
                        type="checkbox"
                        checked={settings.showStockInSale}
                        onChange={(e) => handleChange('showStockInSale', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Require Sale Approval</span>
                      <input
                        type="checkbox"
                        checked={settings.requireSaleApproval}
                        onChange={(e) => handleChange('requireSaleApproval', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Customer Credit</span>
                      <input
                        type="checkbox"
                        checked={settings.enableCustomerCredit}
                        onChange={(e) => handleChange('enableCustomerCredit', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Loyalty Points System</span>
                      <input
                        type="checkbox"
                        checked={settings.enableLoyaltyPoints}
                        onChange={(e) => handleChange('enableLoyaltyPoints', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Sale Returns</span>
                      <input
                        type="checkbox"
                        checked={settings.enableSaleReturns}
                        onChange={(e) => handleChange('enableSaleReturns', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Purchase Settings */}
              {activeTab === 'purchase' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Truck className="text-indigo-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Purchase Configuration</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Purchase Order Prefix</Label>
                      <Input
                        value={settings.purchaseOrderPrefix}
                        onChange={(e) => handleChange('purchaseOrderPrefix', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Default Purchase Tax (%)</Label>
                      <Input
                        type="number"
                        value={settings.defaultPurchaseTax}
                        onChange={(e) => handleChange('defaultPurchaseTax', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Approval Required Amount</Label>
                      <Input
                        type="number"
                        value={settings.purchaseApprovalAmount}
                        onChange={(e) => handleChange('purchaseApprovalAmount', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">Purchases above this need approval</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">GRN Prefix</Label>
                      <Input
                        value={settings.grnPrefix}
                        onChange={(e) => handleChange('grnPrefix', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">Goods Received Note</div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Require Purchase Approval</span>
                      <input
                        type="checkbox"
                        checked={settings.requirePurchaseApproval}
                        onChange={(e) => handleChange('requirePurchaseApproval', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Purchase Returns</span>
                      <input
                        type="checkbox"
                        checked={settings.enablePurchaseReturn}
                        onChange={(e) => handleChange('enablePurchaseReturn', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Vendor Rating System</span>
                      <input
                        type="checkbox"
                        checked={settings.enableVendorRating}
                        onChange={(e) => handleChange('enableVendorRating', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable GRN (Goods Received Note)</span>
                      <input
                        type="checkbox"
                        checked={settings.enableGRN}
                        onChange={(e) => handleChange('enableGRN', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Quality Check</span>
                      <input
                        type="checkbox"
                        checked={settings.enableQualityCheck}
                        onChange={(e) => handleChange('enableQualityCheck', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Rental Settings */}
              {activeTab === 'rental' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Archive className="text-teal-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Rental Configuration</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Rental Prefix</Label>
                      <Input
                        value={settings.rentalPrefix}
                        onChange={(e) => handleChange('rentalPrefix', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Default Duration (days)</Label>
                      <Input
                        type="number"
                        value={settings.defaultRentalDuration}
                        onChange={(e) => handleChange('defaultRentalDuration', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Late Fee per Day</Label>
                      <Input
                        type="number"
                        value={settings.lateFeePerDay}
                        onChange={(e) => handleChange('lateFeePerDay', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Security Deposit (%)</Label>
                      <Input
                        type="number"
                        value={settings.securityDepositPercent}
                        onChange={(e) => handleChange('securityDepositPercent', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Reminder Days Before</Label>
                      <Input
                        type="number"
                        min="1"
                        max="7"
                        value={settings.reminderDaysBefore}
                        onChange={(e) => handleChange('reminderDaysBefore', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Return Reminders</span>
                      <input
                        type="checkbox"
                        checked={settings.enableRentalReminders}
                        onChange={(e) => handleChange('enableRentalReminders', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Damage Charges</span>
                      <input
                        type="checkbox"
                        checked={settings.enableDamageCharges}
                        onChange={(e) => handleChange('enableDamageCharges', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Damage Assessment Required</span>
                      <input
                        type="checkbox"
                        checked={settings.damageAssessmentRequired}
                        onChange={(e) => handleChange('damageAssessmentRequired', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Auto-Calculate Late Fee</span>
                      <input
                        type="checkbox"
                        checked={settings.autoCalculateLateFee}
                        onChange={(e) => handleChange('autoCalculateLateFee', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Reports Settings */}
              {activeTab === 'reports' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <PieChart className="text-yellow-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Reports Configuration</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Date Format</Label>
                      <select
                        value={settings.reportDateFormat}
                        onChange={(e) => handleChange('reportDateFormat', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Report Currency</Label>
                      <select
                        value={settings.reportCurrency}
                        onChange={(e) => handleChange('reportCurrency', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="PKR">PKR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Email Frequency</Label>
                      <select
                        value={settings.reportEmailFrequency}
                        onChange={(e) => handleChange('reportEmailFrequency', e.target.value as any)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Default Report Period</Label>
                      <select
                        value={settings.defaultReportPeriod}
                        onChange={(e) => handleChange('defaultReportPeriod', e.target.value as any)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="quarter">This Quarter</option>
                        <option value="year">This Year</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Auto Reports</span>
                      <input
                        type="checkbox"
                        checked={settings.enableAutoReports}
                        onChange={(e) => handleChange('enableAutoReports', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Include Graphs in Reports</span>
                      <input
                        type="checkbox"
                        checked={settings.includeGraphsInReports}
                        onChange={(e) => handleChange('includeGraphsInReports', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Export to PDF</span>
                      <input
                        type="checkbox"
                        checked={settings.enableExportPDF}
                        onChange={(e) => handleChange('enableExportPDF', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Export to Excel</span>
                      <input
                        type="checkbox"
                        checked={settings.enableExportExcel}
                        onChange={(e) => handleChange('enableExportExcel', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white">Enable Export to CSV</span>
                      <input
                        type="checkbox"
                        checked={settings.enableExportCSV}
                        onChange={(e) => handleChange('enableExportCSV', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Bell className="text-red-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Notification Settings</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Expiry Alert Days</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={settings.expiryAlertDays}
                        onChange={(e) => handleChange('expiryAlertDays', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <div className="text-xs text-gray-500 mt-1">Alert before product expires</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Email Notifications</div>
                        <div className="text-xs text-gray-500">Receive updates via email</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.emailNotifications}
                        onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">SMS Notifications</div>
                        <div className="text-xs text-gray-500">Receive updates via SMS</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.smsNotifications}
                        onChange={(e) => handleChange('smsNotifications', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Low Stock Alerts</div>
                        <div className="text-xs text-gray-500">Get notified when stock is low</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.lowStockAlert}
                        onChange={(e) => handleChange('lowStockAlert', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Payment Due Alerts</div>
                        <div className="text-xs text-gray-500">Reminders for pending payments</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.paymentDueAlert}
                        onChange={(e) => handleChange('paymentDueAlert', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Rental Return Alerts</div>
                        <div className="text-xs text-gray-500">Reminders for rental returns</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.rentalReturnAlert}
                        onChange={(e) => handleChange('rentalReturnAlert', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Product Expiry Alerts</div>
                        <div className="text-xs text-gray-500">Before product expiration</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.expiryAlert}
                        onChange={(e) => handleChange('expiryAlert', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Order Status Notifications</div>
                        <div className="text-xs text-gray-500">When order status changes</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.orderStatusNotification}
                        onChange={(e) => handleChange('orderStatusNotification', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Daily Sales Summary</div>
                        <div className="text-xs text-gray-500">End of day sales report</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.dailySalesSummary}
                        onChange={(e) => handleChange('dailySalesSummary', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="text-cyan-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Security Configuration</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">Session Timeout (minutes)</Label>
                      <Input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => handleChange('sessionTimeout', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Password Policy</Label>
                      <select
                        value={settings.passwordPolicy}
                        onChange={(e) => handleChange('passwordPolicy', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="weak">Weak (6+ characters)</option>
                        <option value="medium">Medium (8+ chars, mixed case)</option>
                        <option value="strong">Strong (12+ chars, symbols)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Max Login Attempts</Label>
                      <Input
                        type="number"
                        min="3"
                        max="10"
                        value={settings.maxLoginAttempts}
                        onChange={(e) => handleChange('maxLoginAttempts', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Lockout Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="5"
                        max="60"
                        value={settings.lockoutDuration}
                        onChange={(e) => handleChange('lockoutDuration', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-gray-400 mb-2 block">IP Whitelist (comma-separated)</Label>
                      <Textarea
                        placeholder="192.168.1.1, 192.168.1.2"
                        value={settings.ipWhitelist}
                        onChange={(e) => handleChange('ipWhitelist', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Two-Factor Authentication</div>
                        <div className="text-xs text-gray-500">Extra layer of security</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.twoFactorAuth}
                        onChange={(e) => handleChange('twoFactorAuth', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Enable Audit Log</div>
                        <div className="text-xs text-gray-500">Track all user actions</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableAuditLog}
                        onChange={(e) => handleChange('enableAuditLog', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Require Email Verification</div>
                        <div className="text-xs text-gray-500">For new user accounts</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.requireEmailVerification}
                        onChange={(e) => handleChange('requireEmailVerification', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Role-Based Access Control</div>
                        <div className="text-xs text-gray-500">Restrict features by user role</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableRoleBasedAccess}
                        onChange={(e) => handleChange('enableRoleBasedAccess', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* System Health (Admin/Owner only) */}
              {activeTab === 'systemHealth' && (
                <SystemHealthTab />
              )}

              {/* Advanced Settings */}
              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Database className="text-gray-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Advanced Configuration</h2>
                  </div>

                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-orange-400 mt-0.5" size={20} />
                      <div>
                        <div className="text-orange-400 font-semibold">Warning</div>
                        <div className="text-xs text-orange-300/80 mt-1">
                          These settings are for advanced users only. Incorrect configuration may affect system functionality.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-2 block">API Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter API key"
                        value={settings.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Webhook URL</Label>
                      <Input
                        placeholder="https://example.com/webhook"
                        value={settings.webhookUrl}
                        onChange={(e) => handleChange('webhookUrl', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Backup Frequency</Label>
                      <select
                        value={settings.backupFrequency}
                        onChange={(e) => handleChange('backupFrequency', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Default Location</Label>
                      <Input
                        placeholder="Main Store"
                        value={settings.defaultLocation}
                        onChange={(e) => handleChange('defaultLocation', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Cache Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1440"
                        value={settings.cacheDuration}
                        onChange={(e) => handleChange('cacheDuration', Number(e.target.value))}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Enable API Access</div>
                        <div className="text-xs text-gray-500">Allow external API integrations</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableAPI}
                        onChange={(e) => handleChange('enableAPI', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Automatic Backup</div>
                        <div className="text-xs text-gray-500">Auto-backup database</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableBackup}
                        onChange={(e) => handleChange('enableBackup', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Debug Mode</div>
                        <div className="text-xs text-gray-500">Show detailed error messages</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.debugMode}
                        onChange={(e) => handleChange('debugMode', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Multi-Location Support</div>
                        <div className="text-xs text-gray-500">Multiple branches/warehouses</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableMultiLocation}
                        onChange={(e) => handleChange('enableMultiLocation', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Multi-Currency Support</div>
                        <div className="text-xs text-gray-500">Handle multiple currencies</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableMultiCurrency}
                        onChange={(e) => handleChange('enableMultiCurrency', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Auto-Update Exchange Rate</div>
                        <div className="text-xs text-gray-500">Fetch latest currency rates</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.autoUpdateExchangeRate}
                        onChange={(e) => handleChange('autoUpdateExchangeRate', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer">
                      <div>
                        <div className="text-white font-medium">Enable Data Encryption</div>
                        <div className="text-xs text-gray-500">Encrypt sensitive data</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableDataEncryption}
                        onChange={(e) => handleChange('enableDataEncryption', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Footer */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 bg-purple-600 border-2 border-purple-500 rounded-xl p-4 shadow-2xl shadow-purple-500/20 z-50">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-white font-semibold">Unsaved Changes</div>
                <div className="text-xs text-purple-200">You have modified settings</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="bg-purple-700 border-purple-600 text-white hover:bg-purple-800"
                >
                  Discard
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-white text-purple-600 hover:bg-purple-50"
                >
                  <Check size={16} className="mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
