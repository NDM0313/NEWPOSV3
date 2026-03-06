import React, { useState, useEffect } from 'react';
import { Crown, Shield, Briefcase, ShoppingCart, Info, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { permissionService, PERMISSION_MODULES, getActionsForModule, type EngineRole, MODULES_WITH_VISIBILITY_SCOPE, VISIBILITY_SCOPE_ACTIONS } from '@/app/services/permissionService';
import { branchService, type BranchAccessMode } from '@/app/services/branchService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { cn } from '../ui/utils';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

const ENGINE_ROLES: { id: EngineRole; label: string; icon: typeof Crown }[] = [
  { id: 'owner', label: 'OWNER', icon: Crown },
  { id: 'admin', label: 'ADMIN', icon: Shield },
  { id: 'manager', label: 'MANAGER', icon: Briefcase },
  { id: 'user', label: 'SALESMAN', icon: ShoppingCart },
];

const MODULE_ORDER: string[] = [
  'sales', 'pos', 'purchase', 'studio', 'rentals', 'payments',
  'ledger', 'inventory', 'contacts', 'reports', 'users', 'settings',
];

const MODULE_LABELS: Record<string, string> = {
  sales: 'Sales',
  pos: 'POS',
  purchase: 'Purchase',
  studio: 'Studio',
  rentals: 'Rentals',
  payments: 'Payments',
  ledger: 'Accounting',
  inventory: 'Inventory',
  contacts: 'Contacts',
  reports: 'Reports',
  users: 'Users',
  settings: 'Settings',
};

const ACTION_LABELS: Record<string, string> = {
  view_own: 'View own records only',
  view_branch: 'View branch records',
  view_company: 'View company-wide',
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  use: 'Use',
  receive: 'Receive payments',
  view_customer: 'View Customer Ledger',
  view_supplier: 'View Supplier Ledger',
  view_full_accounting: 'View Full Accounting',
  adjust: 'Adjust stock',
  transfer: 'Transfer stock',
  modify: 'Modify settings',
  assign_permissions: 'Assign permissions',
};

/** Visibility scope: mutually exclusive per module (OWN | BRANCH | COMPANY). */
const VISIBILITY_SCOPE_CARDS: { value: string; title: string; description: string }[] = [
  { value: 'view_own', title: 'Own sales only', description: 'Only records created by this user' },
  { value: 'view_branch', title: 'Assigned branches', description: 'All records in user’s assigned branches' },
  { value: 'view_company', title: 'Full company', description: 'Full company sales access' },
];

export function MatrixTab() {
  const { companyId } = useSupabase();
  const [selectedRole, setSelectedRole] = useState<EngineRole>('user');
  const [perms, setPerms] = useState<{ module: string; action: string; allowed: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openModules, setOpenModules] = useState<string[]>([]);
  const [branchCount, setBranchCount] = useState<number>(0);
  const [branchMode, setBranchMode] = useState<BranchAccessMode | null>(null);

  useEffect(() => {
    if (!companyId) return;
    branchService.getCompanyBranchCount(companyId).then((count) => {
      setBranchCount(count);
      setBranchMode(count <= 1 ? 'AUTO' : 'RESTRICTED');
    }).catch(() => { setBranchCount(0); setBranchMode(null); });
  }, [companyId]);

  const load = async (role: EngineRole) => {
    setLoading(true);
    try {
      const data = await permissionService.getRolePermissions(role);
      setPerms(data.map((p) => ({ module: p.module, action: p.action, allowed: p.allowed })));
    } catch (e) {
      setPerms([]);
      toast.error(e instanceof Error ? e.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(selectedRole);
  }, [selectedRole]);

  useEffect(() => {
    if (loading) return;
    const enabled = MODULE_ORDER.filter((m) =>
      getActionsForModule(m).some((a) => perms.some((p) => p.module === m && p.action === a && p.allowed))
    );
    setOpenModules(enabled);
  }, [loading, perms]);

  const getAllowed = (module: string, action: string) =>
    perms.some((p) => p.module === module && p.action === action && p.allowed);

  const setAllowed = async (module: string, action: string, allowed: boolean) => {
    const prevAllowed = getAllowed(module, action);
    setSaving(true);
    try {
      await permissionService.setRolePermission(selectedRole, module, action, allowed);
      setPerms((prev) => {
        const rest = prev.filter((p) => !(p.module === module && p.action === action));
        return [...rest, { module, action, allowed }];
      });
      toast.success(allowed ? 'Permission allowed' : 'Permission denied');
    } catch (e) {
      setPerms((prev) => {
        const rest = prev.filter((p) => !(p.module === module && p.action === action));
        return [...rest, { module, action, allowed: prevAllowed }];
      });
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isModuleEnabled = (module: string) => {
    const actions = getActionsForModule(module);
    return actions.some((a) => getAllowed(module, a));
  };

  const setModuleEnabled = async (module: string, enabled: boolean) => {
    const actions = getActionsForModule(module);
    setSaving(true);
    try {
      if (enabled) {
        const defaultAction = (MODULES_WITH_VISIBILITY_SCOPE as readonly string[]).includes(module) ? 'view_own' : actions[0];
        await permissionService.setRolePermission(selectedRole, module, defaultAction, true);
        setPerms((prev) => {
          const rest = prev.filter((p) => !(p.module === module && p.action === defaultAction));
          return [...rest, { module, action: defaultAction, allowed: true }];
        });
        setOpenModules((o) => (o.includes(module) ? o : [...o, module]));
      } else {
        for (const action of actions) {
          await permissionService.setRolePermission(selectedRole, module, action, false);
        }
        setPerms((prev) => {
          const rest = prev.filter((p) => p.module !== module);
          return [...rest, ...actions.map((a) => ({ module, action: a, allowed: false }))];
        });
        setOpenModules((o) => o.filter((m) => m !== module));
      }
      toast.success(enabled ? `${MODULE_LABELS[module]} enabled` : `${MODULE_LABELS[module]} disabled`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const setVisibilityScope = async (module: string, scope: string) => {
    setSaving(true);
    try {
      for (const a of VISIBILITY_SCOPE_ACTIONS) {
        await permissionService.setRolePermission(selectedRole, module, a, a === scope);
      }
      setPerms((prev) => {
        const rest = prev.filter((p) => !(p.module === module && (VISIBILITY_SCOPE_ACTIONS as readonly string[]).includes(p.action)));
        const newScopes = [...VISIBILITY_SCOPE_ACTIONS].map((a) => ({ module, action: a, allowed: a === scope }));
        return [...rest, ...newScopes];
      });
      toast.success('Visibility scope updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getCurrentVisibilityScope = (module: string) => {
    for (const s of VISIBILITY_SCOPE_ACTIONS) if (getAllowed(module, s)) return s;
    return 'view_own';
  };

  const toggleOpen = (module: string) => {
    setOpenModules((o) => (o.includes(module) ? o.filter((m) => m !== module) : [...o, module]));
  };

  const totalAllowed = perms.filter((p) => p.allowed).length;
  const totalDenied = perms.filter((p) => !p.allowed).length;
  const ratio = perms.length ? Math.round((totalAllowed / perms.length) * 100) : 0;
  const selectedMeta = ENGINE_ROLES.find((r) => r.id === selectedRole);
  const desc =
    selectedRole === 'owner'
      ? 'Full company access, all branches, all modules'
      : selectedRole === 'admin'
        ? 'Full company access, can manage users, configure system'
        : selectedRole === 'manager'
          ? 'Specific branches, view all sales, view ledger'
          : 'Only assigned branches, configurable sales view, can receive payments';

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">Permissions</h2>
        <div className="p-8 text-center text-gray-400">Loading permissions…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Permissions by module</h2>
        <p className="text-gray-400 text-sm mt-1">Enable modules and set actions per role. No database structure change.</p>
      </div>

      <div>
        <p className="text-sm text-gray-400 mb-2">Select role to edit</p>
        <div className="flex flex-wrap gap-2">
          {ENGINE_ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                selectedRole === r.id
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
              )}
            >
              <r.icon size={16} />
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 flex items-center gap-3">
        {selectedMeta && <selectedMeta.icon className="text-amber-500 shrink-0" size={24} />}
        <div>
          <p className="font-semibold text-white">{selectedMeta?.label}</p>
          <p className="text-sm text-gray-400">{desc}</p>
        </div>
      </div>

      {/* Module accordion */}
      <div className="space-y-2">
        {MODULE_ORDER.map((module) => {
          const actions = getActionsForModule(module);
          const enabled = isModuleEnabled(module);
          const open = openModules.includes(module);

          return (
            <React.Fragment key={module}>
            <div
              className={cn(
                'rounded-lg border transition-colors',
                enabled ? 'border-gray-600 bg-gray-800/40' : 'border-gray-800 bg-gray-900/40'
              )}
            >
              <div className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => toggleOpen(module)}
                  className="p-1 rounded text-gray-400 hover:text-white shrink-0"
                  aria-expanded={open}
                >
                  {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{MODULE_LABELS[module] ?? module}</p>
                  <p className="text-xs text-gray-500">
                    {enabled ? `${actions.filter((a) => getAllowed(module, a)).length} of ${actions.length} actions allowed` : 'Module disabled'}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => setModuleEnabled(module, checked)}
                  disabled={saving}
                  className="shrink-0"
                />
              </div>

              {open && (
                <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                  {(MODULES_WITH_VISIBILITY_SCOPE as readonly string[]).includes(module) && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 text-sm font-medium mb-2 block">Visibility (one scope)</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                          {VISIBILITY_SCOPE_CARDS.map((card) => {
                            const selected = getCurrentVisibilityScope(module) === card.value;
                            return (
                              <button
                                key={card.value}
                                type="button"
                                onClick={() => !saving && setVisibilityScope(module, card.value)}
                                disabled={saving}
                                className={cn(
                                  'rounded-lg border p-3 text-left transition-all',
                                  selected
                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30 shadow shadow-blue-500/10'
                                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 text-gray-300'
                                )}
                              >
                                <p className={cn('font-medium text-sm', selected ? 'text-blue-300' : 'text-white')}>
                                  {card.title}
                                </p>
                                <p className="text-xs mt-1 text-gray-500">{card.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm font-medium">Actions</Label>
                        <div className="mt-2 flex flex-wrap gap-6">
                          {actions.filter((a) => (VISIBILITY_SCOPE_ACTIONS as readonly string[]).indexOf(a) < 0).map((action) => (
                            <div key={action} className="flex items-center gap-2">
                              <Checkbox
                                id={`${module}-${action}`}
                                checked={getAllowed(module, action)}
                                onCheckedChange={(c) => setAllowed(module, action, c === true)}
                                disabled={saving}
                              />
                              <Label htmlFor={`${module}-${action}`} className="text-gray-300 text-sm font-normal cursor-pointer">
                                {ACTION_LABELS[action] ?? action.replace(/_/g, ' ')}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {!(MODULES_WITH_VISIBILITY_SCOPE as readonly string[]).includes(module) && (
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-sm font-medium">Actions</Label>
                      <div className="mt-2 flex flex-wrap gap-6">
                        {actions.map((action) => (
                          <div key={action} className="flex items-center gap-2">
                            <Checkbox
                              id={`${module}-${action}`}
                              checked={getAllowed(module, action)}
                              onCheckedChange={(c) => setAllowed(module, action, c === true)}
                              disabled={saving}
                            />
                            <Label htmlFor={`${module}-${action}`} className="text-gray-300 text-sm font-normal cursor-pointer">
                              {ACTION_LABELS[action] ?? action.replace(/_/g, ' ')}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Branch Access Section (below Sales) */}
            {module === 'sales' && (
              <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
                  <Building2 size={18} className="text-blue-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-200">Branch Access</h3>
                </div>
                <div className="pt-3 space-y-2">
                  <p className="text-xs text-gray-500">Branch selection depends on company branch count. Per-user assignment in <strong>Users</strong> tab.</p>
                  {branchMode === 'AUTO' && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">AUTO</span>
                      <span><strong>Auto (Single Branch Company)</strong> — One branch; automatically assigned. user_branches not required.</span>
                    </div>
                  )}
                  {branchMode === 'RESTRICTED' && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">R</span>
                      <span><strong>Restricted (Multi Branch Company)</strong> — {branchCount} branches; assign per user in Users tab. user_branches required.</span>
                    </div>
                  )}
                  {branchMode === null && branchCount === 0 && (
                    <p className="text-sm text-gray-500">Company branch count: 0 (create branches in Settings).</p>
                  )}
                </div>
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
          <p className="text-xs text-gray-400">Allowed</p>
          <p className="text-xl font-bold text-green-500">{totalAllowed}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          <p className="text-xs text-gray-400">Denied</p>
          <p className="text-xl font-bold text-red-500">{totalDenied}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-2">
          <p className="text-xs text-gray-400">Ratio</p>
          <p className="text-xl font-bold text-purple-500">{ratio}%</p>
        </div>
      </div>

      <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-4 max-w-2xl">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-2">
          <Info className="text-blue-400 shrink-0" size={18} /> How to change access
        </h3>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>Select a role above, then turn <strong>Enable Module</strong> on for each module this role may use.</li>
          <li>Expand a module to set view scope (Sales) or individual actions (Accounting, Inventory, etc.).</li>
          <li>Changes save immediately. Owner/Admin get full access regardless of this matrix.</li>
        </ul>
      </div>
    </div>
  );
}
