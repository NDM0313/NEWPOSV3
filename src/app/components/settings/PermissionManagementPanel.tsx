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
  MODULES_WITH_VISIBILITY_SCOPE,
  VISIBILITY_SCOPE_ACTIONS,
  type VisibilityScopeAction,
} from '@/app/services/permissionService';
import { useFeatureFlagOptional } from '@/app/context/FeatureFlagContext';
import { toast } from 'sonner';

const ENGINE_ROLES: { id: EngineRole; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'user', label: 'User (Salesman)' },
];

/** Visibility scope: mutually exclusive per module. Priority company > branch > own. */
const VISIBILITY_OPTIONS: { value: VisibilityScopeAction; label: string }[] = [
  { value: 'view_own', label: 'Own records only' },
  { value: 'view_branch', label: 'Assigned branches' },
  { value: 'view_company', label: 'Full company' },
];

const MODULE_LABELS: Record<string, string> = {
  sales: 'Sales',
  purchase: 'Purchase',
  inventory: 'Inventory',
  contacts: 'Contacts',
  ledger: 'Accounting (Ledger)',
  studio: 'Studio',
  rentals: 'Rentals',
  payments: 'Payments',
};

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
      const normalized = data.map((p) => {
        if (!(MODULES_WITH_VISIBILITY_SCOPE as readonly string[]).includes(p.module) || !(VISIBILITY_SCOPE_ACTIONS as readonly string[]).includes(p.action)) return p;
        const viewCompany = data.some((x) => x.module === p.module && x.action === 'view_company' && x.allowed);
        const viewBranch = data.some((x) => x.module === p.module && x.action === 'view_branch' && x.allowed);
        const viewOwn = data.some((x) => x.module === p.module && x.action === 'view_own' && x.allowed);
        const only: VisibilityScopeAction = viewCompany ? 'view_company' : viewBranch ? 'view_branch' : 'view_own';
        return { ...p, allowed: p.action === only };
      });
      setPerms(normalized);
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

  /** Effective visibility scope for a module (mutually exclusive). Priority company > branch > own. */
  const getVisibilityScope = (module: string): VisibilityScopeAction => {
    if (getAllowed(module, 'view_company')) return 'view_company';
    if (getAllowed(module, 'view_branch')) return 'view_branch';
    if (getAllowed(module, 'view_own')) return 'view_own';
    return 'view_own';
  };

  const setVisibilityScope = (module: string, scope: VisibilityScopeAction) => {
    setPerms(prev => {
      const withoutScopes = prev.filter(
        p => !(p.module === module && (VISIBILITY_SCOPE_ACTIONS as readonly string[]).includes(p.action))
      );
      const newScopes = [...VISIBILITY_SCOPE_ACTIONS].map(a => ({
        role: selectedRole,
        module,
        action: a,
        allowed: a === scope,
      }));
      return [...withoutScopes, ...newScopes];
    });
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

      {/* Visibility-scope modules: each has Visibility (radio) + Actions */}
      {MODULES_WITH_VISIBILITY_SCOPE.map(module => {
        const actions = getActionsForModule(module).filter(a => !(VISIBILITY_SCOPE_ACTIONS as readonly string[]).includes(a));
        return (
          <div key={module} className="bg-gray-950 p-4 rounded-lg border border-gray-800">
            <h4 className="text-white font-medium mb-3">{MODULE_LABELS[module] ?? module}</h4>
            <p className="text-xs text-gray-500 mb-3">Visibility: only one scope applies (which records this role can see).</p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={`${module} visibility`}>
              {VISIBILITY_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name={`${module}-visibility`}
                    checked={getVisibilityScope(module) === opt.value}
                    onChange={() => setVisibilityScope(module, opt.value)}
                    className="rounded-full border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>
            {actions.length > 0 && (
              <>
                <h4 className="text-white font-medium mt-4 mb-2">Actions</h4>
                <div className="flex flex-wrap gap-4">
                  {actions.map(action => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={getAllowed(module, action)}
                        onCheckedChange={v => setAllowed(module, action, v)}
                      />
                      <span className="text-gray-400 text-sm">{action.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Other modules (no visibility scope) */}
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
        <h4 className="text-white font-medium mb-3">Other Modules</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {PERMISSION_MODULES.filter(m => !(MODULES_WITH_VISIBILITY_SCOPE as readonly string[]).includes(m)).map(module => (
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
