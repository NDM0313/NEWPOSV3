import React, { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, FlaskConical } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { permissionService, PERMISSION_MODULES, getActionsForModule, type EngineRole, type RolePermissionRow } from '@/app/services/permissionService';
import { userService, type User as UserType } from '@/app/services/userService';
import { branchService, type Branch } from '@/app/services/branchService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFeatureFlagOptional } from '@/app/context/FeatureFlagContext';
import { toast } from 'sonner';

const ENGINE_ROLES: EngineRole[] = ['owner', 'admin', 'manager', 'user'];

function isAdminOrOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === 'admin' || r === 'owner' || r === 'super admin' || r === 'superadmin';
}

export function UserPermissionsTab() {
  const { companyId, userRole } = useSupabase();
  const { permissionV2, setPermissionV2 } = useFeatureFlagOptional();
  const isAdminOrOwner = isAdminOrOwnerRole(userRole);

  const [rolePerms, setRolePerms] = useState<RolePermissionRow[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userBranchMap, setUserBranchMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingPerm, setSavingPerm] = useState(false);
  const [savingBranch, setSavingBranch] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [perms, userList, branchList] = await Promise.all([
        permissionService.getAllRolePermissions(),
        userService.getAllUsers(companyId, { includeInactive: true }),
        branchService.getAllBranches(companyId),
      ]);
      setRolePerms(perms);
      setUsers(userList || []);
      setBranches(branchList || []);

      const map: Record<string, string[]> = {};
      for (const u of userList || []) {
        const authId = u.auth_user_id || u.id;
        if (authId) {
          try {
            const ids = await userService.getUserBranches(authId);
            map[authId] = ids || [];
          } catch {
            map[authId] = [];
          }
        }
      }
      setUserBranchMap(map);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const getAllowed = (role: string, module: string, action: string) => {
    return rolePerms.some(p => p.role === role && p.module === module && p.action === action && p.allowed);
  };

  const setAllowed = (role: EngineRole, module: string, action: string, allowed: boolean) => {
    setRolePerms(prev => {
      const rest = prev.filter(p => !(p.role === role && p.module === module && p.action === action));
      return [...rest, { role, module, action, allowed }];
    });
  };

  const savePermission = async (role: EngineRole, module: string, action: string, allowed: boolean) => {
    setSavingPerm(true);
    try {
      await permissionService.setRolePermission(role, module, action, allowed);
      toast.success('Permission updated');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSavingPerm(false);
    }
  };

  const toggleBranch = (authUserId: string, branchId: string, checked: boolean) => {
    const current = userBranchMap[authUserId] || [];
    const next = checked ? [...current, branchId] : current.filter(id => id !== branchId);
    setUserBranchMap(prev => ({ ...prev, [authUserId]: next }));
  };

  const saveBranchAccess = async (authUserId: string) => {
    setSavingBranch(authUserId);
    try {
      const branchIds = userBranchMap[authUserId] || [];
      await userService.setUserBranches(authUserId, branchIds, undefined, companyId ?? undefined);
      toast.success('Branch access updated');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSavingBranch(null);
    }
  };

  /* Lightweight enterprise design (Phase 2): 1px borders, 8px radius, 16px padding, minimal spacing, blue accent only */
  const cardClass = 'border border-gray-700 rounded-lg overflow-hidden shadow-sm bg-gray-900/40';
  const sectionHeadClass = 'text-white font-medium text-sm border-b border-gray-700 px-4 py-3';
  const tableHeadClass = 'text-left text-gray-400 font-medium text-xs uppercase tracking-wider px-3 py-2 border-b border-gray-700';
  const tableCellClass = 'px-3 py-2 text-sm border-b border-gray-800 last:border-b-0';
  const roleBadgeClass = 'px-2.5 py-1 rounded border border-gray-600 bg-gray-800/60 text-gray-300 text-xs capitalize';

  if (!isAdminOrOwner) {
    return (
      <div className="p-4 text-gray-400 text-sm border border-gray-700 rounded-lg bg-gray-900/40">
        Only admin or owner can view and edit User Permissions.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg border border-gray-700 bg-blue-500/10">
            <Users className="text-blue-500" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">User Permissions</h3>
            <p className="text-xs text-gray-400">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-permission-v2>
      {/* Experiment toggle: turn V2 on/off without code change */}
      <div className={cardClass}>
        <h4 className={sectionHeadClass}>Experiment</h4>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="text-blue-500" size={18} />
            <Label htmlFor="v2-toggle" className="text-sm text-gray-300 cursor-pointer">
              Use Permission V2 (lightweight UI + this tab)
            </Label>
          </div>
          <Switch
            id="v2-toggle"
            checked={permissionV2}
            onCheckedChange={setPermissionV2}
          />
        </div>
        <p className="text-xs text-gray-500 px-4 pb-4">When off, you’ll see the original Permission Management tab and styling.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg border border-gray-700 bg-blue-500/10 shadow-sm">
            <Users className="text-blue-500" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">User Permissions</h3>
            <p className="text-xs text-gray-400">Roles, permission matrix, branch access</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Role list */}
      <div className={cardClass}>
        <h4 className={sectionHeadClass}>Roles</h4>
        <div className="flex flex-wrap gap-2 p-4">
          {ENGINE_ROLES.map(r => (
            <span key={r} className={roleBadgeClass}>{r}</span>
          ))}
        </div>
      </div>

      {/* Permission matrix by module */}
      <div className={cardClass}>
        <h4 className={sectionHeadClass}>Permission matrix (role_permissions)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50">
                <th className={tableHeadClass}>Module</th>
                <th className={tableHeadClass}>Action</th>
                {ENGINE_ROLES.map(role => (
                  <th key={role} className={cn(tableHeadClass, 'text-center')}>{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.flatMap(module =>
                getActionsForModule(module).map((action) => (
                  <tr key={`${module}-${action}`} className="hover:bg-gray-800/30">
                    <td className={cn(tableCellClass, 'text-gray-400 capitalize')}>{module}</td>
                    <td className={cn(tableCellClass, 'text-gray-300')}>{action.replace(/_/g, ' ')}</td>
                    {ENGINE_ROLES.map(role => (
                      <td key={role} className={cn(tableCellClass, 'text-center')}>
                        <Checkbox
                          checked={getAllowed(role, module, action)}
                          onCheckedChange={async (checked) => {
                            const allowed = !!checked;
                            setAllowed(role as EngineRole, module, action, allowed);
                            await savePermission(role as EngineRole, module, action, allowed);
                          }}
                          disabled={savingPerm}
                          className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch access mapping */}
      <div className={cardClass}>
        <h4 className={sectionHeadClass}>Branch access (user_branches)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50">
                <th className={tableHeadClass}>User</th>
                <th className={tableHeadClass}>Role</th>
                {branches.map(b => (
                  <th key={b.id} className={cn(tableHeadClass, 'text-center min-w-[4rem]')}>{b.name || b.code || b.id.slice(0, 8)}</th>
                ))}
                <th className={cn(tableHeadClass, 'text-center')}>Save</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const authId = user.auth_user_id || user.id;
                const assigned = userBranchMap[authId] || [];
                return (
                  <tr key={user.id} className="hover:bg-gray-800/30">
                    <td className={cn(tableCellClass, 'text-white')}>{user.full_name || user.email}</td>
                    <td className={cn(tableCellClass, 'text-gray-400 capitalize')}>{user.role || '—'}</td>
                    {branches.map(b => (
                      <td key={b.id} className={cn(tableCellClass, 'text-center')}>
                        {isAdminOrOwnerRole(user.role) ? (
                          <span className="text-gray-500 text-xs">All</span>
                        ) : authId ? (
                          <Checkbox
                            checked={assigned.includes(b.id)}
                            onCheckedChange={(checked) => toggleBranch(authId, b.id, !!checked)}
                            className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                    ))}
                    <td className={cn(tableCellClass, 'text-center')}>
                      {authId && !isAdminOrOwnerRole(user.role) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingBranch === authId}
                          onClick={() => saveBranchAccess(authId)}
                          className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white text-xs"
                        >
                          {savingBranch === authId ? '…' : 'Save'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="p-4 text-gray-500 text-sm">No users in this company.</p>}
      </div>
    </div>
  );
}
