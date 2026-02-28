import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, User as UserIcon, CheckSquare, Square, Key, Mail, Clock, Shield, Building2, Wallet } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useSupabase } from '../../context/SupabaseContext';
import { userService, User as UserType } from '../../services/userService';
import { branchService, Branch } from '../../services/branchService';
import { accountService, Account } from '../../services/accountService';
import { toast } from 'sonner';

type UserModalTab = 'general' | 'branches' | 'accounts' | 'permissions';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingUser?: UserType | null;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  open,
  onClose,
  onSuccess,
  editingUser = null,
}) => {
  const { companyId } = useSupabase();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<UserModalTab>('general');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'staff' as 'admin' | 'manager' | 'staff' | 'salesman' | 'cashier' | 'inventory',
    is_active: true,
    can_be_assigned_as_salesman: false,
    passwordOption: 'temp' as 'temp' | 'invite',
    temporary_password: '',
    permissions: {
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
    }
  });

  // Reset form when modal opens/closes or editingUser changes
  useEffect(() => {
    if (open) {
      setActiveTab('general');
      if (!editingUser) {
        setSelectedBranchIds([]);
        setSelectedAccountIds([]);
      }
      if (editingUser) {
        // Edit mode - prefill form
        setFormData({
          full_name: editingUser.full_name || '',
          email: editingUser.email || '',
          phone: editingUser.phone || '',
          role: (editingUser.role as any) || 'staff',
          is_active: editingUser.is_active ?? true,
          can_be_assigned_as_salesman: editingUser.can_be_assigned_as_salesman ?? false,
          permissions: {
            canCreateSale: editingUser.permissions?.canCreateSale ?? false,
            canEditSale: editingUser.permissions?.canEditSale ?? false,
            canDeleteSale: editingUser.permissions?.canDeleteSale ?? false,
            canViewReports: editingUser.permissions?.canViewReports ?? false,
            canManageSettings: editingUser.permissions?.canManageSettings ?? false,
            canManageUsers: editingUser.permissions?.canManageUsers ?? false,
            canAccessAccounting: editingUser.permissions?.canAccessAccounting ?? false,
            canMakePayments: editingUser.permissions?.canMakePayments ?? false,
            canReceivePayments: editingUser.permissions?.canReceivePayments ?? false,
            canManageExpenses: editingUser.permissions?.canManageExpenses ?? false,
            canManageProducts: editingUser.permissions?.canManageProducts ?? false,
            canManagePurchases: editingUser.permissions?.canManagePurchases ?? false,
            canManageRentals: editingUser.permissions?.canManageRentals ?? false,
          }
        });
      } else {
        // Add mode - reset form
        setFormData({
          full_name: '',
          email: '',
          phone: '',
          role: 'staff',
          is_active: true,
          can_be_assigned_as_salesman: false,
          passwordOption: 'temp',
          temporary_password: '',
          permissions: {
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
          }
        });
      }
    }
  }, [open, editingUser]);

  // Load branches and accounts when modal opens; load user's access when editing
  useEffect(() => {
    if (!open || !companyId) return;
    (async () => {
      try {
        const [branchesData, accountsData] = await Promise.all([
          branchService.getAllBranches(companyId),
          accountService.getAllAccounts(companyId),
        ]);
        setBranches(branchesData || []);
        setAccounts((accountsData || []).filter((a: Account) => a.is_active !== false));
      } catch (e) {
        console.error('[AddUserModal] Load branches/accounts:', e);
      }
    })();
  }, [open, companyId]);

  // Branch/account access is keyed by auth_user_id (identity). Load by auth_user_id when present.
  useEffect(() => {
    if (!open || !editingUser) return;
    const identityId = editingUser.auth_user_id ?? editingUser.id;
    setLoadingAccess(true);
    (async () => {
      try {
        const [branchIds, accountIds] = await Promise.all([
          userService.getUserBranches(identityId),
          userService.getUserAccountAccess(identityId).catch(() => []),
        ]);
        setSelectedBranchIds(branchIds);
        setSelectedAccountIds(accountIds);
      } catch (e) {
        console.error('[AddUserModal] Load user access:', e);
      } finally {
        setLoadingAccess(false);
      }
    })();
  }, [open, editingUser?.id, editingUser?.auth_user_id]);

  const handleSave = async () => {
    if (!companyId) {
      toast.error('Company ID not found');
      return;
    }

    // Validation
    if (!formData.full_name.trim()) {
      toast.error('Please enter full name');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!editingUser && formData.passwordOption === 'temp' && (!formData.temporary_password || formData.temporary_password.length < 6)) {
      toast.error('Temporary password must be at least 6 characters');
      return;
    }

    setSaving(true);

    try {
      // Check for duplicate email (only for new users)
      if (!editingUser) {
        const existingUsers = await userService.getAllUsers(companyId, { includeInactive: true });
        const duplicate = existingUsers.find(
          (u: UserType) => u.email.toLowerCase() === formData.email.toLowerCase()
        );
        if (duplicate) {
          toast.error(`User with email "${formData.email}" already exists`);
          setSaving(false);
          return;
        }
      }

      const userData: Partial<UserType> = {
        company_id: companyId,
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || undefined,
        role: formData.role,
        is_active: formData.is_active,
        can_be_assigned_as_salesman: formData.can_be_assigned_as_salesman,
        permissions: formData.permissions,
      };

      console.log('[ADD USER MODAL] Saving user with data:', JSON.stringify(userData, null, 2));

      let savedUserId: string | null = null;
      let savedAuthUserId: string | null = null;

      if (editingUser) {
        // Update existing user
        console.log('[ADD USER MODAL] Updating user:', editingUser.id);
        await userService.updateUser(editingUser.id, userData);
        savedUserId = editingUser.id;
        toast.success('User updated successfully!');
      } else {
        // Create new user - try Auth flow first (Edge Function)
        try {
          const createResult = await userService.createUserWithAuth({
            email: formData.email.trim().toLowerCase(),
            full_name: formData.full_name.trim(),
            role: formData.role,
            company_id: companyId,
            phone: formData.phone || undefined,
            is_salesman: formData.can_be_assigned_as_salesman,
            is_active: formData.is_active,
            temporary_password: formData.passwordOption === 'temp' && formData.temporary_password.length >= 6 ? formData.temporary_password : undefined,
            send_invite_email: formData.passwordOption === 'invite',
          });
          const result = createResult as { user_id?: string; auth_user_id?: string };
          savedUserId = result?.user_id ?? null;
          savedAuthUserId = result?.auth_user_id ?? null;
          if (!savedUserId) {
            const all = await userService.getAllUsers(companyId, { includeInactive: true });
            const created = all.find((u: UserType) => u.email?.toLowerCase() === formData.email.trim().toLowerCase());
            savedUserId = created?.id ?? null;
            if (created?.auth_user_id) savedAuthUserId = created.auth_user_id;
          }
          toast.success(formData.passwordOption === 'invite' ? 'Invite sent! User will receive email to set password.' : 'User created! They can login with the temporary password.');
        } catch (authErr: any) {
          if (authErr?.message?.includes('Failed to fetch') || authErr?.message?.includes('404') || authErr?.code === 'functions-invoke-error') {
            const created = await userService.createUser(userData);
            savedUserId = created?.id ?? null;
            toast.success('User created. They will need to be invited to set a password.');
          } else {
            throw authErr;
          }
        }
      }

      // Save branch/account access by identity only: auth_user_id (user_branches.user_id = auth.users.id).
      const identityId = editingUser ? editingUser.auth_user_id : savedAuthUserId;
      if (!identityId && (selectedBranchIds.length > 0 || selectedAccountIds.length > 0)) {
        if (editingUser) {
          toast.info('Branch/account access not saved: user must be linked (have auth login) to set access.');
        }
      }
      if (identityId) {
        try {
          await userService.setUserBranches(identityId, selectedBranchIds, selectedBranchIds[0] || undefined, companyId);
        } catch (branchErr: any) {
          const msg = branchErr?.message ?? branchErr?.error?.message ?? String(branchErr);
          console.warn('[AddUserModal] Branch access save failed:', branchErr);
          if (msg?.includes('missing required RPCs')) {
            toast.error(msg);
          } else {
            toast.warning(
              msg?.includes('Only admin') ? msg : `User saved. Branch access failed: ${msg || 'User must be linked (auth) to set branch access.'}`
            );
          }
        }
        try {
          await userService.setUserAccountAccess(identityId, selectedAccountIds, companyId);
        } catch (accountErr: any) {
          const msg = accountErr?.message ?? String(accountErr);
          console.warn('[AddUserModal] Account access save failed:', accountErr);
          if (msg?.includes('missing required RPCs')) {
            toast.error(msg);
          } else {
            toast.warning(
              msg?.includes('Only admin') ? msg : `User saved. Account access failed: ${msg || 'User must be linked (auth) to set account access.'}`
            );
          }
        }
      }

      // Trigger success callback to refresh list
      onSuccess();
      
      // Close modal
      onClose();
    } catch (error: any) {
      console.error('[ADD USER MODAL] Error saving user:', error);
      toast.error(error.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[650px] bg-gray-900 border-gray-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {editingUser ? 'Edit User' : 'Add New User'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {editingUser 
              ? 'Update user account details and permissions'
              : 'Create a new user account and assign roles'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Tabs: General | Branch Access | Account Access | Permissions */}
        <div className="flex gap-1 border-b border-gray-800 pb-2">
          {(['general', 'branches', 'accounts', 'permissions'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium rounded-t transition-colors ${
                activeTab === tab
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500 -mb-0.5'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {tab === 'general' && <><UserIcon size={14} className="inline mr-1" /> General</>}
              {tab === 'branches' && <><Building2 size={14} className="inline mr-1" /> Branch Access</>}
              {tab === 'accounts' && <><Wallet size={14} className="inline mr-1" /> Account Access</>}
              {tab === 'permissions' && <><Shield size={14} className="inline mr-1" /> Permissions</>}
            </button>
          ))}
        </div>

        <div className="space-y-6 py-4">
          {activeTab === 'general' && (
          <>
          {/* Step 1: Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
              <UserIcon size={18} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-200">Basic Information</h3>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-gray-200">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                className="bg-gray-950 border-gray-700 text-white focus:border-blue-500"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="bg-gray-950 border-gray-700 text-white focus:border-blue-500"
                required
                disabled={!!editingUser}
              />
              {editingUser && (
                <p className="text-xs text-gray-500">Email cannot be changed after creation</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-200">Phone (Optional)</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+92 300 1234567"
                className="bg-gray-950 border-gray-700 text-white focus:border-blue-500"
              />
            </div>

            {/* Login credentials (new users only) */}
            {!editingUser && (
              <div className="space-y-3 pt-2 border-t border-gray-800">
                <Label className="text-gray-200">Login Setup</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="passwordOption"
                      checked={formData.passwordOption === 'temp'}
                      onChange={() => setFormData({ ...formData, passwordOption: 'temp' })}
                      className="w-4 h-4 bg-gray-950 border-gray-700"
                    />
                    <span className="text-sm text-gray-300">Set temporary password</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="passwordOption"
                      checked={formData.passwordOption === 'invite'}
                      onChange={() => setFormData({ ...formData, passwordOption: 'invite' })}
                      className="w-4 h-4 bg-gray-950 border-gray-700"
                    />
                    <span className="text-sm text-gray-300">Send invite email</span>
                  </label>
                </div>
                {formData.passwordOption === 'temp' && (
                  <Input
                    type="password"
                    placeholder="Temporary password (min 6 chars)"
                    value={formData.temporary_password}
                    onChange={(e) => setFormData({ ...formData, temporary_password: e.target.value })}
                    className="bg-gray-950 border-gray-700 text-white focus:border-blue-500"
                  />
                )}
              </div>
            )}
          </div>

          {/* Step 2: Role & Permissions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
              <UserIcon size={18} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-200">Role & Permissions</h3>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role" className="text-gray-200">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) => {
                  setFormData({ ...formData, role: value });
                  // Apply role preset
                  const presets: Record<string, Partial<typeof formData.permissions>> = {
                    admin: {
                      canCreateSale: true, canEditSale: true, canDeleteSale: true,
                      canViewReports: true, canManageSettings: true, canManageUsers: true,
                      canAccessAccounting: true, canMakePayments: true, canReceivePayments: true,
                      canManageExpenses: true, canManageProducts: true, canManagePurchases: true,
                      canManageRentals: true,
                    },
                    manager: {
                      canCreateSale: true, canEditSale: true, canDeleteSale: false,
                      canViewReports: true, canManageSettings: false, canManageUsers: false,
                      canAccessAccounting: true, canMakePayments: true, canReceivePayments: true,
                      canManageExpenses: true, canManageProducts: true, canManagePurchases: true,
                      canManageRentals: true,
                    },
                    staff: {
                      canCreateSale: false, canEditSale: false, canDeleteSale: false,
                      canViewReports: false, canManageSettings: false, canManageUsers: false,
                      canAccessAccounting: false, canMakePayments: false, canReceivePayments: false,
                      canManageExpenses: false, canManageProducts: false, canManagePurchases: false,
                      canManageRentals: false,
                    },
                    salesman: {
                      canCreateSale: true, canEditSale: true, canDeleteSale: false,
                      canViewReports: true, canManageSettings: false, canManageUsers: false,
                      canAccessAccounting: false, canMakePayments: false, canReceivePayments: false,
                      canManageExpenses: false, canManageProducts: false, canManagePurchases: false,
                      canManageRentals: false,
                    },
                  };
                  if (presets[value]) {
                    setFormData(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, ...presets[value] },
                      can_be_assigned_as_salesman: value === 'salesman' ? true : prev.can_be_assigned_as_salesman,
                    }));
                  }
                }}
              >
                <SelectTrigger className="bg-gray-950 border-gray-700 text-white focus:border-blue-500">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="admin">Administrator (All Permissions)</SelectItem>
                  <SelectItem value="manager">Manager (Limited Admin)</SelectItem>
                  <SelectItem value="staff">Staff (Restricted)</SelectItem>
                  <SelectItem value="salesman">Salesman (Sales Only)</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="inventory">Inventory Clerk</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Selecting a role will auto-apply permission presets</p>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-4 bg-gray-950 border border-gray-800 rounded-lg">
              <div>
                <Label htmlFor="is_active" className="text-gray-200">Active Status</Label>
                <p className="text-xs text-gray-400">User can login and access system</p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Auth & Password (edit mode only) */}
            {editingUser && (
              <div className="space-y-3 p-4 bg-gray-950 border border-gray-800 rounded-lg">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
                  <Shield size={18} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-gray-200">Auth & Login</h3>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-2 text-gray-400">
                    <Shield size={14} />
                    {editingUser.auth_user_id ? 'Linked' : 'Not linked'}
                  </span>
                  {editingUser.last_login_at && (
                    <span className="flex items-center gap-2 text-gray-400">
                      <Clock size={14} />
                      Last login: {new Date(editingUser.last_login_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {editingUser.auth_user_id && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 border-gray-700 text-gray-300 hover:bg-gray-800"
                      onClick={async () => {
                        try {
                          await userService.sendResetEmail(editingUser!.id);
                          toast.success('Password reset email sent');
                        } catch (e: any) {
                          toast.error(e?.message || 'Failed to send');
                        }
                      }}
                    >
                      <Mail size={14} />
                      Send Reset Email
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 border-gray-700 text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        const p = prompt('Enter new temporary password (min 6 chars):');
                        if (p && p.length >= 6) {
                          userService.resetPassword(editingUser!.id, p).then(() => toast.success('Password updated')).catch((e: any) => toast.error(e?.message || 'Failed'));
                        } else if (p !== null) toast.error('Password must be at least 6 characters');
                      }}
                    >
                      <Key size={14} />
                      Reset Password
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          </>
          )}

          {activeTab === 'branches' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
                <Building2 size={18} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-200">Branch Access</h3>
              </div>
              <p className="text-xs text-gray-500">Select which branches this user can access. Admin sees all branches.</p>
              {loadingAccess ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {branches.length === 0 ? (
                    <p className="text-sm text-gray-500">No branches in company. Create branches in Settings → Company.</p>
                  ) : (
                    branches.map((b) => (
                      <div key={b.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`branch-${b.id}`}
                          checked={selectedBranchIds.includes(b.id)}
                          onCheckedChange={(checked) => {
                            setSelectedBranchIds((prev) =>
                              checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)
                            );
                          }}
                        />
                        <Label htmlFor={`branch-${b.id}`} className="text-sm text-gray-300 cursor-pointer">
                          {b.name} {b.code ? `(${b.code})` : ''}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
                <Wallet size={18} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-gray-200">Account Access</h3>
              </div>
              <p className="text-xs text-gray-500">Select which accounts this user can use (e.g. for receiving payments). Admin sees all accounts.</p>
              {loadingAccess ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {accounts.length === 0 ? (
                    <p className="text-sm text-gray-500">No accounts. Create accounts in Settings → Accounting.</p>
                  ) : (
                    accounts.map((a) => (
                      <div key={a.id!} className="flex items-center space-x-2">
                        <Checkbox
                          id={`account-${a.id}`}
                          checked={selectedAccountIds.includes(a.id!)}
                          onCheckedChange={(checked) => {
                            setSelectedAccountIds((prev) =>
                              checked ? [...prev, a.id!] : prev.filter((id) => id !== a.id)
                            );
                          }}
                        />
                        <Label htmlFor={`account-${a.id}`} className="text-sm text-gray-300 cursor-pointer">
                          {a.code ? `${a.code} – ` : ''}{a.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'permissions' && (
          <>
            {/* Can Be Assigned As Salesman */}
            <div className="flex items-center justify-between p-4 bg-gray-950 border border-gray-800 rounded-lg">
              <div>
                <Label htmlFor="can_be_salesman" className="text-gray-200">Can Be Assigned As Salesman</Label>
                <p className="text-xs text-gray-400">Appears in Salesman dropdown in Sale forms</p>
              </div>
              <Switch
                id="can_be_salesman"
                checked={formData.can_be_assigned_as_salesman}
                onCheckedChange={(checked) => {
                  setFormData({
                    ...formData,
                    can_be_assigned_as_salesman: checked,
                    permissions: {
                      ...formData.permissions,
                      canCreateSale: checked ? true : formData.permissions.canCreateSale
                    }
                  });
                }}
              />
            </div>

            {/* Permissions - Grouped by Modules */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-200 font-medium">Permissions</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allTrue: Record<string, boolean> = {
                        canCreateSale: true, canEditSale: true, canDeleteSale: true,
                        canViewReports: true, canManageSettings: true, canManageUsers: true,
                        canAccessAccounting: true, canMakePayments: true, canReceivePayments: true,
                        canManageExpenses: true, canManageProducts: true, canManagePurchases: true,
                        canManageRentals: true,
                      };
                      setFormData(prev => ({ ...prev, permissions: { ...prev.permissions, ...allTrue } }));
                    }}
                    className="text-xs h-7 border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allFalse: Record<string, boolean> = {
                        canCreateSale: false, canEditSale: false, canDeleteSale: false,
                        canViewReports: false, canManageSettings: false, canManageUsers: false,
                        canAccessAccounting: false, canMakePayments: false, canReceivePayments: false,
                        canManageExpenses: false, canManageProducts: false, canManagePurchases: false,
                        canManageRentals: false,
                      };
                      setFormData(prev => ({ ...prev, permissions: { ...prev.permissions, ...allFalse } }));
                    }}
                    className="text-xs h-7 border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              {/* Sales Module */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
                <Label className="text-gray-200 font-semibold text-sm mb-2 block">Sales</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'canCreateSale', label: 'Create Sales' },
                    { key: 'canEditSale', label: 'Edit Sales' },
                    { key: 'canDeleteSale', label: 'Delete Sales' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions] as boolean}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: checked as boolean
                            }
                          });
                        }}
                      />
                      <Label htmlFor={perm.key} className="text-sm text-gray-300 cursor-pointer">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accounting Module */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
                <Label className="text-gray-200 font-semibold text-sm mb-2 block">Accounting</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'canAccessAccounting', label: 'Access Accounting' },
                    { key: 'canMakePayments', label: 'Make Payments' },
                    { key: 'canReceivePayments', label: 'Receive Payments' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions] as boolean}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: checked as boolean
                            }
                          });
                        }}
                      />
                      <Label htmlFor={perm.key} className="text-sm text-gray-300 cursor-pointer">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expenses Module */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
                <Label className="text-gray-200 font-semibold text-sm mb-2 block">Expenses</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'canManageExpenses', label: 'Manage Expenses' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions] as boolean}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: checked as boolean
                            }
                          });
                        }}
                      />
                      <Label htmlFor={perm.key} className="text-sm text-gray-300 cursor-pointer">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Products Module */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
                <Label className="text-gray-200 font-semibold text-sm mb-2 block">Products</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'canManageProducts', label: 'Manage Products' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions] as boolean}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: checked as boolean
                            }
                          });
                        }}
                      />
                      <Label htmlFor={perm.key} className="text-sm text-gray-300 cursor-pointer">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purchases Module */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
                <Label className="text-gray-200 font-semibold text-sm mb-2 block">Purchases</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'canManagePurchases', label: 'Manage Purchases' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions] as boolean}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: checked as boolean
                            }
                          });
                        }}
                      />
                      <Label htmlFor={perm.key} className="text-sm text-gray-300 cursor-pointer">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reports Module */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
                <Label className="text-gray-200 font-semibold text-sm mb-2 block">Reports</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'canViewReports', label: 'View Reports' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions] as boolean}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: checked as boolean
                            }
                          });
                        }}
                      />
                      <Label htmlFor={perm.key} className="text-sm text-gray-300 cursor-pointer">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings & Users Module */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
                <Label className="text-gray-200 font-semibold text-sm mb-2 block">Settings & Users</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'canManageSettings', label: 'Manage Settings' },
                    { key: 'canManageUsers', label: 'Manage Users' },
                  ].map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions] as boolean}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: checked as boolean
                            }
                          });
                        }}
                      />
                      <Label htmlFor={perm.key} className="text-sm text-gray-300 cursor-pointer">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
            disabled={saving}
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
