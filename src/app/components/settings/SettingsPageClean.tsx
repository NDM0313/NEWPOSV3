import React, { useState, useEffect } from 'react';
import { 
  Building2, CreditCard, Hash, ToggleLeft, Save, 
  Users, MapPin, Store, ShoppingCart, ShoppingBag, Package, 
  Shirt, Calculator, Check, Edit
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../ui/utils";
import { useSettings } from '@/app/context/SettingsContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { userService, User as UserType } from '@/app/services/userService';
import { toast } from 'sonner';
import { AddUserModal } from '../users/AddUserModal';

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
  | 'modules';

export const SettingsPageClean = () => {
  const settings = useSettings();
  const { companyId } = useSupabase();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Users state
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

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
  const [modulesForm, setModulesForm] = useState(settings.modules);

  // Load users function - REBUILT (Clean, reusable)
  const loadUsers = React.useCallback(async () => {
    if (!companyId) return;
    
    setLoadingUsers(true);
    try {
      const usersData = await userService.getAllUsers(companyId, { includeInactive: true });
      setUsers(usersData);
    } catch (error) {
      console.error('[SETTINGS] Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [companyId]);

  // Load users when users tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, loadUsers]);

  // Listen for userCreated event - Real-time update
  useEffect(() => {
    const handleUserCreated = () => {
      if (activeTab === 'users') {
        loadUsers();
      }
    };
    
    window.addEventListener('userCreated', handleUserCreated);
    return () => {
      window.removeEventListener('userCreated', handleUserCreated);
    };
  }, [activeTab, loadUsers]);


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
        case 'modules':
          await settings.updateModules(modulesForm);
          break;
      }
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      console.error('[SETTINGS] Error saving:', error);
      toast.error(error.message || 'Failed to save settings');
    }
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'branches', label: 'Branches', icon: MapPin },
    { id: 'users', label: 'Users', icon: Users },
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

          {/* USER MANAGEMENT - CLEAN REBUILD */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">User Management</h3>
                  <p className="text-sm text-gray-400 mt-1">Manage system users and their access</p>
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-500"
                  onClick={() => {
                    setEditingUser(null);
                    setAddUserModalOpen(true);
                  }}
                >
                  <Users size={16} className="mr-2" /> Add User
                </Button>
              </div>

              {/* Users Table */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                {loadingUsers ? (
                  <div className="p-8 text-center text-gray-400">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Users size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400 mb-2">No users found</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditingUser(null);
                        setAddUserModalOpen(true);
                      }}
                      className="mt-2"
                    >
                      Create First User
                    </Button>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-950 border-b border-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <span className="text-blue-400 text-sm font-bold">
                                  {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <span className="text-white text-sm font-medium">{user.full_name || 'No Name'}</span>
                                {user.phone && (
                                  <p className="text-xs text-gray-500">{user.phone}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-300 text-sm">{user.email}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={cn(
                              "text-xs font-medium",
                              user.role === 'admin' && "bg-red-500/20 text-red-400 border-red-500/30",
                              user.role === 'manager' && "bg-purple-500/20 text-purple-400 border-purple-500/30",
                              user.role === 'salesman' && "bg-green-500/20 text-green-400 border-green-500/30",
                              user.role === 'staff' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                              "bg-gray-500/20 text-gray-400 border-gray-500/30"
                            )}>
                              {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={cn(
                              "text-xs font-medium",
                              user.is_active 
                                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                                : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                            )}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingUser(user);
                                  setAddUserModalOpen(true);
                                }}
                                className="text-xs h-7"
                              >
                                <Edit size={14} className="mr-1" /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await userService.updateUser(user.id, { is_active: !user.is_active });
                                    toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
                                    loadUsers();
                                  } catch (error: any) {
                                    toast.error(`Failed to update user: ${error.message}`);
                                  }
                                }}
                                className="text-xs h-7"
                              >
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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

      {/* Add User Modal - Centered Dialog */}
      <AddUserModal
        open={addUserModalOpen}
        onClose={() => {
          setAddUserModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          loadUsers();
        }}
        editingUser={editingUser}
      />
    </div>
  );
};
