import React, { useState } from 'react';
import { 
  Building2, CreditCard, Hash, Shield, ToggleLeft, Save, 
  CheckCircle, Users, Lock, Key, Settings as SettingsIcon, AlertCircle, UserCog,
  MapPin, Store, ShoppingCart, ShoppingBag, Package, Shirt, Calculator
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { cn } from "../ui/utils";
import { useSettings } from '@/app/context/SettingsContext';
import { toast } from 'sonner';

type SettingsTab = 
  | 'company' 
  | 'branches' 
  | 'pos' 
  | 'sales' 
  | 'purchase' 
  | 'inventory' 
  | 'rental' 
  | 'accounting'
  | 'accounts' 
  | 'numbering' 
  | 'users' 
  | 'permissions' 
  | 'modules';

export const SettingsPageNew = () => {
  const settings = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Local state for form editing
  const [companyForm, setCompanyForm] = useState(settings.company);
  const [posForm, setPOSForm] = useState(settings.posSettings);
  const [salesForm, setSalesForm] = useState(settings.salesSettings);
  const [purchaseForm, setPurchaseForm] = useState(settings.purchaseSettings);
  const [inventoryForm, setInventoryForm] = useState(settings.inventorySettings);
  const [rentalForm, setRentalForm] = useState(settings.rentalSettings);
  const [accountingForm, setAccountingForm] = useState(settings.accountingSettings);
  const [accountsForm, setAccountsForm] = useState(settings.defaultAccounts);
  const [numberingForm, setNumberingForm] = useState(settings.numberingRules);
  const [permissionsForm, setPermissionsForm] = useState(settings.currentUser);
  const [modulesForm, setModulesForm] = useState(settings.modules);

  const handleSave = async () => {
    try {
      switch(activeTab) {
        case 'company':
          await settings.updateCompanySettings(companyForm);
          break;
        case 'pos':
          await settings.updatePOSSettings(posForm);
          break;
        case 'sales':
          await settings.updateSalesSettings(salesForm);
          break;
        case 'purchase':
          await settings.updatePurchaseSettings(purchaseForm);
          break;
        case 'inventory':
          await settings.updateInventorySettings(inventoryForm);
          break;
        case 'rental':
          await settings.updateRentalSettings(rentalForm);
          break;
        case 'accounting':
          await settings.updateAccountingSettings(accountingForm);
          break;
        case 'accounts':
          await settings.updateDefaultAccounts(accountsForm);
          break;
        case 'numbering':
          await settings.updateNumberingRules(numberingForm);
          break;
        case 'permissions':
          await settings.updatePermissions(permissionsForm);
          break;
        case 'modules':
          await settings.updateModules(modulesForm);
          break;
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('[SETTINGS PAGE] Error saving:', error);
      toast.error('Failed to save settings');
    }
  };

  const tabs = [
    { id: 'company' as const, label: 'Company Info', icon: Building2 },
    { id: 'branches' as const, label: 'Branch Management', icon: MapPin },
    { id: 'pos' as const, label: 'POS Settings', icon: Store },
    { id: 'sales' as const, label: 'Sales Settings', icon: ShoppingCart },
    { id: 'purchase' as const, label: 'Purchase Settings', icon: ShoppingBag },
    { id: 'inventory' as const, label: 'Inventory Settings', icon: Package },
    { id: 'rental' as const, label: 'Rental Settings', icon: Shirt },
    { id: 'accounting' as const, label: 'Accounting Settings', icon: Calculator },
    { id: 'accounts' as const, label: 'Default Accounts', icon: CreditCard },
    { id: 'numbering' as const, label: 'Numbering Rules', icon: Hash },
    { id: 'users' as const, label: 'User Management', icon: UserCog },
    { id: 'permissions' as const, label: 'Roles & Permissions', icon: Shield },
    { id: 'modules' as const, label: 'Module Toggles', icon: ToggleLeft },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <SettingsIcon size={32} className="text-blue-500" />
            System Settings
          </h2>
          <p className="text-gray-400 mt-1">Configure your ERP system defaults and preferences.</p>
        </div>
        
        {hasUnsavedChanges && (
          <Button 
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-500 text-white gap-2 shadow-lg"
          >
            <Save size={16} /> Save Changes
          </Button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Sidebar Navigation */}
        <div className="col-span-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <tab.icon size={18} />
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="col-span-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
            
            {/* COMPANY INFO TAB */}
            {activeTab === 'company' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Building2 className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Company Information</h3>
                    <p className="text-sm text-gray-400">Basic business details and contact info</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Business Name *</Label>
                    <Input 
                      value={companyForm.businessName}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessName: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Din Collection"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Tax ID / NTN</Label>
                    <Input 
                      value={companyForm.taxId}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, taxId: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="TAX-123456"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block">Business Address</Label>
                    <Input 
                      value={companyForm.businessAddress}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessAddress: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Main Branch, Lahore, Pakistan"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Phone Number</Label>
                    <Input 
                      value={companyForm.businessPhone}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessPhone: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="+92 300 1234567"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Email Address</Label>
                    <Input 
                      value={companyForm.businessEmail}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessEmail: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="contact@dincollection.com"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Currency</Label>
                    <select 
                      value={companyForm.currency}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, currency: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="PKR">PKR - Pakistani Rupee</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* BRANCH MANAGEMENT TAB */}
            {activeTab === 'branches' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <MapPin className="text-green-500" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Branch Management</h3>
                      <p className="text-sm text-gray-400">Manage multiple business locations</p>
                    </div>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-500 text-white gap-2">
                    <MapPin size={16} /> Add New Branch
                  </Button>
                </div>

                <div className="grid gap-4">
                  {settings.branches.map((branch) => (
                    <div key={branch.id} className="bg-gray-950 border border-gray-800 rounded-lg p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-bold text-lg">{branch.branchName}</h4>
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                              {branch.branchCode}
                            </Badge>
                            {branch.isDefault && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                Default
                              </Badge>
                            )}
                            {branch.isActive ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{branch.address}</p>
                          <p className="text-xs text-gray-500 mt-1">{branch.phone}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">Edit</Button>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                          <p className="text-xs text-gray-500 mb-1">Cash Account</p>
                          <p className="text-sm text-white font-medium">{branch.cashAccount}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                          <p className="text-xs text-gray-500 mb-1">Bank Account</p>
                          <p className="text-sm text-white font-medium">{branch.bankAccount}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                          <p className="text-xs text-gray-500 mb-1">POS Drawer</p>
                          <p className="text-sm text-white font-medium">{branch.posCashDrawer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* POS SETTINGS TAB */}
            {activeTab === 'pos' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Store className="text-purple-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">POS Settings</h3>
                    <p className="text-sm text-gray-400">Configure point of sale behavior</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Cash Account</Label>
                    <Input
                      value={posForm.defaultCashAccount}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, defaultCashAccount: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Cash Drawer"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Invoice Prefix</Label>
                    <Input
                      value={posForm.invoicePrefix}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, invoicePrefix: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="POS-"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Tax Rate (%)</Label>
                    <Input
                      type="number"
                      value={posForm.defaultTaxRate || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, defaultTaxRate: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Max Discount (%)</Label>
                    <Input
                      type="number"
                      value={posForm.maxDiscountPercent || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, maxDiscountPercent: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">POS Behavior</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Credit Sale Allowed</p>
                      <p className="text-sm text-gray-400">Allow sales on credit without payment</p>
                    </div>
                    <Switch
                      checked={posForm.creditSaleAllowed}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, creditSaleAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Print Receipt</p>
                      <p className="text-sm text-gray-400">Automatically print after sale</p>
                    </div>
                    <Switch
                      checked={posForm.autoPrintReceipt}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, autoPrintReceipt: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Negative Stock Allowed</p>
                      <p className="text-sm text-gray-400">Sell items with zero stock</p>
                    </div>
                    <Switch
                      checked={posForm.negativeStockAllowed}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, negativeStockAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Allow Discount</p>
                      <p className="text-sm text-gray-400">Enable discount in POS</p>
                    </div>
                    <Switch
                      checked={posForm.allowDiscount}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, allowDiscount: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SALES SETTINGS TAB */}
            {activeTab === 'sales' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <ShoppingCart className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Sales Settings</h3>
                    <p className="text-sm text-gray-400">Configure sales module behavior</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Invoice Prefix</Label>
                    <Input
                      value={salesForm.invoicePrefix}
                      onChange={(e) => {
                        setSalesForm({ ...salesForm, invoicePrefix: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="SAL-"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Payment Method</Label>
                    <select
                      value={salesForm.defaultPaymentMethod}
                      onChange={(e) => {
                        setSalesForm({ ...salesForm, defaultPaymentMethod: e.target.value as any });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Mobile Wallet">Mobile Wallet</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Auto Due Days</Label>
                    <Input
                      type="number"
                      value={salesForm.autoDueDays || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setSalesForm({ ...salesForm, autoDueDays: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="7"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Sales Behavior</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Partial Payment Allowed</p>
                      <p className="text-sm text-gray-400">Allow installment payments</p>
                    </div>
                    <Switch
                      checked={salesForm.partialPaymentAllowed}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, partialPaymentAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Ledger Entry</p>
                      <p className="text-sm text-gray-400">Auto-post to accounting</p>
                    </div>
                    <Switch
                      checked={salesForm.autoLedgerEntry}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, autoLedgerEntry: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Allow Credit Sale</p>
                      <p className="text-sm text-gray-400">Enable credit sales</p>
                    </div>
                    <Switch
                      checked={salesForm.allowCreditSale}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, allowCreditSale: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Require Customer Info</p>
                      <p className="text-sm text-gray-400">Make customer details mandatory</p>
                    </div>
                    <Switch
                      checked={salesForm.requireCustomerInfo}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, requireCustomerInfo: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PURCHASE SETTINGS TAB */}
            {activeTab === 'purchase' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <ShoppingBag className="text-orange-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Purchase Settings</h3>
                    <p className="text-sm text-gray-400">Configure purchase workflow</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Supplier Payable Account</Label>
                    <Input
                      value={purchaseForm.defaultSupplierPayableAccount}
                      onChange={(e) => {
                        setPurchaseForm({ ...purchaseForm, defaultSupplierPayableAccount: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Accounts Payable"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Payment Terms (Days)</Label>
                    <Input
                      type="number"
                      value={purchaseForm.defaultPaymentTerms || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setPurchaseForm({ ...purchaseForm, defaultPaymentTerms: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="30"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Purchase Workflow</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Over Receive Allowed</p>
                      <p className="text-sm text-gray-400">Receive more than ordered qty</p>
                    </div>
                    <Switch
                      checked={purchaseForm.overReceiveAllowed}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, overReceiveAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Approval Required</p>
                      <p className="text-sm text-gray-400">Manager approval before order</p>
                    </div>
                    <Switch
                      checked={purchaseForm.purchaseApprovalRequired}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, purchaseApprovalRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">GRN Required</p>
                      <p className="text-sm text-gray-400">Goods Receipt Note mandatory</p>
                    </div>
                    <Switch
                      checked={purchaseForm.grnRequired}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, grnRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Post to Inventory</p>
                      <p className="text-sm text-gray-400">Update stock automatically</p>
                    </div>
                    <Switch
                      checked={purchaseForm.autoPostToInventory}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, autoPostToInventory: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* INVENTORY SETTINGS TAB */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-teal-500/10 rounded-lg">
                    <Package className="text-teal-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Inventory Settings</h3>
                    <p className="text-sm text-gray-400">Configure stock management</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Low Stock Threshold</Label>
                    <Input
                      type="number"
                      value={inventoryForm.lowStockThreshold || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setInventoryForm({ ...inventoryForm, lowStockThreshold: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Reorder Alert Days</Label>
                    <Input
                      type="number"
                      value={inventoryForm.reorderAlertDays || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setInventoryForm({ ...inventoryForm, reorderAlertDays: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="30"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block">Valuation Method</Label>
                    <select
                      value={inventoryForm.valuationMethod}
                      onChange={(e) => {
                        setInventoryForm({ ...inventoryForm, valuationMethod: e.target.value as any });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="FIFO">FIFO (First In First Out)</option>
                      <option value="LIFO">LIFO (Last In First Out)</option>
                      <option value="Weighted Average">Weighted Average</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Inventory Control</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Negative Stock Allowed</p>
                      <p className="text-sm text-gray-400">Stock can go below zero</p>
                    </div>
                    <Switch
                      checked={inventoryForm.negativeStockAllowed}
                      onCheckedChange={(val) => {
                        setInventoryForm({ ...inventoryForm, negativeStockAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Reorder Enabled</p>
                      <p className="text-sm text-gray-400">Auto-create purchase orders</p>
                    </div>
                    <Switch
                      checked={inventoryForm.autoReorderEnabled}
                      onCheckedChange={(val) => {
                        setInventoryForm({ ...inventoryForm, autoReorderEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Barcode Required</p>
                      <p className="text-sm text-gray-400">Mandatory for all products</p>
                    </div>
                    <Switch
                      checked={inventoryForm.barcodeRequired}
                      onCheckedChange={(val) => {
                        setInventoryForm({ ...inventoryForm, barcodeRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* RENTAL SETTINGS TAB */}
            {activeTab === 'rental' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-pink-500/10 rounded-lg">
                    <Shirt className="text-pink-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Rental Settings</h3>
                    <p className="text-sm text-gray-400">Configure rental policies and fees</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Late Fee Per Day (Rs)</Label>
                    <Input
                      type="number"
                      value={rentalForm.defaultLateFeePerDay || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, defaultLateFeePerDay: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Grace Period (Days)</Label>
                    <Input
                      type="number"
                      value={rentalForm.gracePeriodDays || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, gracePeriodDays: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Advance Percentage (%)</Label>
                    <Input
                      type="number"
                      value={rentalForm.advancePercentage || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, advancePercentage: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="50"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Security Deposit (Rs)</Label>
                    <Input
                      type="number"
                      value={rentalForm.securityDepositAmount || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, securityDepositAmount: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Rental Policies</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Advance Required</p>
                      <p className="text-sm text-gray-400">Require advance payment</p>
                    </div>
                    <Switch
                      checked={rentalForm.advanceRequired}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, advanceRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Security Deposit Required</p>
                      <p className="text-sm text-gray-400">Refundable security deposit</p>
                    </div>
                    <Switch
                      checked={rentalForm.securityDepositRequired}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, securityDepositRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Damage Charge Enabled</p>
                      <p className="text-sm text-gray-400">Charge for damaged items</p>
                    </div>
                    <Switch
                      checked={rentalForm.damageChargeEnabled}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, damageChargeEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Extend Allowed</p>
                      <p className="text-sm text-gray-400">Allow rental extension</p>
                    </div>
                    <Switch
                      checked={rentalForm.autoExtendAllowed}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, autoExtendAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNTING SETTINGS TAB */}
            {activeTab === 'accounting' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-yellow-500/10 rounded-lg">
                    <Calculator className="text-yellow-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Accounting Settings</h3>
                    <p className="text-sm text-gray-400">Configure fiscal year and policies</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Fiscal Year Start</Label>
                    <Input
                      type="date"
                      value={accountingForm.fiscalYearStart}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, fiscalYearStart: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Fiscal Year End</Label>
                    <Input
                      type="date"
                      value={accountingForm.fiscalYearEnd}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, fiscalYearEnd: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Currency</Label>
                    <Input
                      value={accountingForm.defaultCurrency}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, defaultCurrency: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="PKR"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Tax Rate (%)</Label>
                    <Input
                      type="number"
                      value={accountingForm.defaultTaxRate || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, defaultTaxRate: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="0"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block">Tax Calculation Method</Label>
                    <select
                      value={accountingForm.taxCalculationMethod}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, taxCalculationMethod: e.target.value as any });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="Inclusive">Tax Inclusive (Price includes tax)</option>
                      <option value="Exclusive">Tax Exclusive (Tax added on top)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block">Lock Accounting Date (Optional)</Label>
                    <Input
                      type="date"
                      value={accountingForm.lockAccountingDate || ''}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, lockAccountingDate: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">No entries before this date</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Accounting Policies</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Manual Journal Enabled</p>
                      <p className="text-sm text-gray-400">Allow manual journal entries</p>
                    </div>
                    <Switch
                      checked={accountingForm.manualJournalEnabled}
                      onCheckedChange={(val) => {
                        setAccountingForm({ ...accountingForm, manualJournalEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Multi Currency Enabled</p>
                      <p className="text-sm text-gray-400">Enable multiple currencies</p>
                    </div>
                    <Switch
                      checked={accountingForm.multiCurrencyEnabled}
                      onCheckedChange={(val) => {
                        setAccountingForm({ ...accountingForm, multiCurrencyEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* DEFAULT ACCOUNTS TAB */}
            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <CreditCard className="text-green-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Default Payment Accounts</h3>
                    <p className="text-sm text-gray-400">Set default accounts for Cash, Bank, and Mobile Wallet payments</p>
                  </div>
                </div>

                <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-300">
                    💡 <strong>Tip:</strong> These accounts will be auto-selected in payment dialogs. You can still change them per transaction.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Cash</Badge>
                      Default Cash Account
                    </Label>
                    <select 
                      value={accountsForm.paymentMethods.find(p => p.method === 'Cash')?.defaultAccount || ''}
                      onChange={(e) => {
                        const newMethods = accountsForm.paymentMethods.map(p => 
                          p.method === 'Cash' ? { ...p, defaultAccount: e.target.value } : p
                        );
                        setAccountsForm({ ...accountsForm, paymentMethods: newMethods });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="Cash Drawer">Cash Drawer</option>
                      <option value="Petty Cash">Petty Cash</option>
                      <option value="Main Cash Box">Main Cash Box</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Bank</Badge>
                      Default Bank Account
                    </Label>
                    <select 
                      value={accountsForm.paymentMethods.find(p => p.method === 'Bank')?.defaultAccount || ''}
                      onChange={(e) => {
                        const newMethods = accountsForm.paymentMethods.map(p => 
                          p.method === 'Bank' ? { ...p, defaultAccount: e.target.value } : p
                        );
                        setAccountsForm({ ...accountsForm, paymentMethods: newMethods });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="Meezan Bank - Business Account">Meezan Bank - Business Account</option>
                      <option value="HBL Current Account">HBL Current Account</option>
                      <option value="Allied Bank">Allied Bank</option>
                      <option value="MCB Business Account">MCB Business Account</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Mobile</Badge>
                      Default Mobile Wallet
                    </Label>
                    <select 
                      value={accountsForm.paymentMethods.find(p => p.method === 'Mobile Wallet')?.defaultAccount || ''}
                      onChange={(e) => {
                        const newMethods = accountsForm.paymentMethods.map(p => 
                          p.method === 'Mobile Wallet' ? { ...p, defaultAccount: e.target.value } : p
                        );
                        setAccountsForm({ ...accountsForm, paymentMethods: newMethods });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="JazzCash - Business">JazzCash - Business</option>
                      <option value="EasyPaisa - Business">EasyPaisa - Business</option>
                      <option value="SadaPay">SadaPay</option>
                      <option value="NayaPay">NayaPay</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* NUMBERING RULES TAB */}
            {activeTab === 'numbering' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-cyan-500/10 rounded-lg">
                    <Hash className="text-cyan-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Numbering Rules</h3>
                    <p className="text-sm text-gray-400">Configure auto-increment patterns for all modules</p>
                  </div>
                </div>

                <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-amber-300">
                    ⚠️ <strong>Warning:</strong> Changing numbering rules will only affect new entries. Existing records remain unchanged.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Sales */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart size={18} className="text-blue-400" />
                      <h4 className="text-white font-semibold">Sales Invoice</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.salePrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, salePrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="SAL-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.saleNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, saleNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.salePrefix}{String(numberingForm.saleNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Purchases */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingBag size={18} className="text-orange-400" />
                      <h4 className="text-white font-semibold">Purchase Order</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.purchasePrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, purchasePrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="PO-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.purchaseNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, purchaseNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.purchasePrefix}{String(numberingForm.purchaseNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Rentals */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Shirt size={18} className="text-pink-400" />
                      <h4 className="text-white font-semibold">Rental Booking</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.rentalPrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, rentalPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="RNT-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.rentalNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, rentalNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.rentalPrefix}{String(numberingForm.rentalNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* POS */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Store size={18} className="text-purple-400" />
                      <h4 className="text-white font-semibold">POS Invoice</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.posPrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, posPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="POS-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.posNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, posNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.posPrefix}{String(numberingForm.posNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Expenses */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard size={18} className="text-red-400" />
                      <h4 className="text-white font-semibold">Expense Entry</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.expensePrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, expensePrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="EXP-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.expenseNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, expenseNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.expensePrefix}{String(numberingForm.expenseNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Products */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Package size={18} className="text-teal-400" />
                      <h4 className="text-white font-semibold">Product SKU</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.productPrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, productPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="PRD-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.productNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, productNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.productPrefix}{String(numberingForm.productNextNumber).padStart(4, '0')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* USER MANAGEMENT TAB */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-lg">
                      <UserCog className="text-indigo-500" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">User Management</h3>
                      <p className="text-sm text-gray-400">Manage system users and access</p>
                    </div>
                  </div>
                  <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                    <Users size={16} /> Add User
                  </Button>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-900 border-b border-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      <tr className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                              <span className="text-red-400 font-bold">A</span>
                            </div>
                            <div>
                              <p className="text-white font-medium">Admin User</p>
                              <p className="text-xs text-gray-500">Created 6 months ago</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-400">admin@dincollection.com</td>
                        <td className="px-4 py-4">
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Admin</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">Edit</Button>
                        </td>
                      </tr>

                      <tr className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <span className="text-blue-400 font-bold">M</span>
                            </div>
                            <div>
                              <p className="text-white font-medium">Manager User</p>
                              <p className="text-xs text-gray-500">Created 3 months ago</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-400">manager@dincollection.com</td>
                        <td className="px-4 py-4">
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Manager</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">Edit</Button>
                        </td>
                      </tr>

                      <tr className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
                              <span className="text-gray-400 font-bold">S</span>
                            </div>
                            <div>
                              <p className="text-white font-medium">Staff User</p>
                              <p className="text-xs text-gray-500">Created 1 month ago</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-400">staff@dincollection.com</td>
                        <td className="px-4 py-4">
                          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Staff</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">Edit</Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PERMISSIONS TAB */}
            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <Shield className="text-amber-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Roles & Permissions</h3>
                    <p className="text-sm text-gray-400">Current user: <span className="text-white font-semibold">{permissionsForm.role}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'canCreateSale', label: 'Create Sales', icon: ShoppingCart },
                    { key: 'canEditSale', label: 'Edit Sales', icon: ShoppingCart },
                    { key: 'canDeleteSale', label: 'Delete Sales', icon: ShoppingCart },
                    { key: 'canViewReports', label: 'View Reports', icon: Calculator },
                    { key: 'canManageSettings', label: 'Manage Settings', icon: SettingsIcon },
                    { key: 'canManageUsers', label: 'Manage Users', icon: Users },
                    { key: 'canAccessAccounting', label: 'Access Accounting', icon: Calculator },
                    { key: 'canMakePayments', label: 'Make Payments', icon: CreditCard },
                    { key: 'canReceivePayments', label: 'Receive Payments', icon: CreditCard },
                    { key: 'canManageExpenses', label: 'Manage Expenses', icon: CreditCard },
                    { key: 'canManageProducts', label: 'Manage Products', icon: Package },
                    { key: 'canManagePurchases', label: 'Manage Purchases', icon: ShoppingBag },
                    { key: 'canManageRentals', label: 'Manage Rentals', icon: Shirt },
                  ].map((perm) => {
                    const IconComponent = perm.icon;
                    const isEnabled = permissionsForm[perm.key as keyof typeof permissionsForm];
                    return (
                      <div 
                        key={perm.key} 
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-all",
                          isEnabled 
                            ? "bg-green-900/20 border-green-500/30" 
                            : "bg-gray-950 border-gray-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent size={18} className={isEnabled ? "text-green-400" : "text-gray-500"} />
                          <span className={cn("font-medium", isEnabled ? "text-white" : "text-gray-400")}>
                            {perm.label}
                          </span>
                        </div>
                        {isEnabled ? (
                          <CheckCircle size={20} className="text-green-400" />
                        ) : (
                          <Lock size={20} className="text-gray-600" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 mt-6">
                  <p className="text-sm text-blue-300">
                    ℹ️ <strong>Note:</strong> Permissions are role-based and controlled by system administrators.
                  </p>
                </div>
              </div>
            )}

            {/* MODULE TOGGLES TAB */}
            {activeTab === 'modules' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-lime-500/10 rounded-lg">
                    <ToggleLeft className="text-lime-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Module Toggles</h3>
                    <p className="text-sm text-gray-400">Enable or disable system modules</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Store size={20} className="text-purple-400" />
                      <div>
                        <p className="text-white font-medium text-lg">POS Module</p>
                        <p className="text-sm text-gray-400">Point of Sale system for quick sales</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.posModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, posModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Shirt size={20} className="text-pink-400" />
                      <div>
                        <p className="text-white font-medium text-lg">Rental Module</p>
                        <p className="text-sm text-gray-400">Dress rental management and tracking</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.rentalModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, rentalModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Users size={20} className="text-blue-400" />
                      <div>
                        <p className="text-white font-medium text-lg">Studio Module</p>
                        <p className="text-sm text-gray-400">Suit stitching and worker management</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.studioModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, studioModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Calculator size={20} className="text-yellow-400" />
                      <div>
                        <p className="text-white font-medium text-lg">Accounting Module</p>
                        <p className="text-sm text-gray-400">Double-entry accounting system</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.accountingModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, accountingModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-6">
                  <p className="text-sm text-blue-300">
                    ℹ️ <strong>Note:</strong> Disabling a module will hide it from the sidebar. Existing data will be preserved.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
