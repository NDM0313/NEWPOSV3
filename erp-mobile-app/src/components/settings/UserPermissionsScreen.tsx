import { useState, useEffect } from 'react';
import { ArrowLeft, Shield, MapPin, Loader2, Check, X } from 'lucide-react';
import type { User } from '../../types';
import { usePermissions } from '../../context/PermissionContext';
import * as permissionsApi from '../../api/permissions';
import * as branchesApi from '../../api/branches';
import type { RolePermissionRow } from '../../api/permissions';

function mapAppRoleToEngine(role: string): permissionsApi.EngineRole {
  const r = (role || '').toLowerCase();
  if (r === 'owner') return 'owner';
  if (r === 'admin' || r === 'super admin' || r === 'superadmin') return 'admin';
  if (r === 'manager' || r === 'accountant') return 'manager';
  return 'user';
}

interface UserPermissionsScreenProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

export function UserPermissionsScreen({ onBack, user, companyId }: UserPermissionsScreenProps) {
  const { permissions, branchIds, loaded, isAdminOrOwner, reload } = usePermissions();
  const [branchList, setBranchList] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<permissionsApi.EngineRole | null>(null);
  const [editPerms, setEditPerms] = useState<RolePermissionRow[]>([]);

  useEffect(() => {
    if (!companyId) return;
    branchesApi.getBranches(companyId).then(({ data }) => {
      if (data) setBranchList(data.map((b) => ({ id: b.id, name: b.name })));
    });
  }, [companyId]);

  useEffect(() => {
    if (editRole) {
      permissionsApi.getRolePermissionsByEngineRole(editRole).then(setEditPerms);
    } else {
      setEditPerms([]);
    }
  }, [editRole]);

  const engineRole = mapAppRoleToEngine(user.role);
  const effectiveBranchLabel =
    isAdminOrOwner || branchIds.length === 0
      ? 'All branches'
      : branchList.length > 0
        ? branchIds
            .map((id) => branchList.find((b) => b.id === id)?.name ?? id)
            .filter(Boolean)
            .join(', ') || `${branchIds.length} branch(es)`
        : `${branchIds.length} branch(es)`;

  const handleToggle = async (module: string, action: string, allowed: boolean) => {
    if (!editRole || !isAdminOrOwner) return;
    setSaving(`${module}.${action}`);
    const { error } = await permissionsApi.setRolePermission(editRole, module, action, allowed);
    setSaving(null);
    if (!error) {
      setEditPerms((prev) =>
        prev.map((p) => (p.module === module && p.action === action ? { ...p, allowed } : p))
      );
      if (editRole === engineRole) reload(user.id, user.role, user.profileId);
    }
  };

  const grouped = editPerms.length > 0
    ? editPerms.reduce<Record<string, RolePermissionRow[]>>((acc, p) => {
        if (!acc[p.module]) acc[p.module] = [];
        acc[p.module].push(p);
        return acc;
      }, {})
    : permissions.reduce<Record<string, RolePermissionRow[]>>((acc, p) => {
        if (!acc[p.module]) acc[p.module] = [];
        acc[p.module].push(p);
        return acc;
      }, {});

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#8B5CF6]/20 rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-[#8B5CF6]" />
            </div>
            <h1 className="text-white font-semibold text-base">User Permissions</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!loaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">Your role</p>
              <p className="font-medium text-white capitalize">{user.role}</p>
              <p className="text-xs text-[#6B7280] mt-1">Engine: {engineRole}</p>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <p className="text-xs text-[#9CA3AF] mb-0.5">Branch access</p>
                <p className="font-medium text-white">{effectiveBranchLabel}</p>
              </div>
            </div>

            {isAdminOrOwner && (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <p className="text-xs text-[#9CA3AF] mb-2">Edit role permissions (admin)</p>
                <div className="flex flex-wrap gap-2">
                  {(['owner', 'admin', 'manager', 'user'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setEditRole(editRole === r ? null : r)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                        editRole === r ? 'bg-[#8B5CF6] text-white' : 'bg-[#374151] text-[#9CA3AF] hover:bg-[#4B5563]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
              <h4 className="text-sm font-medium text-[#9CA3AF] px-4 py-3 border-b border-[#374151]">
                Permission matrix {editRole ? `(${editRole})` : '(your role)'}
              </h4>
              <div className="divide-y divide-[#374151] max-h-[50vh] overflow-y-auto">
                {Object.entries(grouped).map(([module, rows]) => (
                  <div key={module} className="px-4 py-2">
                    <p className="text-xs font-medium text-[#8B5CF6] uppercase mb-2">{module}</p>
                    <div className="space-y-1.5">
                      {rows.map((p) => {
                        const key = `${p.module}.${p.action}`;
                        const isSaving = saving === key;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-[#E5E7EB]">{p.action}</span>
                            {editRole && isAdminOrOwner ? (
                              <button
                                onClick={() => handleToggle(p.module, p.action, !p.allowed)}
                                disabled={!!saving}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                                  p.allowed ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#374151] text-[#9CA3AF]'
                                }`}
                              >
                                {isSaving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : p.allowed ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                                {p.allowed ? 'Yes' : 'No'}
                              </button>
                            ) : (
                              <span className={p.allowed ? 'text-[#10B981]' : 'text-[#6B7280]'}>
                                {p.allowed ? 'Yes' : 'No'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-[#6B7280] px-1">
              Permissions are enforced by the server. Hiding modules on the app is for UX only.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
