import React, { useState, useEffect, useCallback } from 'react';
import { Crown, Shield, Briefcase, ShoppingCart, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { userService } from '@/app/services/userService';
import { branchService } from '@/app/services/branchService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { AddUserModal } from '../users/AddUserModal';
import { toast } from 'sonner';

const ROLE_META: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: 'OWNER', icon: Crown, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  admin: { label: 'ADMIN', icon: Shield, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  manager: { label: 'MANAGER', icon: Briefcase, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  salesman: { label: 'SALESMAN', icon: ShoppingCart, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  user: { label: 'USER', icon: ShoppingCart, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

function initials(name: string) {
  return name.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2);
}

export function UsersTab() {
  const { companyId } = useSupabase();
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [userBranchNames, setUserBranchNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadUsers = useCallback(() => {
    if (!companyId) return;
    userService.getAllUsers(companyId, { includeInactive: true }).then((list) => setUsers(list || []));
  }, [companyId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!companyId) return;
    branchService.getAllBranches(companyId).then((list) => setBranches(list || []));
  }, [companyId]);

  useEffect(() => {
    if (!users.length || !branches.length) return;
    const branchMap: Record<string, string> = {};
    branches.forEach((b) => { branchMap[b.id] = b.name || b.code || b.id; });
    Promise.all(
      users.map(async (u) => {
        const role = (u.role || '').toLowerCase();
        if (role === 'admin' || role === 'owner') return [u.id, 'All Branches'] as const;
        try {
          const authId = u.auth_user_id || u.id;
          const ids = await userService.getUserBranches(authId);
          const text = ids.map((id) => branchMap[id] || id).join(', ') || 'None';
          return [u.id, text] as const;
        } catch {
          return [u.id, '—'] as const;
        }
      })
    ).then((results) => {
      const next: Record<string, string> = {};
      results.forEach(([id, text]) => { next[id] = text; });
      setUserBranchNames((prev) => ({ ...prev, ...next }));
    });
  }, [users, branches]);

  const filtered = users.filter((u) => {
    const okSearch = !search || String(u.full_name || '').toLowerCase().includes(search.toLowerCase()) || String(u.email || '').toLowerCase().includes(search.toLowerCase());
    const okRole = roleFilter === 'all' || String(u.role || '').toLowerCase() === roleFilter;
    return okSearch && okRole;
  });

  const byRole: Record<string, number> = {};
  users.forEach((u) => {
    const r = String(u.role || 'user').toLowerCase();
    byRole[r] = (byRole[r] ?? 0) + 1;
  });

  const handleDelete = async (u: any) => {
    if (!window.confirm(`Deactivate user "${u.full_name || u.email}"? They will no longer be able to sign in.`)) return;
    setDeletingId(u.id);
    try {
      await userService.deleteUser(u.id);
      toast.success('User deactivated');
      loadUsers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to deactivate');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Users Management</h2>
          <p className="text-gray-400 text-sm mt-1">Add, edit, and manage user roles and branch assignments</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-500 text-white gap-2" onClick={() => { setEditingUser(null); setAddUserOpen(true); }}><Plus size={16} /> Add User</Button>
      </div>
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
          <option value="all">All Roles</option>
          {Object.keys(ROLE_META).map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
        </select>
      </div>
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="text-left text-gray-400 font-medium p-4">User</th>
              <th className="text-left text-gray-400 font-medium p-4">Role</th>
              <th className="text-left text-gray-400 font-medium p-4">Assigned Branches</th>
              <th className="text-left text-gray-400 font-medium p-4">Status</th>
              <th className="text-right text-gray-400 font-medium p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const meta = ROLE_META[String(u.role || 'user').toLowerCase()] ?? ROLE_META.user;
              return (
                <tr key={u.id} className="border-b border-gray-800">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-medium">{initials(u.full_name || u.email || 'U')}</div>
                      <div>
                        <p className="text-white font-medium">{u.full_name || '-'}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border', meta.color)}><meta.icon size={12} /> {meta.label}</span>
                  </td>
                  <td className="p-4"><span className="text-gray-400 text-xs">{userBranchNames[u.id] ?? '…'}</span></td>
                  <td className="p-4"><span className={u.is_active ? 'text-green-500 text-xs' : 'text-gray-500 text-xs'}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-4 text-right">
                    <button type="button" className="p-2 text-blue-400 hover:bg-gray-800 rounded" onClick={() => { setEditingUser(u); setAddUserOpen(true); }} title="Edit"><Pencil size={16} /></button>
                    <button type="button" className="p-2 text-red-400 hover:bg-gray-800 rounded" onClick={() => handleDelete(u)} disabled={deletingId === u.id} title="Deactivate"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(ROLE_META).map(([key, meta]) => (
          <div key={key} className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
            <meta.icon className="mx-auto text-gray-400 mb-2" size={24} />
            <p className="text-sm text-gray-400">Role: {meta.label}</p>
            <p className="text-lg font-bold text-white">{byRole[key] ?? 0} user(s)</p>
          </div>
        ))}
      </div>
      <AddUserModal open={addUserOpen} onClose={() => { setAddUserOpen(false); setEditingUser(null); }} onSuccess={() => { loadUsers(); setAddUserOpen(false); setEditingUser(null); }} editingUser={editingUser} />
    </div>
  );
}
