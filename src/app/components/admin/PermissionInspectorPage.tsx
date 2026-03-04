/**
 * Admin-only Permission Inspector – debug user access from live DB.
 * Route: /admin/permission-inspector (pathname guard in App).
 * Data: users, role_permissions, user_branches, get_effective_user_branch (same as production).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, User, Building2, MapPin, Check, X, ChevronRight, Database } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useNavigation } from '@/app/context/NavigationContext';
import {
  fetchCompanyUsers,
  fetchInspectorPayload,
  type InspectorUser,
  type InspectorPayload,
  type EffectiveBranchResult,
} from '@/app/services/permissionInspectorService';
import type { RolePermissionRow } from '@/app/services/permissionService';
import { cn } from '@/app/components/ui/utils';

const MODULE_ORDER = [
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

function hasView(rows: RolePermissionRow[], module: string): boolean {
  return rows.some(
    (r) =>
      r.module === module &&
      r.allowed &&
      (r.action === 'view' ||
        r.action.startsWith('view_') ||
        r.action === 'use')
  );
}
function hasCreate(rows: RolePermissionRow[], module: string): boolean {
  return rows.some((r) => r.module === module && r.action === 'create' && r.allowed);
}
function hasEdit(rows: RolePermissionRow[], module: string): boolean {
  return rows.some(
    (r) =>
      r.module === module &&
      r.allowed &&
      (r.action === 'edit' || r.action === 'modify' || r.action === 'receive')
  );
}
function hasDelete(rows: RolePermissionRow[], module: string): boolean {
  return rows.some((r) => r.module === module && r.action === 'delete' && r.allowed);
}

function EffectiveMatrix({ rows }: { rows: RolePermissionRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-700 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-800/80 text-left">
            <th className="px-4 py-2 font-medium text-gray-200">Module</th>
            <th className="px-4 py-2 font-medium text-gray-200 text-center w-24">View</th>
            <th className="px-4 py-2 font-medium text-gray-200 text-center w-24">Create</th>
            <th className="px-4 py-2 font-medium text-gray-200 text-center w-24">Edit</th>
            <th className="px-4 py-2 font-medium text-gray-200 text-center w-24">Delete</th>
          </tr>
        </thead>
        <tbody>
          {MODULE_ORDER.map((module) => {
            const view = hasView(rows, module);
            const create = hasCreate(rows, module);
            const edit = hasEdit(rows, module);
            const del = hasDelete(rows, module);
            const hasAny = view || create || edit || del;
            return (
              <tr
                key={module}
                className={cn(
                  'border-t border-gray-700/70',
                  hasAny ? 'bg-gray-900/50' : 'bg-gray-900/30 opacity-70'
                )}
              >
                <td className="px-4 py-2 text-gray-200">{MODULE_LABELS[module] ?? module}</td>
                <td className="px-4 py-2 text-center">
                  {view ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 text-emerald-400">
                      <Check size={14} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400">
                      <X size={14} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {create ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 text-emerald-400">
                      <Check size={14} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400">
                      <X size={14} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {edit ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 text-emerald-400">
                      <Check size={14} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400">
                      <X size={14} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {del ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 text-emerald-400">
                      <Check size={14} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400">
                      <X size={14} />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PermissionInspectorPage() {
  const { companyId } = useSupabase();
  const { currentUser } = useSettings();
  const { setCurrentView } = useNavigation();
  const [users, setUsers] = useState<InspectorUser[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/admin/permission-inspector') {
      setCurrentView('permission-inspector');
    }
  }, [setCurrentView]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [payload, setPayload] = useState<InspectorPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPayload, setLoadingPayload] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const isAdminOrOwner =
    currentUser?.role === 'Admin' ||
    (currentUser?.role as string)?.toLowerCase() === 'owner';

  const loadUsers = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const list = await fetchCompanyUsers(companyId);
      setUsers(list);
      if (!selectedUserId && list.length > 0) setSelectedUserId(list[0].id);
    } catch (e) {
      console.error('Permission Inspector: load users', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedUserId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!companyId || !selectedUserId) {
      setPayload(null);
      return;
    }
    setLoadingPayload(true);
    fetchInspectorPayload(companyId, selectedUserId)
      .then(setPayload)
      .catch((e) => {
        console.error('Permission Inspector: load payload', e);
        setPayload(null);
      })
      .finally(() => setLoadingPayload(false));
  }, [companyId, selectedUserId]);

  if (!isAdminOrOwner) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-6 text-center">
          <Shield className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-red-200">Access denied</h2>
          <p className="text-sm text-gray-400 mt-1">Only owner or admin can access Permission Inspector.</p>
        </div>
      </div>
    );
  }

  const selectedUser = payload?.user ?? null;
  const effective = payload?.effectiveBranch;
  const branchMode = effective
    ? effective.branch_count <= 1
      ? 'Single'
      : 'Multi'
    : '—';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-gray-300">
        <Shield className="h-6 w-6 text-amber-500" />
        <h1 className="text-xl font-semibold">Permission Inspector</h1>
      </div>
      <p className="text-sm text-gray-400">
        Live DB view: same data and logic as production. Select a user to see role permissions, branch access, and RLS scope.
      </p>

      {/* User selector */}
      <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Select User</label>
        <select
          className="w-full max-w-md rounded-md border border-gray-600 bg-gray-800 text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          disabled={loading}
        >
          <option value="">— Select user —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email} ({u.role})
            </option>
          ))}
        </select>
      </section>

      {loadingPayload && (
        <div className="text-sm text-gray-500">Loading user data…</div>
      )}

      {!loadingPayload && selectedUser && payload && (
        <>
          {/* Section 1 – User Summary */}
          <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <User size={16} /> User Summary
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="text-gray-200">{selectedUser.full_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-200">{selectedUser.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Role</dt>
                <dd className="text-gray-200">
                  <span className="rounded px-2 py-0.5 bg-gray-700 text-gray-200">{selectedUser.role}</span>
                  <span className="ml-2 text-gray-500">(engine: {payload.engineRole})</span>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Company</dt>
                <dd className="text-gray-200 flex items-center gap-1">
                  <Building2 size={14} /> {selectedUser.company_id}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Branch Mode</dt>
                <dd className="text-gray-200">{branchMode}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Branches Assigned</dt>
                <dd className="text-gray-200">
                  {payload.userBranches.length > 0
                    ? payload.userBranches.map((ub) => ub.branch_id).join(', ')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Effective Branch</dt>
                <dd className="text-gray-200 flex items-center gap-1">
                  <MapPin size={14} />
                  {effective?.effective_branch_id ?? '—'}
                  {effective?.requires_branch_selection && (
                    <span className="text-amber-400 text-xs">(requires selection)</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Section 2 – Branch Access & RLS scope */}
          <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <MapPin size={16} /> Branch Access & RLS Scope
            </h2>
            <div className="text-sm space-y-1">
              <p className="text-gray-300">
                Company branch count: <strong>{payload.companyBranchCount}</strong>
              </p>
              <p className="text-gray-300">
                Accessible branch IDs:{' '}
                {effective?.accessible_branch_ids?.length
                  ? effective.accessible_branch_ids.join(', ')
                  : '—'}
              </p>
              <p className="text-gray-400">
                RLS scope: company_id = current company; branch isolation by effective/accessible branches.
              </p>
            </div>
          </section>

          {/* Section 3 – Module Permission Matrix */}
          <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">Effective Permissions (from role_permissions)</h2>
            <EffectiveMatrix rows={payload.rolePermissions} />
          </section>

          {/* Section 4 – Raw DB (expandable) */}
          <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-gray-200"
              onClick={() => setRawOpen((o) => !o)}
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', rawOpen && 'rotate-90')} />
              <Database size={16} /> Raw DB view
            </button>
            {rawOpen && (
              <div className="mt-3 space-y-3 text-xs font-mono">
                <div>
                  <p className="text-gray-500 mb-1">role_permissions (role = {payload.engineRole}):</p>
                  <pre className="rounded bg-gray-950 p-3 overflow-auto max-h-48 text-gray-400">
                    {JSON.stringify(payload.rolePermissions, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">user_branches:</p>
                  <pre className="rounded bg-gray-950 p-3 overflow-auto max-h-32 text-gray-400">
                    {JSON.stringify(payload.userBranches, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">get_effective_user_branch result:</p>
                  <pre className="rounded bg-gray-950 p-3 overflow-auto max-h-32 text-gray-400">
                    {JSON.stringify(payload.effectiveBranch, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {!loadingPayload && selectedUserId && !payload?.user && (
        <div className="text-sm text-amber-500">User not found or no data.</div>
      )}
    </div>
  );
}
