import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Save, RefreshCw, FlaskConical } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import {
  permissionService,
  type EngineRole,
  type RolePermissionRow,
  getActionsForModule,
  PERMISSION_MODULES,
} from '@/app/services/permissionService';
import { useFeatureFlagOptional } from '@/app/context/FeatureFlagContext';
import { toast } from 'sonner';

const ENGINE_ROLES: { id: EngineRole; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'user', label: 'User (Salesman)' },
];

export function PermissionManagementPanel() {
  const { permissionV2, setPermissionV2 } = useFeatureFlagOptional();
  const [selectedRole, setSelectedRole] = useState<EngineRole>('manager');
  const [perms, setPerms] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async (role: EngineRole) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await permissionService.getRolePermissions(role);
      setPerms(data);
    } catch (e: any) {
      const msg = e?.message || 'Failed to load permissions';
      setLoadError(msg);
      toast.error(msg);
      setPerms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedRole);
  }, [selectedRole, load]);

  const getAllowed = (module: string, action: string) => {
    const r = perms.find(p => p.module === module && p.action === action);
    return r?.allowed ?? false;
  };

  const setAllowed = (module: string, action: string, allowed: boolean) => {
    setPerms(prev => {
      const rest = prev.filter(p => !(p.module === module && p.action === action));
      return [...rest, { role: selectedRole, module, action, allowed }];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { module: string; action: string; allowed: boolean }[] = [];
      PERMISSION_MODULES.forEach(module => {
        getActionsForModule(module).forEach(action => {
          updates.push({ module, action, allowed: getAllowed(module, action) });
        });
      });
      await permissionService.setRolePermissionsBulk(selectedRole, updates);
      toast.success('Permissions saved');
      load(selectedRole);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isTableMissing = loadError?.toLowerCase().includes('role_permissions') ?? false;

  if (loading && perms.length === 0 && !loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <Shield className="text-amber-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Permission Management</h3>
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (isTableMissing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <Shield className="text-amber-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Permission Management</h3>
            <p className="text-sm text-gray-400">Table missing — run migration below</p>
          </div>
        </div>
        <div className="bg-gray-950 p-4 rounded-lg border border-amber-500/30 text-amber-200/90">
          <p className="font-medium mb-2">Could not find the table &quot;public.role_permissions&quot;</p>
          <p className="text-sm text-gray-400 mb-3">Run this in Supabase → SQL Editor to create the table and seed data:</p>
          <p className="text-xs text-gray-500 font-mono break-all">migrations/erp_permission_architecture_replica/01_role_permissions_table_and_seed.sql</p>
          <p className="text-sm text-gray-400 mt-2">Then refresh this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* When V2 is off, show toggle so user can turn it on and see "User Permissions" tab */}
      {!permissionV2 && (
        <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="text-blue-500" size={20} />
            <div>
              <p className="text-white font-medium">Use Permission V2</p>
              <p className="text-sm text-gray-400">Turn on to see the &quot;User Permissions&quot; tab (matrix + branch access)</p>
            </div>
          </div>
          <Switch checked={false} onCheckedChange={(v) => setPermissionV2(!!v)} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <Shield className="text-amber-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Permission Management</h3>
            <p className="text-sm text-gray-400">Role-based module and action permissions (owner/admin only)</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
          <Save size={16} /> Save
        </Button>
      </div>

      {/* Role Editor */}
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
        <Label className="text-gray-300 mb-2 block">Role</Label>
        <div className="flex flex-wrap gap-2">
          {ENGINE_ROLES.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedRole === r.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Owner and Admin have full access regardless of toggles. Changes apply to Manager and User.
        </p>
      </div>

      {/* Sales Visibility */}
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
        <h4 className="text-white font-medium mb-3">Sales Visibility</h4>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('sales', 'view_own')}
              onCheckedChange={v => setAllowed('sales', 'view_own', v)}
            />
            <span className="text-gray-300">Own only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('sales', 'view_branch')}
              onCheckedChange={v => setAllowed('sales', 'view_branch', v)}
            />
            <span className="text-gray-300">Branch</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('sales', 'view_company')}
              onCheckedChange={v => setAllowed('sales', 'view_company', v)}
            />
            <span className="text-gray-300">Company</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={getAllowed('sales', 'create')} onCheckedChange={v => setAllowed('sales', 'create', v)} />
            <span className="text-gray-400 text-sm">Create</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={getAllowed('sales', 'edit')} onCheckedChange={v => setAllowed('sales', 'edit', v)} />
            <span className="text-gray-400 text-sm">Edit</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={getAllowed('sales', 'delete')} onCheckedChange={v => setAllowed('sales', 'delete', v)} />
            <span className="text-gray-400 text-sm">Delete</span>
          </label>
        </div>
      </div>

      {/* Payment Permissions */}
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
        <h4 className="text-white font-medium mb-3">Payment Permissions</h4>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('payments', 'receive')}
              onCheckedChange={v => setAllowed('payments', 'receive', v)}
            />
            <span className="text-gray-300">Can receive</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('payments', 'edit')}
              onCheckedChange={v => setAllowed('payments', 'edit', v)}
            />
            <span className="text-gray-300">Can edit</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('payments', 'delete')}
              onCheckedChange={v => setAllowed('payments', 'delete', v)}
            />
            <span className="text-gray-300">Can delete</span>
          </label>
        </div>
      </div>

      {/* Ledger Permissions */}
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
        <h4 className="text-white font-medium mb-3">Ledger Permissions</h4>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('ledger', 'view_customer')}
              onCheckedChange={v => setAllowed('ledger', 'view_customer', v)}
            />
            <span className="text-gray-300">View customer ledger</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('ledger', 'view_supplier')}
              onCheckedChange={v => setAllowed('ledger', 'view_supplier', v)}
            />
            <span className="text-gray-300">View supplier ledger</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={getAllowed('ledger', 'view_full_accounting')}
              onCheckedChange={v => setAllowed('ledger', 'view_full_accounting', v)}
            />
            <span className="text-gray-300">View full accounting</span>
          </label>
        </div>
      </div>

      {/* Other modules (collapsed) */}
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
        <h4 className="text-white font-medium mb-3">Other Modules</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {PERMISSION_MODULES.filter(m => !['sales', 'payments', 'ledger'].includes(m)).map(module => (
            <div key={module} className="flex flex-wrap gap-2 items-center">
              <span className="text-gray-400 capitalize w-24">{module}</span>
              {getActionsForModule(module).map(action => (
                <label key={action} className="flex items-center gap-1 cursor-pointer">
                  <Switch
                    checked={getAllowed(module, action)}
                    onCheckedChange={v => setAllowed(module, action, v)}
                  />
                  <span className="text-gray-500">{action.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Account Access (branch and account assignment) is managed in User Management per user.
      </p>
    </div>
  );
}
