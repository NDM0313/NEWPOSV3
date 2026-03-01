import React, { useState, useEffect } from 'react';
import { Play, Info, Check, X } from 'lucide-react';
import { userService } from '@/app/services/userService';
import { permissionService } from '@/app/services/permissionService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { Button } from '../ui/button';

const MODULES = ['SALES', 'POS', 'PURCHASE', 'STUDIO', 'RENTALS', 'PAYMENTS', 'LEDGER', 'INVENTORY', 'CONTACTS', 'REPORTS', 'USERS', 'SETTINGS'];

function roleToEngine(r: string): string {
  const s = (r || '').toLowerCase();
  if (s === 'owner') return 'owner';
  if (s === 'admin' || s === 'super admin' || s === 'superadmin') return 'admin';
  if (s === 'manager' || s === 'accountant') return 'manager';
  return 'user';
}

export function RlsTab() {
  const { companyId } = useSupabase();
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('SALES');
  const [result, setResult] = useState<{ allowed: string[]; denied: string[] } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    userService.getAllUsers(companyId, { includeInactive: false }).then((list) => {
      setUsers((list || []).map((u) => ({ id: u.auth_user_id || u.id, name: u.full_name || '', email: u.email || '', role: u.role || '' })));
      if (list?.length && !selectedUser) setSelectedUser(list[0].auth_user_id || list[0].id);
    });
  }, [companyId]);

  const current = users.find((u) => u.id === selectedUser);

  const runSimulation = async () => {
    if (!current) return;
    setRunning(true);
    setResult(null);
    try {
      const engineRole = roleToEngine(current.role) as 'owner' | 'admin' | 'manager' | 'user';
      const perms = await permissionService.getRolePermissions(engineRole);
      const mod = selectedModule.toLowerCase();
      const forModule = perms.filter((p) => p.module === mod);
      const allowed = forModule.filter((p) => p.allowed).map((p) => p.action);
      const denied = forModule.filter((p) => !p.allowed).map((p) => p.action);
      if (current.role.toLowerCase() === 'owner' || current.role.toLowerCase() === 'admin') {
        setResult({ allowed: ['(Full access: owner/admin bypass RLS)'], denied: [] });
      } else {
        setResult({ allowed: allowed.length ? allowed : ['(none)'], denied });
      }
    } catch {
      setResult({ allowed: [], denied: ['(Failed to load permissions)'] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">RLS Simulator</h2>
        <p className="text-gray-400 text-sm mt-1">Simulate Row Level Security policies for different users and modules</p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Select User</label>
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} - {u.role.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Select Module</label>
          <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
            {MODULES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="max-w-2xl">
        <Button className="w-full bg-green-600 hover:bg-green-500 text-white gap-2 py-3" onClick={runSimulation} disabled={running}>
          <Play size={18} /> {running ? 'Running…' : 'Run RLS Simulation'}
        </Button>
      </div>
      {result && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 max-w-2xl space-y-2">
          <p className="text-sm font-medium text-white">Result for {selectedModule} (role: {current?.role})</p>
          <p className="text-xs text-green-400 flex items-center gap-1"><Check size={14} /> Allowed: {result.allowed.join(', ')}</p>
          {result.denied.length > 0 && <p className="text-xs text-red-400 flex items-center gap-1"><X size={14} /> Denied: {result.denied.join(', ')}</p>}
        </div>
      )}
      {current && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 flex items-center gap-3 max-w-2xl">
          <Info className="text-amber-500 shrink-0" size={24} />
          <div className="flex-1">
            <p className="font-semibold text-white">{current.name}</p>
            <p className="text-sm text-gray-400">{current.email}</p>
          </div>
          <span className="px-3 py-1 rounded bg-amber-500/20 text-amber-400 text-sm font-medium">{current.role.toUpperCase()}</span>
        </div>
      )}
      <div className="border border-purple-500/30 bg-purple-500/5 rounded-lg p-4 max-w-3xl">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-2">
          <Info className="text-amber-500" size={18} /> How RLS Works
        </h3>
        <p className="text-sm text-gray-300 mb-3">Row Level Security (RLS) enforces access control at the database level.</p>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>Owner/Admin: Access to all company data</li>
          <li>Manager: Access to assigned branch data</li>
          <li>Salesman: Access to own records or branch records (configurable)</li>
          <li>User: Access to own records only</li>
        </ul>
        <p className="text-sm text-gray-400 mt-3">The RLS policy automatically filters queries based on the user&apos;s role and branch assignments, ensuring data security at the database level.</p>
      </div>
    </div>
  );
}
