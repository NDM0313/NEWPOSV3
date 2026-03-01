import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { branchService } from '@/app/services/branchService';
import { userService } from '@/app/services/userService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { Button } from '../ui/button';
import { AddBranchModal } from '../branches/AddBranchModal';
import { cn } from '../ui/utils';
import { toast } from 'sonner';

function initials(name: string) {
  return name.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2);
}

export function BranchTab() {
  const { companyId } = useSupabase();
  const [branches, setBranches] = useState<any[]>([]);
  const [usersByBranch, setUsersByBranch] = useState<Record<string, { full_name: string; email: string; role: string }[]>>({});
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBranches = useCallback(() => {
    if (!companyId) return;
    branchService.getAllBranches(companyId).then((list) => setBranches(list || []));
  }, [companyId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  useEffect(() => {
    if (!companyId || branches.length === 0) return;
    const byBranch: Record<string, { full_name: string; email: string; role: string }[]> = {};
    branches.forEach((b) => { byBranch[b.id] = []; });
    userService.getAllUsers(companyId, { includeInactive: false }).then((users) => {
      Promise.all((users || []).map((u) => userService.getUserBranches(u.auth_user_id || u.id).then((branchIds) => ({ u, branchIds })).catch(() => ({ u, branchIds: [] as string[] })))).then((results) => {
        results.forEach(({ u, branchIds }) => {
          const role = (u.role || '').toLowerCase();
          const ids = role === 'admin' || role === 'owner' ? branches.map((b) => b.id) : branchIds;
          ids.forEach((bid) => {
            if (byBranch[bid]) byBranch[bid].push({ full_name: u.full_name || '', email: u.email || '', role: u.role || '' });
          });
        });
        setUsersByBranch(byBranch);
      });
    });
  }, [companyId, branches]);

  const handleDelete = async (b: any) => {
    if (!window.confirm(`Delete branch "${b.name || b.code}"? This cannot be undone.`)) return;
    setDeletingId(b.id);
    try {
      await branchService.deleteBranch(b.id);
      toast.success('Branch deleted');
      loadBranches();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete branch');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Branch Access Control</h2>
          <p className="text-gray-400 text-sm mt-1">Manage branches and user access across different locations</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-500 text-white gap-2" onClick={() => { setEditingBranch(null); setBranchModalOpen(true); }}><Plus size={16} /> Add Branch</Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {branches.map((b) => (
          <div key={b.id} className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
            <div className="bg-green-600/20 border-b border-green-500/30 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="text-green-500" size={20} />
                <div>
                  <p className="font-semibold text-white">{b.name || 'Branch'}</p>
                  <p className="text-xs text-gray-400">{b.address || b.code || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Code: {b.code || b.id.slice(0, 8)}</span>
                <button type="button" className="p-1.5 text-gray-400 hover:bg-gray-800 rounded" onClick={() => { setEditingBranch(b); setBranchModalOpen(true); }} title="Edit"><Pencil size={14} /></button>
                <button type="button" className="p-1.5 text-red-400 hover:bg-gray-800 rounded" onClick={() => handleDelete(b)} disabled={deletingId === b.id} title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-400 mb-2">Assigned Users ({(usersByBranch[b.id] || []).length})</p>
              <div className="space-y-2">
                {(usersByBranch[b.id] || []).map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-medium text-blue-400">{initials(u.full_name || u.email)}</div>
                    <div>
                      <p className="text-white">{u.full_name || u.email}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </div>
                    <span className={cn('ml-auto px-2 py-0.5 rounded text-xs', u.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : u.role === 'owner' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-300')}>{u.role}</span>
                  </div>
                ))}
                {(usersByBranch[b.id] || []).length === 0 && <p className="text-gray-500 text-sm">No users assigned</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <AddBranchModal open={branchModalOpen} onClose={() => { setBranchModalOpen(false); setEditingBranch(null); }} onSuccess={() => { loadBranches(); setBranchModalOpen(false); setEditingBranch(null); }} editingBranch={editingBranch} />
    </div>
  );
}
