import React, { useState } from 'react';
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
  ToggleLeft
} from 'lucide-react';
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

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
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
    { id: 'advanced', label: 'Advanced', icon: Database, color: 'gray' }
  ];

  const handleChange = (field: keyof Settings, value: any) => {
    setSettings({ ...settings, [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    console.log('Saving settings:', settings);
    localStorage.setItem('erp_settings', JSON.stringify(settings));
    setHasChanges(false);
    alert('Settings saved successfully!');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className="text-3xl font-bold flex items-center gap-3"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <SettingsIcon 
                  size={32}
                  style={{ color: 'var(--color-wholesale)' }}
                />
                System Settings
              </h1>
              <p 
                className="mt-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Configure every aspect of your ERP system - from modules to minute details
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                }}
              >
                <RotateCcw size={16} className="mr-2" />
                Reset All
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges}
                style={{
                  backgroundColor: 'var(--color-wholesale)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = 'var(--color-wholesale-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                  }
                }}
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
                      className="w-full text-left p-3 rounded-lg border-2 transition-all"
                      style={{
                        backgroundColor: isActive ? 'rgba(147, 51, 234, 0.2)' : 'var(--color-bg-primary)',
                        borderColor: isActive ? 'var(--color-wholesale)' : 'var(--color-border-primary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-lg)',
                        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                        }
                      }}
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
            <div 
              className="border rounded-xl p-6"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Building2 
                      size={24}
                      style={{ color: 'var(--color-primary)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      General Business Settings
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Business Name *</Label>
                      <Input
                        value={settings.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Tax ID / NTN</Label>
                      <Input
                        value={settings.taxId}
                        onChange={(e) => handleChange('taxId', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Business Address</Label>
                      <Textarea
                        value={settings.businessAddress}
                        onChange={(e) => handleChange('businessAddress', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Phone Number</Label>
                      <Input
                        value={settings.businessPhone}
                        onChange={(e) => handleChange('businessPhone', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Email Address</Label>
                      <Input
                        type="email"
                        value={settings.businessEmail}
                        onChange={(e) => handleChange('businessEmail', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Website</Label>
                      <Input
                        value={settings.businessWebsite}
                        onChange={(e) => handleChange('businessWebsite', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Currency</Label>
                      <select
                        value={settings.currency}
                        onChange={(e) => handleChange('currency', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="PKR">PKR - Pakistani Rupee</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="AED">AED - UAE Dirham</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Timezone</Label>
                      <select
                        value={settings.timezone}
                        onChange={(e) => handleChange('timezone', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Language</Label>
                      <select
                        value={settings.language}
                        onChange={(e) => handleChange('language', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="en">English</option>
                        <option value="ur">Urdu</option>
                        <option value="ar">Arabic</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Fiscal Year Start (MM-DD)</Label>
                      <Input
                        value={settings.fiscalYearStart}
                        onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
                        placeholder="01-01"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Start of financial year</div>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Fiscal Year End (MM-DD)</Label>
                      <Input
                        value={settings.fiscalYearEnd}
                        onChange={(e) => handleChange('fiscalYearEnd', e.target.value)}
                        placeholder="12-31"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >End of financial year</div>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Date Format</Label>
                      <select
                        value={settings.dateFormat}
                        onChange={(e) => handleChange('dateFormat', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Time Format</Label>
                      <select
                        value={settings.timeFormat}
                        onChange={(e) => handleChange('timeFormat', e.target.value as '12h' | '24h')}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="12h">12 Hour (AM/PM)</option>
                        <option value="24h">24 Hour</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Decimal Places</Label>
                      <Input
                        type="number"
                        min="0"
                        max="4"
                        value={settings.decimalPlaces}
                        onChange={(e) => handleChange('decimalPlaces', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >For amounts (0-4)</div>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Thousand Separator</Label>
                      <select
                        value={settings.thousandSeparator}
                        onChange={(e) => handleChange('thousandSeparator', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
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
                    <Layers 
                      size={24}
                      style={{ color: 'var(--color-success)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Module Management
                    </h2>
                  </div>

                  <div 
                    className="border rounded-lg p-4 mb-6"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.1)', // bg-blue-500/10
                      borderColor: 'rgba(59, 130, 246, 0.3)', // border-blue-500/30
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle 
                        className="mt-0.5" 
                        size={20}
                        style={{ color: 'var(--color-primary)' }}
                      />
                      <div>
                        <div 
                          className="font-semibold"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          Module Control Center
                        </div>
                        <div 
                          className="text-xs mt-1"
                          style={{ color: 'rgba(147, 197, 253, 0.8)' }} // text-blue-300/80
                        >
                          Enable or disable modules to customize your ERP system. Disabled modules won't appear in the sidebar.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* POS System */}
                    <div 
                      onClick={() => handleChange('enablePOSModule', !settings.enablePOSModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enablePOSModule 
                          ? 'rgba(147, 51, 234, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enablePOSModule 
                          ? 'var(--color-wholesale)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enablePOSModule 
                          ? 'var(--shadow-purple-glow)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enablePOSModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enablePOSModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enablePOSModule 
                              ? 'rgba(147, 51, 234, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <ShoppingCart 
                            size={24}
                            style={{ 
                              color: settings.enablePOSModule 
                                ? 'var(--color-wholesale)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enablePOSModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enablePOSModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enablePOSModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enablePOSModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enablePOSModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        POS System
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Point of Sale module for quick transactions
                      </div>
                    </div>

                    {/* Inventory Management */}
                    <div 
                      onClick={() => handleChange('enableInventoryModule', !settings.enableInventoryModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enableInventoryModule 
                          ? 'rgba(59, 130, 246, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enableInventoryModule 
                          ? 'var(--color-primary)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enableInventoryModule 
                          ? 'var(--shadow-blue-glow)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enableInventoryModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enableInventoryModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enableInventoryModule 
                              ? 'rgba(59, 130, 246, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <Package 
                            size={24}
                            style={{ 
                              color: settings.enableInventoryModule 
                                ? 'var(--color-primary)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enableInventoryModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enableInventoryModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enableInventoryModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enableInventoryModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enableInventoryModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        Inventory Management
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Complete stock and warehouse management
                      </div>
                    </div>

                    {/* Rental Management */}
                    <div 
                      onClick={() => handleChange('enableRentalModule', !settings.enableRentalModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enableRentalModule 
                          ? 'rgba(20, 184, 166, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enableRentalModule 
                          ? 'rgba(20, 184, 166, 1)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enableRentalModule 
                          ? '0 10px 40px rgba(20, 184, 166, 0.2)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enableRentalModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enableRentalModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enableRentalModule 
                              ? 'rgba(20, 184, 166, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <Archive 
                            size={24}
                            style={{ 
                              color: settings.enableRentalModule 
                                ? 'rgba(20, 184, 166, 1)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enableRentalModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enableRentalModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enableRentalModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enableRentalModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enableRentalModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        Rental Management
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Manage rental items and bookings
                      </div>
                    </div>

                    {/* Customize Studio */}
                    <div 
                      onClick={() => handleChange('enableCustomizeModule', !settings.enableCustomizeModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enableCustomizeModule 
                          ? 'rgba(236, 72, 153, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enableCustomizeModule 
                          ? 'rgba(236, 72, 153, 1)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enableCustomizeModule 
                          ? '0 10px 40px rgba(236, 72, 153, 0.2)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enableCustomizeModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enableCustomizeModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enableCustomizeModule 
                              ? 'rgba(236, 72, 153, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <Palette 
                            size={24}
                            style={{ 
                              color: settings.enableCustomizeModule 
                                ? 'rgba(236, 72, 153, 1)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enableCustomizeModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enableCustomizeModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enableCustomizeModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enableCustomizeModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enableCustomizeModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        Customize Studio
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Custom fabric workflow management
                      </div>
                    </div>

                    {/* Studio Production */}
                    <div 
                      onClick={() => handleChange('enableStudioModule', !settings.enableStudioModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enableStudioModule 
                          ? 'rgba(249, 115, 22, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enableStudioModule 
                          ? 'var(--color-warning)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enableStudioModule 
                          ? '0 10px 40px rgba(249, 115, 22, 0.2)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enableStudioModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enableStudioModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enableStudioModule 
                              ? 'rgba(249, 115, 22, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <Building2 
                            size={24}
                            style={{ 
                              color: settings.enableStudioModule 
                                ? 'var(--color-warning)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enableStudioModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enableStudioModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enableStudioModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enableStudioModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enableStudioModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        Studio Production
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Full production workflow with departments
                      </div>
                    </div>

                    {/* Accounting */}
                    <div 
                      onClick={() => handleChange('enableAccountingModule', !settings.enableAccountingModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enableAccountingModule 
                          ? 'rgba(34, 197, 94, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enableAccountingModule 
                          ? 'var(--color-success)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enableAccountingModule 
                          ? '0 10px 40px rgba(34, 197, 94, 0.2)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enableAccountingModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enableAccountingModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enableAccountingModule 
                              ? 'rgba(34, 197, 94, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <DollarSign 
                            size={24}
                            style={{ 
                              color: settings.enableAccountingModule 
                                ? 'var(--color-success)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enableAccountingModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enableAccountingModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enableAccountingModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enableAccountingModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enableAccountingModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        Accounting
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Financial accounts and ledgers
                      </div>
                    </div>

                    {/* Expenses Management */}
                    <div 
                      onClick={() => handleChange('enableExpensesModule', !settings.enableExpensesModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enableExpensesModule 
                          ? 'rgba(239, 68, 68, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enableExpensesModule 
                          ? 'var(--color-error)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enableExpensesModule 
                          ? '0 10px 40px rgba(239, 68, 68, 0.2)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enableExpensesModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enableExpensesModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enableExpensesModule 
                              ? 'rgba(239, 68, 68, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <Receipt 
                            size={24}
                            style={{ 
                              color: settings.enableExpensesModule 
                                ? 'var(--color-error)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enableExpensesModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enableExpensesModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enableExpensesModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enableExpensesModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enableExpensesModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        Expenses Management
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Track and manage business expenses
                      </div>
                    </div>

                    {/* Reports & Analytics */}
                    <div 
                      onClick={() => handleChange('enableReportsModule', !settings.enableReportsModule)}
                      className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: settings.enableReportsModule 
                          ? 'rgba(234, 179, 8, 0.1)' 
                          : 'rgba(31, 41, 55, 0.5)',
                        borderColor: settings.enableReportsModule 
                          ? 'rgba(234, 179, 8, 1)' 
                          : 'var(--color-border-secondary)',
                        borderWidth: '2px',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: settings.enableReportsModule 
                          ? '0 10px 40px rgba(234, 179, 8, 0.2)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!settings.enableReportsModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!settings.enableReportsModule) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: settings.enableReportsModule 
                              ? 'rgba(234, 179, 8, 0.2)' 
                              : 'rgba(55, 65, 81, 0.5)',
                            borderRadius: 'var(--radius-xl)'
                          }}
                        >
                          <PieChart 
                            size={24}
                            style={{ 
                              color: settings.enableReportsModule 
                                ? 'rgba(234, 179, 8, 1)' 
                                : 'var(--color-text-tertiary)' 
                            }}
                          />
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: settings.enableReportsModule 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'var(--color-hover-bg)',
                            color: settings.enableReportsModule 
                              ? 'var(--color-success)' 
                              : 'var(--color-text-secondary)',
                            borderColor: settings.enableReportsModule 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : 'var(--color-border-secondary)'
                          }}
                        >
                          {settings.enableReportsModule ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div 
                        className="font-semibold text-lg mb-1"
                        style={{ 
                          color: settings.enableReportsModule 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)' 
                        }}
                      >
                        Reports & Analytics
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Business insights and reports
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Check 
                        className="mt-0.5" 
                        size={20}
                        style={{ color: 'var(--color-success)' }}
                      />
                      <div>
                        <div 
                          className="font-semibold"
                          style={{ color: 'var(--color-success)' }}
                        >
                          Module Status Summary
                        </div>
                        <div 
                          className="text-xs mt-1"
                          style={{ color: 'rgba(110, 231, 183, 0.8)' }}
                        >
                          {[
                            settings.enablePOSModule,
                            settings.enableInventoryModule,
                            settings.enableRentalModule,
                            settings.enableCustomizeModule,
                            settings.enableStudioModule,
                            settings.enableAccountingModule,
                            settings.enableExpensesModule,
                            settings.enableReportsModule
                          ].filter(Boolean).length} of 8 modules are currently active
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
                    <Palette 
                      size={24}
                      style={{ color: 'var(--color-wholesale)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Theme & Appearance
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label 
                        className="mb-3 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Primary Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) => handleChange('primaryColor', e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 cursor-pointer"
                          style={{
                            borderColor: 'var(--color-border-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            borderWidth: '2px'
                          }}
                        />
                        <div>
                          <div 
                            className="font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {settings.primaryColor}
                          </div>
                          <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Main accent color</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label 
                        className="mb-3 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Secondary Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.secondaryColor}
                          onChange={(e) => handleChange('secondaryColor', e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 cursor-pointer"
                          style={{
                            borderColor: 'var(--color-border-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            borderWidth: '2px'
                          }}
                        />
                        <div>
                          <div 
                            className="font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {settings.secondaryColor}
                          </div>
                          <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Supporting color</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label 
                        className="mb-3 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Accent Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.accentColor}
                          onChange={(e) => handleChange('accentColor', e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 cursor-pointer"
                          style={{
                            borderColor: 'var(--color-border-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            borderWidth: '2px'
                          }}
                        />
                        <div>
                          <div 
                            className="font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {settings.accentColor}
                          </div>
                          <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Highlight color</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label 
                        className="mb-3 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Logo URL</Label>
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={settings.logoUrl}
                        onChange={(e) => handleChange('logoUrl', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-3 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Sidebar Position</Label>
                      <select
                        value={settings.sidebarPosition}
                        onChange={(e) => handleChange('sidebarPosition', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Dark Mode
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: 'var(--color-primary)',
                            borderColor: 'rgba(59, 130, 246, 0.3)'
                          }}
                        >
                          Recommended
                        </Badge>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.darkMode}
                        onChange={(e) => handleChange('darkMode', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Compact Mode
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Reduce spacing for more content</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.compactMode}
                        onChange={(e) => handleChange('compactMode', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Show Breadcrumbs
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Navigation path at top</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showBreadcrumbs}
                        onChange={(e) => handleChange('showBreadcrumbs', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Enable Animations
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Smooth transitions & effects</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.animationsEnabled}
                        onChange={(e) => handleChange('animationsEnabled', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Invoice Settings */}
              {activeTab === 'invoice' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <FileText 
                      size={24}
                      style={{ color: 'var(--color-success)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Invoice Configuration
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Invoice Prefix</Label>
                      <Input
                        placeholder="INV"
                        value={settings.invoicePrefix}
                        onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Example: INV-2026-0001</div>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Number Format</Label>
                      <select
                        value={settings.invoiceNumberFormat}
                        onChange={(e) => handleChange('invoiceNumberFormat', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="YYYY-NNNN">YYYY-NNNN (2026-0001)</option>
                        <option value="NNNN">NNNN (0001)</option>
                        <option value="YYMM-NNN">YYMM-NNN (2601-001)</option>
                        <option value="YYYYMMDD-NN">YYYYMMDD-NN (20260105-01)</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Starting Number</Label>
                      <Input
                        type="number"
                        value={settings.invoiceStartNumber}
                        onChange={(e) => handleChange('invoiceStartNumber', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Template Style</Label>
                      <select
                        value={settings.invoiceTemplate}
                        onChange={(e) => handleChange('invoiceTemplate', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="modern">Modern</option>
                        <option value="classic">Classic</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Logo Position</Label>
                      <select
                        value={settings.invoiceLogoPosition}
                        onChange={(e) => handleChange('invoiceLogoPosition', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Payment Due (Days)</Label>
                      <Input
                        type="number"
                        value={settings.invoiceDueDays}
                        onChange={(e) => handleChange('invoiceDueDays', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Watermark Text (Optional)</Label>
                      <Input
                        placeholder="PAID, DRAFT, etc."
                        value={settings.invoiceWatermark}
                        onChange={(e) => handleChange('invoiceWatermark', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Invoice Terms & Conditions</Label>
                      <Textarea
                        value={settings.invoiceTerms}
                        onChange={(e) => handleChange('invoiceTerms', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Invoice Footer Text</Label>
                      <Input
                        value={settings.invoiceFooter}
                        onChange={(e) => handleChange('invoiceFooter', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        Show Tax on Invoice
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.showTaxOnInvoice}
                        onChange={(e) => handleChange('showTaxOnInvoice', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        Show Discount on Invoice
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.showDiscountOnInvoice}
                        onChange={(e) => handleChange('showDiscountOnInvoice', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
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
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Product Configuration
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >SKU Format</Label>
                      <Input
                        placeholder="PRD-NNNN"
                        value={settings.skuFormat}
                        onChange={(e) => handleChange('skuFormat', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Use NNNN for numbers</div>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Product Code Prefix</Label>
                      <Input
                        placeholder="PRD"
                        value={settings.productCodePrefix}
                        onChange={(e) => handleChange('productCodePrefix', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Low Stock Threshold</Label>
                      <Input
                        type="number"
                        value={settings.lowStockThreshold}
                        onChange={(e) => handleChange('lowStockThreshold', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Barcode Format</Label>
                      <select
                        value={settings.barcodeFormat}
                        onChange={(e) => handleChange('barcodeFormat', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="CODE128">CODE128</option>
                        <option value="EAN13">EAN13</option>
                        <option value="QR">QR Code</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Default Product Unit</Label>
                      <select
                        value={settings.defaultProductUnit}
                        onChange={(e) => handleChange('defaultProductUnit', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
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
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Max Product Images</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.maxProductImages}
                        onChange={(e) => handleChange('maxProductImages', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        Auto-Generate SKU
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.skuAutoGenerate}
                        onChange={(e) => handleChange('skuAutoGenerate', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        Enable Barcode System
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.enableBarcode}
                        onChange={(e) => handleChange('enableBarcode', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Product Variants</span>
                      <input
                        type="checkbox"
                        checked={settings.enableProductVariants}
                        onChange={(e) => handleChange('enableProductVariants', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Product Expiry Tracking</span>
                      <input
                        type="checkbox"
                        checked={settings.enableProductExpiry}
                        onChange={(e) => handleChange('enableProductExpiry', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Product Images</span>
                      <input
                        type="checkbox"
                        checked={settings.enableProductImages}
                        onChange={(e) => handleChange('enableProductImages', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Track Serial Numbers</span>
                      <input
                        type="checkbox"
                        checked={settings.trackSerialNumbers}
                        onChange={(e) => handleChange('trackSerialNumbers', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Batch Tracking</span>
                      <input
                        type="checkbox"
                        checked={settings.enableBatchTracking}
                        onChange={(e) => handleChange('enableBatchTracking', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Sales Settings */}
              {activeTab === 'sales' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <ShoppingCart 
                      size={24}
                      style={{ color: 'rgba(236, 72, 153, 1)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Sales Configuration
                    </h2>
                  </div>

                  <div 
                    className="border rounded-lg p-4 mb-4"
                    style={{
                      backgroundColor: 'rgba(147, 51, 234, 0.1)',
                      borderColor: 'rgba(147, 51, 234, 0.3)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle 
                        className="mt-0.5" 
                        size={20}
                        style={{ color: 'var(--color-wholesale)' }}
                      />
                      <div>
                        <div 
                          className="font-semibold"
                          style={{ color: 'var(--color-wholesale)' }}
                        >
                          Important: Duplicate Item Behavior
                        </div>
                        <div 
                          className="text-xs mt-1"
                          style={{ color: 'rgba(196, 181, 253, 0.8)' }}
                        >
                          Choose how the system handles when the same item is added multiple times to a sale
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Default Tax Rate (%)</Label>
                      <Input
                        type="number"
                        value={settings.defaultTaxRate}
                        onChange={(e) => handleChange('defaultTaxRate', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Max Discount Allowed (%)</Label>
                      <Input
                        type="number"
                        value={settings.maxDiscountPercent}
                        onChange={(e) => handleChange('maxDiscountPercent', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Default Payment Method</Label>
                      <select
                        value={settings.defaultPaymentMethod}
                        onChange={(e) => handleChange('defaultPaymentMethod', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="online">Online Payment</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Duplicate Item Behavior ⭐</Label>
                      <select
                        value={settings.duplicateItemBehavior}
                        onChange={(e) => handleChange('duplicateItemBehavior', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg ring-2"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-wholesale)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)',
                          '--tw-ring-color': 'rgba(147, 51, 234, 0.3)'
                        }}
                      >
                        <option value="increase_quantity">Increase Quantity (Merge)</option>
                        <option value="add_new_row">Add New Row (Separate)</option>
                      </select>
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-wholesale)' }}
                      >
                        {settings.duplicateItemBehavior === 'increase_quantity' 
                          ? '✓ Same item will increase quantity in existing row' 
                          : '✓ Same item will be added as a new separate row'}
                      </div>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Auto-Save Interval (seconds)</Label>
                      <Input
                        type="number"
                        min="10"
                        max="300"
                        value={settings.autoSaveInterval}
                        onChange={(e) => handleChange('autoSaveInterval', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Minimum Sale Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.minimumSaleAmount}
                        onChange={(e) => handleChange('minimumSaleAmount', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Customer Credit Limit</Label>
                      <Input
                        type="number"
                        value={settings.creditLimit}
                        onChange={(e) => handleChange('creditLimit', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Loyalty Points Per Currency</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.pointsPerCurrency}
                        onChange={(e) => handleChange('pointsPerCurrency', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Return Days Limit</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={settings.returnDaysLimit}
                        onChange={(e) => handleChange('returnDaysLimit', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Multiple Tax Rates</span>
                      <input
                        type="checkbox"
                        checked={settings.enableMultipleTax}
                        onChange={(e) => handleChange('enableMultipleTax', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Require Customer for Sale</span>
                      <input
                        type="checkbox"
                        checked={settings.requireCustomerForSale}
                        onChange={(e) => handleChange('requireCustomerForSale', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Layaway/Installment</span>
                      <input
                        type="checkbox"
                        checked={settings.enableLayaway}
                        onChange={(e) => handleChange('enableLayaway', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Allow Negative Stock</span>
                      <input
                        type="checkbox"
                        checked={settings.allowNegativeStock}
                        onChange={(e) => handleChange('allowNegativeStock', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Auto-Print Receipt</span>
                      <input
                        type="checkbox"
                        checked={settings.printReceiptAutomatically}
                        onChange={(e) => handleChange('printReceiptAutomatically', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Quick Sale Mode</span>
                      <input
                        type="checkbox"
                        checked={settings.enableQuickSale}
                        onChange={(e) => handleChange('enableQuickSale', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Show Stock in Sale</span>
                      <input
                        type="checkbox"
                        checked={settings.showStockInSale}
                        onChange={(e) => handleChange('showStockInSale', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Require Sale Approval</span>
                      <input
                        type="checkbox"
                        checked={settings.requireSaleApproval}
                        onChange={(e) => handleChange('requireSaleApproval', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Customer Credit</span>
                      <input
                        type="checkbox"
                        checked={settings.enableCustomerCredit}
                        onChange={(e) => handleChange('enableCustomerCredit', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Loyalty Points System</span>
                      <input
                        type="checkbox"
                        checked={settings.enableLoyaltyPoints}
                        onChange={(e) => handleChange('enableLoyaltyPoints', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Sale Returns</span>
                      <input
                        type="checkbox"
                        checked={settings.enableSaleReturns}
                        onChange={(e) => handleChange('enableSaleReturns', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Purchase Settings */}
              {activeTab === 'purchase' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Truck 
                      size={24}
                      style={{ color: 'rgba(99, 102, 241, 1)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Purchase Configuration
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Purchase Order Prefix</Label>
                      <Input
                        value={settings.purchaseOrderPrefix}
                        onChange={(e) => handleChange('purchaseOrderPrefix', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Default Purchase Tax (%)</Label>
                      <Input
                        type="number"
                        value={settings.defaultPurchaseTax}
                        onChange={(e) => handleChange('defaultPurchaseTax', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Approval Required Amount</Label>
                      <Input
                        type="number"
                        value={settings.purchaseApprovalAmount}
                        onChange={(e) => handleChange('purchaseApprovalAmount', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Purchases above this need approval</div>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >GRN Prefix</Label>
                      <Input
                        value={settings.grnPrefix}
                        onChange={(e) => handleChange('grnPrefix', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Goods Received Note</div>
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Require Purchase Approval</span>
                      <input
                        type="checkbox"
                        checked={settings.requirePurchaseApproval}
                        onChange={(e) => handleChange('requirePurchaseApproval', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Purchase Returns</span>
                      <input
                        type="checkbox"
                        checked={settings.enablePurchaseReturn}
                        onChange={(e) => handleChange('enablePurchaseReturn', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Vendor Rating System</span>
                      <input
                        type="checkbox"
                        checked={settings.enableVendorRating}
                        onChange={(e) => handleChange('enableVendorRating', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable GRN (Goods Received Note)</span>
                      <input
                        type="checkbox"
                        checked={settings.enableGRN}
                        onChange={(e) => handleChange('enableGRN', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Quality Check</span>
                      <input
                        type="checkbox"
                        checked={settings.enableQualityCheck}
                        onChange={(e) => handleChange('enableQualityCheck', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Rental Settings */}
              {activeTab === 'rental' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Archive 
                      size={24}
                      style={{ color: 'rgba(20, 184, 166, 1)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Rental Configuration
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Rental Prefix</Label>
                      <Input
                        value={settings.rentalPrefix}
                        onChange={(e) => handleChange('rentalPrefix', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Default Duration (days)</Label>
                      <Input
                        type="number"
                        value={settings.defaultRentalDuration}
                        onChange={(e) => handleChange('defaultRentalDuration', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Late Fee per Day</Label>
                      <Input
                        type="number"
                        value={settings.lateFeePerDay}
                        onChange={(e) => handleChange('lateFeePerDay', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Security Deposit (%)</Label>
                      <Input
                        type="number"
                        value={settings.securityDepositPercent}
                        onChange={(e) => handleChange('securityDepositPercent', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Reminder Days Before</Label>
                      <Input
                        type="number"
                        min="1"
                        max="7"
                        value={settings.reminderDaysBefore}
                        onChange={(e) => handleChange('reminderDaysBefore', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Return Reminders</span>
                      <input
                        type="checkbox"
                        checked={settings.enableRentalReminders}
                        onChange={(e) => handleChange('enableRentalReminders', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Damage Charges</span>
                      <input
                        type="checkbox"
                        checked={settings.enableDamageCharges}
                        onChange={(e) => handleChange('enableDamageCharges', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Damage Assessment Required</span>
                      <input
                        type="checkbox"
                        checked={settings.damageAssessmentRequired}
                        onChange={(e) => handleChange('damageAssessmentRequired', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Auto-Calculate Late Fee</span>
                      <input
                        type="checkbox"
                        checked={settings.autoCalculateLateFee}
                        onChange={(e) => handleChange('autoCalculateLateFee', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Reports Settings */}
              {activeTab === 'reports' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <PieChart 
                      size={24}
                      style={{ color: 'rgba(234, 179, 8, 1)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Reports Configuration
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Date Format</Label>
                      <select
                        value={settings.reportDateFormat}
                        onChange={(e) => handleChange('reportDateFormat', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Report Currency</Label>
                      <select
                        value={settings.reportCurrency}
                        onChange={(e) => handleChange('reportCurrency', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="PKR">PKR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Email Frequency</Label>
                      <select
                        value={settings.reportEmailFrequency}
                        onChange={(e) => handleChange('reportEmailFrequency', e.target.value as any)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Default Report Period</Label>
                      <select
                        value={settings.defaultReportPeriod}
                        onChange={(e) => handleChange('defaultReportPeriod', e.target.value as any)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="quarter">This Quarter</option>
                        <option value="year">This Year</option>
                      </select>
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Auto Reports</span>
                      <input
                        type="checkbox"
                        checked={settings.enableAutoReports}
                        onChange={(e) => handleChange('enableAutoReports', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Include Graphs in Reports</span>
                      <input
                        type="checkbox"
                        checked={settings.includeGraphsInReports}
                        onChange={(e) => handleChange('includeGraphsInReports', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Export to PDF</span>
                      <input
                        type="checkbox"
                        checked={settings.enableExportPDF}
                        onChange={(e) => handleChange('enableExportPDF', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Export to Excel</span>
                      <input
                        type="checkbox"
                        checked={settings.enableExportExcel}
                        onChange={(e) => handleChange('enableExportExcel', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>Enable Export to CSV</span>
                      <input
                        type="checkbox"
                        checked={settings.enableExportCSV}
                        onChange={(e) => handleChange('enableExportCSV', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Bell 
                      size={24}
                      style={{ color: 'var(--color-error)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Notification Settings
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Expiry Alert Days</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={settings.expiryAlertDays}
                        onChange={(e) => handleChange('expiryAlertDays', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Alert before product expires</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Email Notifications
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Receive updates via email</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.emailNotifications}
                        onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          SMS Notifications
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Receive updates via SMS</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.smsNotifications}
                        onChange={(e) => handleChange('smsNotifications', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Low Stock Alerts
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Get notified when stock is low</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.lowStockAlert}
                        onChange={(e) => handleChange('lowStockAlert', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Payment Due Alerts
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Reminders for pending payments</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.paymentDueAlert}
                        onChange={(e) => handleChange('paymentDueAlert', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Rental Return Alerts
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Reminders for rental returns</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.rentalReturnAlert}
                        onChange={(e) => handleChange('rentalReturnAlert', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Product Expiry Alerts
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Before product expiration</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.expiryAlert}
                        onChange={(e) => handleChange('expiryAlert', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Order Status Notifications
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >When order status changes</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.orderStatusNotification}
                        onChange={(e) => handleChange('orderStatusNotification', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Daily Sales Summary
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >End of day sales report</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.dailySalesSummary}
                        onChange={(e) => handleChange('dailySalesSummary', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield 
                      size={24}
                      style={{ color: 'rgba(6, 182, 212, 1)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Security Configuration
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Session Timeout (minutes)</Label>
                      <Input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => handleChange('sessionTimeout', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Password Policy</Label>
                      <select
                        value={settings.passwordPolicy}
                        onChange={(e) => handleChange('passwordPolicy', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="weak">Weak (6+ characters)</option>
                        <option value="medium">Medium (8+ chars, mixed case)</option>
                        <option value="strong">Strong (12+ chars, symbols)</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Max Login Attempts</Label>
                      <Input
                        type="number"
                        min="3"
                        max="10"
                        value={settings.maxLoginAttempts}
                        onChange={(e) => handleChange('maxLoginAttempts', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Lockout Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="5"
                        max="60"
                        value={settings.lockoutDuration}
                        onChange={(e) => handleChange('lockoutDuration', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >IP Whitelist (comma-separated)</Label>
                      <Textarea
                        placeholder="192.168.1.1, 192.168.1.2"
                        value={settings.ipWhitelist}
                        onChange={(e) => handleChange('ipWhitelist', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                        rows={2}
                      />
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Two-Factor Authentication
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Extra layer of security</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.twoFactorAuth}
                        onChange={(e) => handleChange('twoFactorAuth', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Enable Audit Log
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Track all user actions</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableAuditLog}
                        onChange={(e) => handleChange('enableAuditLog', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Require Email Verification
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >For new user accounts</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.requireEmailVerification}
                        onChange={(e) => handleChange('requireEmailVerification', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Role-Based Access Control
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Restrict features by user role</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableRoleBasedAccess}
                        onChange={(e) => handleChange('enableRoleBasedAccess', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Advanced Settings */}
              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Database 
                      size={24}
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                    <h2 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Advanced Configuration
                    </h2>
                  </div>

                  <div 
                    className="border rounded-lg p-4 mb-4"
                    style={{
                      backgroundColor: 'rgba(249, 115, 22, 0.1)',
                      borderColor: 'rgba(249, 115, 22, 0.3)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
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
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >API Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter API key"
                        value={settings.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Webhook URL</Label>
                      <Input
                        placeholder="https://example.com/webhook"
                        value={settings.webhookUrl}
                        onChange={(e) => handleChange('webhookUrl', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Backup Frequency</Label>
                      <select
                        value={settings.backupFrequency}
                        onChange={(e) => handleChange('backupFrequency', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Default Location</Label>
                      <Input
                        placeholder="Main Store"
                        value={settings.defaultLocation}
                        onChange={(e) => handleChange('defaultLocation', e.target.value)}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >Cache Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1440"
                        value={settings.cacheDuration}
                        onChange={(e) => handleChange('cacheDuration', Number(e.target.value))}
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <div 
                    className="space-y-3 pt-4 border-t"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Enable API Access
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Allow external API integrations</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableAPI}
                        onChange={(e) => handleChange('enableAPI', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Automatic Backup
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Auto-backup database</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableBackup}
                        onChange={(e) => handleChange('enableBackup', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Debug Mode
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Show detailed error messages</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.debugMode}
                        onChange={(e) => handleChange('debugMode', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Multi-Location Support
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Multiple branches/warehouses</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableMultiLocation}
                        onChange={(e) => handleChange('enableMultiLocation', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Multi-Currency Support
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Handle multiple currencies</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableMultiCurrency}
                        onChange={(e) => handleChange('enableMultiCurrency', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Auto-Update Exchange Rate
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Fetch latest currency rates</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.autoUpdateExchangeRate}
                        onChange={(e) => handleChange('autoUpdateExchangeRate', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      />
                    </label>
                    <label 
                      className="flex items-center justify-between p-4 rounded-lg cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Enable Data Encryption
                        </div>
                        <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >Encrypt sensitive data</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableDataEncryption}
                        onChange={(e) => handleChange('enableDataEncryption', e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-md)'
                        }}
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
          <div 
            className="fixed bottom-6 right-6 border-2 rounded-xl p-4 shadow-2xl z-50"
            style={{
              backgroundColor: 'var(--color-wholesale)',
              borderColor: 'var(--color-wholesale)',
              borderWidth: '2px',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px rgba(147, 51, 234, 0.2)'
            }}
          >
            <div className="flex items-center gap-4">
              <div>
                <div 
                  className="font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Unsaved Changes
                </div>
                <div 
                  className="text-xs"
                  style={{ color: 'rgba(221, 214, 254, 1)' }}
                >
                  You have modified settings
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  style={{
                    backgroundColor: 'var(--color-wholesale)',
                    borderColor: 'var(--color-wholesale)',
                    color: 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-800
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                  }}
                >
                  Discard
                </Button>
                <Button
                  onClick={handleSave}
                  style={{
                    backgroundColor: 'var(--color-text-primary)',
                    color: 'var(--color-wholesale)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-text-primary)';
                  }}
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
