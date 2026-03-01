import React, { useState, useEffect } from 'react';
import { Shield, Users, Building2, CheckCircle, Crown, Briefcase } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { permissionService } from '@/app/services/permissionService';
import { userService } from '@/app/services/userService';
import { branchService } from '@/app/services/branchService';
import { cn } from '../ui/utils';

const ROLES = [
  { id: 'owner', label: 'OWNER', level: 4, levelColor: 'text-green-400', icon: Crown, desc: 'Full company access, all branches, all modules, override everything' },
  { id: 'admin', label: 'ADMIN', level: 3, levelColor: 'text-blue-400', icon: Shield, desc: 'Full company access, can manage users, configure system' },
  { id: 'manager', label: 'MANAGER', level: 2, levelColor: 'text-amber-400', icon: Briefcase, desc: 'Specific branches, view all sales, view ledger, cannot manage users' },
  { id: 'user', label: 'SALESMAN', level: 1, levelColor: 'text-red-400', icon: Briefcase, desc: 'Only assigned branches, configurable sales view, can receive payments' },
];

export function DashboardTab() {
  const { companyId } = useSupabase();
  const [totalRoles, setTotalRoles] = useState(4);
  const [activeUsers, setActiveUsers] = useState(0);
  const [branches, setBranches] = useState(0);
  const [permissionsCount, setPermissionsCount] = useState({ allowed: 0, total: 0 });
  const [userCountByRole, setUserCountByRole] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [perms, users, branchList] = await Promise.all([
          permissionService.getAllRolePermissions(),
          userService.getAllUsers(companyId, { includeInactive: false }),
          branchService.getAllBranches(companyId),
        ]);
        setActiveUsers(users?.length ?? 0);
        setBranches(branchList?.length ?? 0);
        const allowed = perms.filter((p) => p.allowed).length;
        setPermissionsCount({ allowed, total: perms.length });
        const byRole: Record<string, number> = {};
        (users || []).forEach((u) => {
          const r = (u.role || 'user').toLowerCase();
          const key = r === 'salesman' || r === 'salesperson' ? 'user' : r;
          byRole[key] = (byRole[key] ?? 0) + 1;
        });
        setUserCountByRole(byRole);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  if (loading) return <div className="space-y-6"><h2 className="text-xl font-bold text-white">ERP Permission Architecture</h2><p className="text-gray-400 text-sm">Loading dashboard…</p></div>;
  if (error) return <div className="space-y-6"><h2 className="text-xl font-bold text-white">ERP Permission Architecture</h2><p className="text-red-400 text-sm">{error}</p></div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">ERP Permission Architecture</h2>
        <p className="text-gray-400 text-sm mt-1">Standard role-based permission system with branch-level access control</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Shield className="text-green-500" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalRoles}</p>
              <p className="text-xs text-gray-400">Total Roles</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="text-blue-500" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeUsers}</p>
              <p className="text-xs text-gray-400">Active Users</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Building2 className="text-purple-500" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{branches}</p>
              <p className="text-xs text-gray-400">Branches</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <CheckCircle className="text-purple-500" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{permissionsCount.allowed}/{permissionsCount.total || 58}</p>
              <p className="text-xs text-gray-400">Permissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role Hierarchy */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Role Hierarchy</h3>
        <div className="space-y-3">
          {ROLES.map((r) => (
            <div
              key={r.id}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border border-gray-800 bg-gray-900/40',
                r.id === 'owner' && 'bg-amber-500/5 border-amber-500/20',
                r.id === 'admin' && 'bg-blue-500/5 border-blue-500/20',
                r.id === 'manager' && 'bg-amber-500/5 border-amber-500/20',
                r.id === 'user' && 'bg-red-500/5 border-red-500/20'
              )}
            >
              <div className="p-2 rounded-lg bg-gray-800">
                <r.icon className={r.levelColor} size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{r.label}</span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded', r.levelColor, 'bg-gray-800')}>
                    Level {r.level}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{r.desc}</p>
              </div>
              <span className="text-sm text-gray-400">{userCountByRole[r.id] ?? 0} user(s)</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4-Layer Permission Architecture */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">4-Layer Permission Architecture</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
            <p className="font-medium text-white mb-1">1. ROLE LAYER</p>
            <p className="text-sm text-gray-400">Owner, Admin, Manager, Salesman, User</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
            <p className="font-medium text-white mb-1">2. BRANCH ACCESS</p>
            <p className="text-sm text-gray-400">Multi-branch assignment control</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
            <p className="font-medium text-white mb-1">3. MODULE PERMISSION</p>
            <p className="text-sm text-gray-400">Sales, Payments, Ledger, Inventory</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
            <p className="font-medium text-white mb-1">4. VISIBILITY RULE</p>
            <p className="text-sm text-gray-400">Own vs Branch vs Company level</p>
          </div>
        </div>
      </div>
    </div>
  );
}
