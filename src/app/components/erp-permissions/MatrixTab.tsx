import React, { useState, useEffect } from 'react';
import { Crown, Shield, Briefcase, ShoppingCart, Check, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { permissionService, PERMISSION_MODULES, getActionsForModule, type EngineRole } from '@/app/services/permissionService';
import { cn } from '../ui/utils';

const ENGINE_ROLES: { id: EngineRole; label: string; icon: typeof Crown }[] = [
  { id: 'owner', label: 'OWNER', icon: Crown },
  { id: 'admin', label: 'ADMIN', icon: Shield },
  { id: 'manager', label: 'MANAGER', icon: Briefcase },
  { id: 'user', label: 'SALESMAN', icon: ShoppingCart },
];

const MODULE_LABELS: Record<string, string> = {
  sales: 'SALES',
  pos: 'POS',
  purchase: 'PURCHASE',
  studio: 'STUDIO',
  rentals: 'RENTALS',
  payments: 'PAYMENTS',
  ledger: 'LEDGER',
  inventory: 'INVENTORY',
  contacts: 'CONTACTS',
  reports: 'REPORTS',
  users: 'USERS',
  settings: 'SETTINGS',
};

export function MatrixTab() {
  const [selectedRole, setSelectedRole] = useState<EngineRole>('user');
  const [perms, setPerms] = useState<{ module: string; action: string; allowed: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
      toast.success(allowed ? `${MODULE_LABELS[module] ?? module}: ${action.replace(/_/g, ' ')} allowed` : `${MODULE_LABELS[module] ?? module}: ${action.replace(/_/g, ' ')} denied`);
    } catch (e) {
      setPerms((prev) => {
        const rest = prev.filter((p) => !(p.module === module && p.action === action));
        return [...rest, { module, action, allowed: prevAllowed }];
      });
      toast.error(e instanceof Error ? e.message : 'Failed to save permission');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Permissions Matrix</h2>
        <p className="text-gray-400 text-sm mt-1">Toggle permissions for each role and module</p>
      </div>

      {/* Select Role to Edit */}
      <div>
        <p className="text-sm text-gray-400 mb-2">Select Role to Edit</p>
        <div className="flex gap-2">
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

      {/* Selected role description */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 flex items-center gap-3">
        {selectedMeta && <selectedMeta.icon className="text-amber-500" size={24} />}
        <div>
          <p className="font-semibold text-white">{selectedMeta?.label}</p>
          <p className="text-sm text-gray-400">{desc}</p>
        </div>
      </div>

      {/* Matrix table */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-400">Loading permissions…</div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50">
                <th className="text-left text-gray-400 font-medium p-3 w-28">Module</th>
                {Array.from(new Set(PERMISSION_MODULES.flatMap((m) => getActionsForModule(m)))).map((a) => (
                  <th key={a} className="text-center text-gray-400 font-medium p-2 min-w-[4rem]">{a.replace(/_/g, ' ').toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map((module) => {
                const actions = getActionsForModule(module);
                const allActions = Array.from(new Set(PERMISSION_MODULES.flatMap((m) => getActionsForModule(m))));
                return (
                  <tr key={module} className="border-b border-gray-800">
                    <td className="p-3 text-gray-300 font-medium">{MODULE_LABELS[module] ?? module.toUpperCase()}</td>
                    {allActions.map((action) => {
                      if (!actions.includes(action)) return <td key={action} className="p-2" />;
                      return (
                        <td key={action} className="p-2 text-center">
                          <button type="button" onClick={() => setAllowed(module, action, !getAllowed(module, action))} disabled={saving} className={cn('w-8 h-8 rounded flex items-center justify-center transition-colors mx-auto', getAllowed(module, action) ? 'bg-green-500/20 text-green-500' : 'bg-gray-800 text-gray-500')}>
                            {getAllowed(module, action) ? <Check size={16} /> : <X size={14} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
          <p className="text-xs text-gray-400">Total Allowed</p>
          <p className="text-xl font-bold text-green-500">{totalAllowed}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          <p className="text-xs text-gray-400">Total Denied</p>
          <p className="text-xl font-bold text-red-500">{totalDenied}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-2">
          <p className="text-xs text-gray-400">Permission Ratio</p>
          <p className="text-xl font-bold text-purple-500">{ratio}%</p>
        </div>
      </div>

      {/* How to give someone more access */}
      <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-4 max-w-2xl">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-2">
          <Info className="text-blue-400" size={18} /> Kisi ko zyada access dene ke liye
        </h3>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li><strong>Role change:</strong> <span className="text-gray-400">Users tab mein jao → us user ko Edit karo → Role (e.g. SALESMAN → MANAGER ya ADMIN) change karo. Us role ke mutabiq permissions auto lagenge.</span></li>
          <li><strong>Isi role mein extra actions:</strong> <span className="text-gray-400">Yahan Matrix mein upar role select karo (e.g. SALESMAN) → jis module/action ko allow karna hai us cell par click karo (✓ green = allowed). Save automatic hota hai.</span></li>
        </ul>
        <p className="text-xs text-gray-500 mt-2">Owner/Admin ko app full access deta hai; Matrix sirf role-based fine control ke liye hai.</p>
      </div>
    </div>
  );
}
