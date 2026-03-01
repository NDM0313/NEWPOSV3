import React, { useState, useEffect } from 'react';
import { Crown, Shield, Briefcase, ShoppingCart, Check, X } from 'lucide-react';
import { permissionService } from '@/app/services/permissionService';
import { userService } from '@/app/services/userService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { cn } from '../ui/utils';

const ROLES = [
  { id: 'owner', label: 'OWNER', icon: Crown, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { id: 'admin', label: 'ADMIN', icon: Shield, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'manager', label: 'MANAGER', icon: Briefcase, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'user', label: 'SALESMAN', icon: ShoppingCart, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

const CAPS: [string, string, string][] = [
  ['Full Company Access', 'sales', 'view_company'],
  ['All Branches Access', 'sales', 'view_branch'],
  ['Manage Users', 'users', 'edit'],
  ['Configure System', 'settings', 'modify'],
  ['View All Sales', 'sales', 'view_branch'],
  ['View Ledger', 'ledger', 'view_customer'],
  ['Receive Payment', 'payments', 'receive'],
  ['Delete Records', 'sales', 'delete'],
];

export function RolesTab() {
  const { companyId } = useSupabase();
  const [permsByRole, setPermsByRole] = useState<Record<string, { module: string; action: string; allowed: boolean }[]>>({});
  const [userCount, setUserCount] = useState<Record<string, number>>({});

  useEffect(() => {
    permissionService.getAllRolePermissions().then((all) => {
      const by: Record<string, { module: string; action: string; allowed: boolean }[]> = {};
      all.forEach((p) => {
        if (!by[p.role]) by[p.role] = [];
        by[p.role].push({ module: p.module, action: p.action, allowed: p.allowed });
      });
      setPermsByRole(by);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!companyId) return;
    userService.getAllUsers(companyId, { includeInactive: false }).then((users) => {
      const by: Record<string, number> = {};
      (users || []).forEach((u) => {
        const r = (u.role || 'user').toLowerCase();
        const k = r === 'salesman' ? 'user' : r;
        by[k] = (by[k] ?? 0) + 1;
      });
      setUserCount(by);
    });
  }, [companyId]);

  const has = (role: string, mod: string, act: string) =>
    (permsByRole[role] ?? []).some((p) => p.module === mod && p.action === act && p.allowed);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">Roles Management</h2>
        <p className="text-gray-400 text-sm mt-1">Configure role capabilities and access levels</p>
      </div>
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="text-left text-gray-400 font-medium p-4">Capability</th>
              {ROLES.map((r) => (
                <th key={r.id} className="text-center p-4">
                  <span className={cn('px-2 py-1 rounded text-xs font-medium border', r.color)}>{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPS.map(([label, mod, act]) => (
              <tr key={label} className="border-b border-gray-800">
                <td className="p-4 text-gray-300">{label}</td>
                {ROLES.map((r) => (
                  <td key={r.id} className="p-4 text-center">
                    {has(r.id, mod, act) ? <Check className="text-green-500 inline-block" size={20} /> : <X className="text-red-500/80 inline-block" size={20} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {ROLES.map((r) => (
          <div key={r.id} className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <r.icon size={20} />
              <span className={cn('font-semibold px-2 py-0.5 rounded text-sm border', r.color)}>{r.label}</span>
            </div>
            <p className="text-sm text-gray-400 mb-2">{r.id === 'owner' ? 'Full company access.' : r.id === 'admin' ? 'Full company, manage users.' : r.id === 'manager' ? 'Branches, view sales, ledger.' : 'Assigned branches, receive payments.'}</p>
            <p className="text-xs text-gray-500">{userCount[r.id] ?? 0} user(s)</p>
          </div>
        ))}
      </div>
    </div>
  );
}
