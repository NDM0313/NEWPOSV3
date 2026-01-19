import React, { useState } from 'react';
import { 
  Building2, CreditCard, Hash, Shield, ToggleLeft, Save, 
  CheckCircle, Users, Lock, Key, Settings as SettingsIcon, AlertCircle, UserCog,
  MapPin, Store, ShoppingCart, ShoppingBag, Package, Shirt, Calculator, DollarSign
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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

export const SettingsPageComplete = () => {
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

  const handleSave = () => {
    switch(activeTab) {
      case 'company':
        settings.updateCompanySettings(companyForm);
        break;
      case 'pos':
        settings.updatePOSSettings(posForm);
        break;
      case 'sales':
        settings.updateSalesSettings(salesForm);
        break;
      case 'purchase':
        settings.updatePurchaseSettings(purchaseForm);
        break;
      case 'inventory':
        settings.updateInventorySettings(inventoryForm);
        break;
      case 'rental':
        settings.updateRentalSettings(rentalForm);
        break;
      case 'accounting':
        settings.updateAccountingSettings(accountingForm);
        break;
      case 'accounts':
        settings.updateDefaultAccounts(accountsForm);
        break;
      case 'numbering':
        settings.updateNumberingRules(numberingForm);
        break;
      case 'permissions':
        settings.updatePermissions(permissionsForm);
        break;
      case 'modules':
        settings.updateModules(modulesForm);
        break;
    }
    setHasUnsavedChanges(false);
    toast.success('Settings saved successfully!');
  };

  const tabs = [
    { id: 'company', label: 'Company Info', icon: Building2, color: 'blue' },
    { id: 'branches', label: 'Branches', icon: MapPin, color: 'green' },
    { id: 'pos', label: 'POS Settings', icon: Store, color: 'purple' },
    { id: 'sales', label: 'Sales', icon: ShoppingCart, color: 'blue' },
    { id: 'purchase', label: 'Purchases', icon: ShoppingBag, color: 'orange' },
    { id: 'inventory', label: 'Inventory', icon: Package, color: 'teal' },
    { id: 'rental', label: 'Rentals', icon: Shirt, color: 'pink' },
    { id: 'accounting', label: 'Accounting', icon: Calculator, color: 'yellow' },
    { id: 'accounts', label: 'Default Accounts', icon: CreditCard, color: 'indigo' },
    { id: 'numbering', label: 'Numbering', icon: Hash, color: 'cyan' },
    { id: 'users', label: 'Users', icon: UserCog, color: 'red' },
    { id: 'permissions', label: 'Permissions', icon: Shield, color: 'amber' },
    { id: 'modules', label: 'Module Toggles', icon: ToggleLeft, color: 'lime' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <SettingsIcon size={32} className="text-blue-500" />
            System Settings
          </h2>
          <p className="text-gray-400 mt-1">Configure all aspects of your ERP system</p>
        </div>
        
        <Button 
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-500 text-white gap-2"
          disabled={!hasUnsavedChanges}
        >
          <Save size={16} />
          Save Changes
        </Button>
      </div>

      {/* Tabs Grid (3 columns) */}
      <div className="grid grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={cn(
              "p-4 rounded-xl border-2 transition-all text-left",
              activeTab === tab.id
                ? "border-blue-500 bg-blue-500/10"
                : "border-gray-800 bg-gray-900/50 hover:bg-gray-800/50 hover:border-gray-700"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                activeTab === tab.id ? "bg-blue-500/20" : "bg-gray-800"
              )}>
                <tab.icon size={20} className={activeTab === tab.id ? "text-blue-400" : "text-gray-400"} />
              </div>
              <div>
                <p className={cn(
                  "font-medium text-sm",
                  activeTab === tab.id ? "text-white" : "text-gray-400"
                )}>
                  {tab.label}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content Container */}
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
                <p className="text-sm text-gray-400">Basic business details and contact information</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-300 mb-2 block">Business Name</Label>
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
                <Label className="text-gray-300 mb-2 block">Email</Label>
                <Input
                  type="email"
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
                <Label className="text-gray-300 mb-2 block">Phone</Label>
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
                <Label className="text-gray-300 mb-2 block">Default Currency</Label>
                <Select 
                  value={companyForm.currency} 
                  onValueChange={(val) => {
                    setCompanyForm({ ...companyForm, currency: val });
                    setHasUnsavedChanges(true);
                  }}
                >
                  <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* BRANCHES TAB */}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <MapPin className="text-green-500" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Branch Management</h3>
                  <p className="text-sm text-gray-400">Manage multiple locations and their settings</p>
                </div>
              </div>
              <Button className="bg-green-600 hover:bg-green-500 text-white gap-2">
                <MapPin size={16} /> Add New Branch
              </Button>
            </div>

            <div className="grid gap-4">
              {settings.branches.map((branch) => (
                <div key={branch.id} className="bg-gray-950 border border-gray-800 rounded-lg p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
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
                      <p className="text-sm text-gray-400 mb-1">{branch.address}</p>
                      <p className="text-sm text-gray-500">{branch.phone}</p>
                      
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
                    
                    <Button variant="outline" className="border-gray-700 text-gray-300">
                      Edit
                    </Button>
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
                <p className="text-sm text-gray-400">Configure point of sale behavior and defaults</p>
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
                  placeholder="INV-"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Default Tax Rate (%)</Label>
                <Input
                  type="number"
                  value={posForm.defaultTaxRate}
                  onChange={(e) => {
                    setPOSForm({ ...posForm, defaultTaxRate: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Max Discount (%)</Label>
                <Input
                  type="number"
                  value={posForm.maxDiscountPercent}
                  onChange={(e) => {
                    setPOSForm({ ...posForm, maxDiscountPercent: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <h4 className="text-white font-semibold mb-3">POS Behavior</h4>
              
              <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div>
                  <p className="text-white font-medium">Credit Sale Allowed</p>
                  <p className="text-sm text-gray-400">Allow sales on credit without immediate payment</p>
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
                  <p className="text-sm text-gray-400">Automatically print receipt after sale</p>
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
                  <p className="text-sm text-gray-400">Allow selling items with zero or negative stock</p>
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
                  <p className="text-sm text-gray-400">Enable discount option in POS</p>
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
                <p className="text-sm text-gray-400">Configure sales module behavior and defaults</p>
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
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Default Payment Method</Label>
                <Select
                  value={salesForm.defaultPaymentMethod}
                  onValueChange={(val: any) => {
                    setSalesForm({ ...salesForm, defaultPaymentMethod: val });
                    setHasUnsavedChanges(true);
                  }}
                >
                  <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank">Bank Transfer</SelectItem>
                    <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Auto Due Days</Label>
                <Input
                  type="number"
                  value={salesForm.autoDueDays}
                  onChange={(e) => {
                    setSalesForm({ ...salesForm, autoDueDays: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <h4 className="text-white font-semibold mb-3">Sales Behavior</h4>
              
              <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div>
                  <p className="text-white font-medium">Partial Payment Allowed</p>
                  <p className="text-sm text-gray-400">Allow customers to pay in installments</p>
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
                  <p className="text-sm text-gray-400">Automatically post sales to accounting ledger</p>
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
                  <p className="text-sm text-gray-400">Enable credit sales to customers</p>
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
                  <p className="text-sm text-gray-400">Make customer details mandatory for sales</p>
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
                <p className="text-sm text-gray-400">Configure purchase order workflow and defaults</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-300 mb-2 block">Default Supplier Payable Account</Label>
                <Input
                  value={purchaseForm.defaultSupplierPayableAccount}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, defaultSupplierPayableAccount: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Default Payment Terms (Days)</Label>
                <Input
                  type="number"
                  value={purchaseForm.defaultPaymentTerms}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, defaultPaymentTerms: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <h4 className="text-white font-semibold mb-3">Purchase Workflow</h4>
              
              <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div>
                  <p className="text-white font-medium">Over Receive Allowed</p>
                  <p className="text-sm text-gray-400">Allow receiving more quantity than ordered</p>
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
                  <p className="text-white font-medium">Purchase Approval Required</p>
                  <p className="text-sm text-gray-400">Require manager approval before placing order</p>
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
                  <p className="text-sm text-gray-400">Require Goods Receipt Note before invoice</p>
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
                  <p className="text-sm text-gray-400">Automatically update stock on purchase receipt</p>
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
                <p className="text-sm text-gray-400">Configure stock management and valuation methods</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-300 mb-2 block">Low Stock Threshold</Label>
                <Input
                  type="number"
                  value={inventoryForm.lowStockThreshold}
                  onChange={(e) => {
                    setInventoryForm({ ...inventoryForm, lowStockThreshold: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Reorder Alert Days</Label>
                <Input
                  type="number"
                  value={inventoryForm.reorderAlertDays}
                  onChange={(e) => {
                    setInventoryForm({ ...inventoryForm, reorderAlertDays: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-gray-300 mb-2 block">Valuation Method</Label>
                <Select
                  value={inventoryForm.valuationMethod}
                  onValueChange={(val: any) => {
                    setInventoryForm({ ...inventoryForm, valuationMethod: val });
                    setHasUnsavedChanges(true);
                  }}
                >
                  <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="FIFO">FIFO (First In First Out)</SelectItem>
                    <SelectItem value="LIFO">LIFO (Last In First Out)</SelectItem>
                    <SelectItem value="Weighted Average">Weighted Average</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <h4 className="text-white font-semibold mb-3">Inventory Control</h4>
              
              <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div>
                  <p className="text-white font-medium">Negative Stock Allowed</p>
                  <p className="text-sm text-gray-400">Allow stock to go below zero</p>
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
                  <p className="text-sm text-gray-400">Automatically create purchase orders when stock is low</p>
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
                  <p className="text-sm text-gray-400">Require barcode for all products</p>
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
                <p className="text-sm text-gray-400">Configure rental module policies and fees</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-300 mb-2 block">Default Late Fee Per Day (Rs)</Label>
                <Input
                  type="number"
                  value={rentalForm.defaultLateFeePerDay}
                  onChange={(e) => {
                    setRentalForm({ ...rentalForm, defaultLateFeePerDay: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Grace Period (Days)</Label>
                <Input
                  type="number"
                  value={rentalForm.gracePeriodDays}
                  onChange={(e) => {
                    setRentalForm({ ...rentalForm, gracePeriodDays: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Advance Percentage (%)</Label>
                <Input
                  type="number"
                  value={rentalForm.advancePercentage}
                  onChange={(e) => {
                    setRentalForm({ ...rentalForm, advancePercentage: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Security Deposit Amount (Rs)</Label>
                <Input
                  type="number"
                  value={rentalForm.securityDepositAmount}
                  onChange={(e) => {
                    setRentalForm({ ...rentalForm, securityDepositAmount: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <h4 className="text-white font-semibold mb-3">Rental Policies</h4>
              
              <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div>
                  <p className="text-white font-medium">Advance Required</p>
                  <p className="text-sm text-gray-400">Require advance payment for rental bookings</p>
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
                  <p className="text-sm text-gray-400">Require refundable security deposit</p>
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
                  <p className="text-sm text-gray-400">Allow charging for damaged items</p>
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
                  <p className="text-sm text-gray-400">Allow customers to extend rental period</p>
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
                <p className="text-sm text-gray-400">Configure fiscal year and accounting policies</p>
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
                  value={accountingForm.defaultTaxRate}
                  onChange={(e) => {
                    setAccountingForm({ ...accountingForm, defaultTaxRate: Number(e.target.value) });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-gray-300 mb-2 block">Tax Calculation Method</Label>
                <Select
                  value={accountingForm.taxCalculationMethod}
                  onValueChange={(val: any) => {
                    setAccountingForm({ ...accountingForm, taxCalculationMethod: val });
                    setHasUnsavedChanges(true);
                  }}
                >
                  <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="Inclusive">Tax Inclusive (Price includes tax)</SelectItem>
                    <SelectItem value="Exclusive">Tax Exclusive (Tax added on top)</SelectItem>
                  </SelectContent>
                </Select>
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
                <p className="text-xs text-gray-500 mt-1">No entries can be created before this date</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <h4 className="text-white font-semibold mb-3">Accounting Policies</h4>
              
              <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div>
                  <p className="text-white font-medium">Manual Journal Enabled</p>
                  <p className="text-sm text-gray-400">Allow creating manual journal entries</p>
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
                  <p className="text-sm text-gray-400">Enable transactions in multiple currencies</p>
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

        {/* Keep existing tabs: accounts, numbering, users, permissions, modules */}
        {/* (These are already implemented in SettingsPageNew.tsx) */}
        
        {activeTab === 'accounts' && (
          <div className="text-center text-gray-400 py-12">
            <p>Default Accounts settings (already implemented in SettingsPageNew)</p>
          </div>
        )}

        {activeTab === 'numbering' && (
          <div className="text-center text-gray-400 py-12">
            <p>Numbering Rules settings (already implemented in SettingsPageNew)</p>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="text-center text-gray-400 py-12">
            <p>User Management (already implemented in SettingsPageNew)</p>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="text-center text-gray-400 py-12">
            <p>Permissions settings (already implemented in SettingsPageNew)</p>
          </div>
        )}

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
                <div>
                  <p className="text-white font-medium text-lg">Rental Module</p>
                  <p className="text-sm text-gray-400">Enable dress rental management features</p>
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
                <div>
                  <p className="text-white font-medium text-lg">Studio Production Module</p>
                  <p className="text-sm text-gray-400">Enable suit stitching and worker management</p>
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
                <div>
                  <p className="text-white font-medium text-lg">Accounting Module</p>
                  <p className="text-sm text-gray-400">Enable double-entry accounting system</p>
                </div>
                <Switch
                  checked={modulesForm.accountingModuleEnabled}
                  onCheckedChange={(val) => {
                    setModulesForm({ ...modulesForm, accountingModuleEnabled: val });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>

              <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                <div>
                  <p className="text-white font-medium text-lg">POS Module</p>
                  <p className="text-sm text-gray-400">Enable Point of Sale system</p>
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
                <div>
                  <p className="text-white font-medium text-lg">Production Module</p>
                  <p className="text-sm text-gray-400">Enable advanced production workflows</p>
                </div>
                <Switch
                  checked={modulesForm.productionModuleEnabled}
                  onCheckedChange={(val) => {
                    setModulesForm({ ...modulesForm, productionModuleEnabled: val });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-6">
              <p className="text-sm text-blue-300">
                ℹ️ <strong>Note:</strong> Disabling a module will hide it from sidebar and prevent access. Existing data will be preserved.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
