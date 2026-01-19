import React, { useState } from 'react';
import { 
  Building2, CreditCard, Hash, Shield, ToggleLeft, Save, 
  Users, MapPin, Store, ShoppingCart, ShoppingBag, Package, 
  Shirt, Calculator, Check
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

export const SettingsPageClean = () => {
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
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'branches', label: 'Branches', icon: MapPin },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'permissions', label: 'Roles', icon: Shield },
    { id: 'accounts', label: 'Accounts', icon: CreditCard },
    { id: 'numbering', label: 'Numbering', icon: Hash },
    { id: 'pos', label: 'POS', icon: Store },
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
    { id: 'purchase', label: 'Purchase', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'rental', label: 'Rental', icon: Shirt },
    { id: 'accounting', label: 'Accounting', icon: Calculator },
    { id: 'modules', label: 'Modules', icon: ToggleLeft },
  ];

  return (
    <div className="flex h-full">
      {/* LEFT SIDEBAR - Vertical Tabs */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 space-y-1">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white px-3">Settings</h2>
          <p className="text-xs text-gray-500 px-3 mt-1">System Configuration</p>
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
          >
            <tab.icon size={18} />
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl">
          
          {/* COMPANY INFO */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Company Information</h3>
                  <p className="text-sm text-gray-400 mt-1">Basic business details</p>
                </div>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500" disabled={!hasUnsavedChanges}>
                  <Save size={16} className="mr-2" /> Save
                </Button>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300 mb-2 block text-sm">Business Name</Label>
                    <Input
                      value={companyForm.businessName}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessName: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block text-sm">Currency</Label>
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
                        <SelectItem value="PKR">PKR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block text-sm">Email</Label>
                    <Input
                      type="email"
                      value={companyForm.businessEmail}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessEmail: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block text-sm">Phone</Label>
                    <Input
                      value={companyForm.businessPhone}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessPhone: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block text-sm">Address</Label>
                    <Input
                      value={companyForm.businessAddress}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessAddress: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block text-sm">Tax ID / NTN</Label>
                    <Input
                      value={companyForm.taxId}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, taxId: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BRANCHES */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Branch Management</h3>
                  <p className="text-sm text-gray-400 mt-1">Manage locations</p>
                </div>
                <Button className="bg-green-600 hover:bg-green-500">
                  <MapPin size={16} className="mr-2" /> Add Branch
                </Button>
              </div>

              <div className="space-y-3">
                {settings.branches.map((branch) => (
                  <div key={branch.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-white font-bold">{branch.branchName}</h4>
                          <Badge className="bg-blue-500/20 text-blue-400 text-xs">{branch.branchCode}</Badge>
                          {branch.isDefault && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{branch.address}</p>
                        <p className="text-xs text-gray-500 mt-1">{branch.phone}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-gray-400">Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">User Management</h3>
                  <p className="text-sm text-gray-400 mt-1">System users</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-500">
                  <Users size={16} className="mr-2" /> Add User
                </Button>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-950 border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr className="hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                            <span className="text-red-400 text-sm font-bold">A</span>
                          </div>
                          <span className="text-white text-sm">Admin User</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">admin@dincollection.com</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-red-500/20 text-red-400 text-xs">Admin</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className="bg-green-500/20 text-green-400 text-xs">Active</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-400 text-sm font-bold">M</span>
                          </div>
                          <span className="text-white text-sm">Manager User</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">manager@dincollection.com</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-blue-500/20 text-blue-400 text-xs">Manager</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className="bg-green-500/20 text-green-400 text-xs">Active</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-500/20 rounded-full flex items-center justify-center">
                            <span className="text-gray-400 text-sm font-bold">S</span>
                          </div>
                          <span className="text-white text-sm">Staff User</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">staff@dincollection.com</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-gray-500/20 text-gray-400 text-xs">Staff</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className="bg-green-500/20 text-green-400 text-xs">Active</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Roles & Permissions</h3>
                  <p className="text-sm text-gray-400 mt-1">Access control</p>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <p className="text-sm text-gray-400 mb-4">Current Role: <span className="text-white font-bold">{permissionsForm.role}</span></p>
                
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'canCreateSale', label: 'Create Sales' },
                    { key: 'canEditSale', label: 'Edit Sales' },
                    { key: 'canDeleteSale', label: 'Delete Sales' },
                    { key: 'canViewReports', label: 'View Reports' },
                    { key: 'canManageSettings', label: 'Manage Settings' },
                    { key: 'canManageUsers', label: 'Manage Users' },
                    { key: 'canAccessAccounting', label: 'Access Accounting' },
                    { key: 'canMakePayments', label: 'Make Payments' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center justify-between bg-gray-950 p-3 rounded-lg">
                      <span className="text-sm text-gray-300">{perm.label}</span>
                      {permissionsForm[perm.key as keyof UserPermissions] ? (
                        <Check size={16} className="text-green-400" />
                      ) : (
                        <div className="w-4 h-4 rounded border border-gray-700" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DEFAULT ACCOUNTS */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Default Accounts</h3>
                  <p className="text-sm text-gray-400 mt-1">Payment method defaults</p>
                </div>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500" disabled={!hasUnsavedChanges}>
                  <Save size={16} className="mr-2" /> Save
                </Button>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
                <div>
                  <Label className="text-gray-300 mb-2 block text-sm">Default Cash Account</Label>
                  <Input
                    value={accountsForm.defaultCashAccount}
                    onChange={(e) => {
                      setAccountsForm({ ...accountsForm, defaultCashAccount: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    className="bg-gray-950 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 mb-2 block text-sm">Default Bank Account</Label>
                  <Input
                    value={accountsForm.defaultBankAccount}
                    onChange={(e) => {
                      setAccountsForm({ ...accountsForm, defaultBankAccount: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    className="bg-gray-950 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 mb-2 block text-sm">Default Mobile Wallet</Label>
                  <Input
                    value={accountsForm.defaultMobileWalletAccount}
                    onChange={(e) => {
                      setAccountsForm({ ...accountsForm, defaultMobileWalletAccount: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    className="bg-gray-950 border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* NUMBERING */}
          {activeTab === 'numbering' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Numbering Rules</h3>
                  <p className="text-sm text-gray-400 mt-1">Auto-increment settings</p>
                </div>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500" disabled={!hasUnsavedChanges}>
                  <Save size={16} className="mr-2" /> Save
                </Button>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'salePrefix', nextKey: 'saleNextNumber', label: 'Sales' },
                    { key: 'purchasePrefix', nextKey: 'purchaseNextNumber', label: 'Purchases' },
                    { key: 'rentalPrefix', nextKey: 'rentalNextNumber', label: 'Rentals' },
                    { key: 'posPrefix', nextKey: 'posNextNumber', label: 'POS' },
                    { key: 'expensePrefix', nextKey: 'expenseNextNumber', label: 'Expenses' },
                    { key: 'productPrefix', nextKey: 'productNextNumber', label: 'Products' },
                  ].map((rule) => (
                    <div key={rule.key} className="bg-gray-950 p-4 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">{rule.label}</p>
                      <div className="flex gap-2">
                        <Input
                          value={numberingForm[rule.key as keyof typeof numberingForm]}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, [rule.key]: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white flex-1"
                          placeholder="Prefix"
                        />
                        <Input
                          type="number"
                          value={numberingForm[rule.nextKey as keyof typeof numberingForm]}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, [rule.nextKey]: Number(e.target.value) });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white w-24"
                          placeholder="Next"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE TOGGLES */}
          {activeTab === 'modules' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Module Toggles</h3>
                  <p className="text-sm text-gray-400 mt-1">Enable/disable features</p>
                </div>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500" disabled={!hasUnsavedChanges}>
                  <Save size={16} className="mr-2" /> Save
                </Button>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'rentalModuleEnabled', label: 'Rental Module', desc: 'Dress rental management' },
                  { key: 'studioModuleEnabled', label: 'Studio Production', desc: 'Suit stitching workflow' },
                  { key: 'accountingModuleEnabled', label: 'Accounting', desc: 'Double-entry accounting' },
                  { key: 'posModuleEnabled', label: 'POS System', desc: 'Point of sale' },
                  { key: 'productionModuleEnabled', label: 'Production', desc: 'Advanced manufacturing' },
                ].map((module) => (
                  <div key={module.key} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div>
                      <p className="text-white font-medium">{module.label}</p>
                      <p className="text-sm text-gray-400">{module.desc}</p>
                    </div>
                    <Switch
                      checked={modulesForm[module.key as keyof typeof modulesForm]}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, [module.key]: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OTHER MODULE SETTINGS (Simplified) */}
          {['pos', 'sales', 'purchase', 'inventory', 'rental', 'accounting'].includes(activeTab) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white capitalize">{activeTab} Settings</h3>
                  <p className="text-sm text-gray-400 mt-1">Configure {activeTab} behavior</p>
                </div>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500" disabled={!hasUnsavedChanges}>
                  <Save size={16} className="mr-2" /> Save
                </Button>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-gray-400 text-sm">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} module settings will be configured here.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
