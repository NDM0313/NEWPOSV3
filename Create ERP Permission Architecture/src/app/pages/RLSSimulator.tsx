import { useState } from 'react';
import { Layout } from '../components/Layout';
import { roleConfigs } from '../data/mockData';
import { useData } from '../context/DataContext';
import { Role, Module } from '../types/permission';
import { Code, Play, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';

export function RLSSimulator() {
  const { users, permissions } = useData();
  const [selectedUser, setSelectedUser] = useState(users[3]?.id || users[0]?.id);
  const [selectedModule, setSelectedModule] = useState<Module>('sales');
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const user = users.find(u => u.id === selectedUser);
  const roleConfig = user ? roleConfigs.find(r => r.role === user.role) : null;

  const runSimulation = () => {
    if (!user) return;

    const userPermissions = permissions.filter(
      p => p.role === user.role && p.module === selectedModule && p.allowed
    );

    let accessLevel = 'DENIED';
    let rlsQuery = '';

    if (user.role === 'owner' || user.role === 'admin') {
      accessLevel = 'COMPANY_WIDE';
      rlsQuery = `-- Row Level Security Policy for ${user.role.toUpperCase()}
CREATE POLICY "${selectedModule}_${user.role}_policy"
ON ${selectedModule}
FOR SELECT
USING (
  -- ${user.role.toUpperCase()} has full company access
  company_id = current_company_id()
);

-- Example Query
SELECT * FROM ${selectedModule} 
WHERE company_id = current_company_id();`;
    } else {
      const hasCompanyView = userPermissions.some(p => p.action === 'view_company');
      const hasBranchView = userPermissions.some(p => p.action === 'view_branch');
      const hasOwnView = userPermissions.some(p => p.action === 'view_own');

      if (hasCompanyView) {
        accessLevel = 'COMPANY_WIDE';
        rlsQuery = `-- Row Level Security Policy for ${user.role.toUpperCase()}
CREATE POLICY "${selectedModule}_${user.role}_company_policy"
ON ${selectedModule}
FOR SELECT
USING (
  company_id = current_company_id()
);

-- Example Query
SELECT * FROM ${selectedModule} 
WHERE company_id = current_company_id();`;
      } else if (hasBranchView) {
        accessLevel = 'BRANCH_LEVEL';
        rlsQuery = `-- Row Level Security Policy for ${user.role.toUpperCase()}
CREATE POLICY "${selectedModule}_${user.role}_branch_policy"
ON ${selectedModule}
FOR SELECT
USING (
  -- User can only see records from assigned branches
  branch_id IN (
    SELECT branch_id 
    FROM user_branches 
    WHERE user_id = auth.uid()
  )
);

-- Example Query
SELECT s.* FROM ${selectedModule} s
INNER JOIN user_branches ub 
  ON s.branch_id = ub.branch_id
WHERE ub.user_id = auth.uid();

-- Assigned Branches: ${user.branches.join(', ')}`;
      } else if (hasOwnView) {
        accessLevel = 'OWN_RECORDS';
        rlsQuery = `-- Row Level Security Policy for ${user.role.toUpperCase()}
CREATE POLICY "${selectedModule}_${user.role}_own_policy"
ON ${selectedModule}
FOR SELECT
USING (
  -- User can only see their own records
  created_by = auth.uid()
);

-- Example Query
SELECT * FROM ${selectedModule} 
WHERE created_by = auth.uid();`;
      } else {
        accessLevel = 'DENIED';
        rlsQuery = `-- Row Level Security Policy for ${user.role.toUpperCase()}
-- No access granted to ${selectedModule} module

CREATE POLICY "${selectedModule}_${user.role}_deny_policy"
ON ${selectedModule}
FOR SELECT
USING (false);

-- This user has no permission to access ${selectedModule}`;
      }
    }

    setSimulationResult({
      accessLevel,
      rlsQuery,
      permissions: userPermissions,
      canCreate: userPermissions.some(p => p.action === 'create'),
      canEdit: userPermissions.some(p => p.action === 'edit'),
      canDelete: userPermissions.some(p => p.action === 'delete'),
    });
  };

  const copyToClipboard = () => {
    if (simulationResult?.rlsQuery) {
      navigator.clipboard.writeText(simulationResult.rlsQuery);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const modules: Module[] = ['sales', 'payments', 'ledger', 'inventory', 'accounts', 'reports'];

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">RLS Simulator</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Simulate Row Level Security policies for different users and modules
          </p>
        </div>

        {/* Simulation Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* User Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Select User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
              >
                {users.map(u => {
                  const rc = roleConfigs.find(r => r.role === u.role);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} - {u.role.toUpperCase()}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Module Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Select Module
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value as Module)}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
              >
                {modules.map(m => (
                  <option key={m} value={m}>
                    {m.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={runSimulation}
            className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="size-5" />
            Run RLS Simulation
          </button>
        </div>

        {/* User Info */}
        {user && roleConfig && (
          <div
            className="bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-sm border-2 p-6 mb-6"
            style={{ borderColor: roleConfig.color + '40' }}
          >
            <div className="flex items-center gap-4">
              <div
                className="size-16 rounded-xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: roleConfig.color + '20' }}
              >
                {roleConfig.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{user.name}</h3>
                <p className="text-slate-600 dark:text-slate-400">{user.email}</p>
              </div>
              <div>
                <span
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white uppercase"
                  style={{ backgroundColor: roleConfig.color }}
                >
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Simulation Result */}
        {simulationResult && (
          <div className="space-y-6">
            {/* Access Level */}
            <div className={`rounded-xl shadow-sm border-2 p-6 ${
              simulationResult.accessLevel === 'DENIED'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {simulationResult.accessLevel === 'DENIED' ? (
                  <XCircle className="size-8 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Access Level</h3>
                  <p className={`text-2xl font-bold ${
                    simulationResult.accessLevel === 'DENIED' 
                      ? 'text-red-700 dark:text-red-400' 
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {simulationResult.accessLevel.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            {/* RLS Query */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-xl shadow-sm overflow-hidden border border-slate-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Code className="size-5 text-emerald-400" />
                  <h3 className="font-bold text-white">Generated RLS Policy</h3>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-6 text-emerald-400 font-mono text-sm overflow-x-auto">
                {simulationResult.rlsQuery}
              </pre>
            </div>

            {/* CRUD Permissions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">CRUD Permissions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'canCreate', label: 'Create', icon: '➕' },
                  { key: 'canEdit', label: 'Edit', icon: '✏️' },
                  { key: 'canDelete', label: 'Delete', icon: '🗑️' },
                  { key: 'view', label: 'View', icon: '👁️' },
                ].map(perm => {
                  const allowed = perm.key === 'view' 
                    ? simulationResult.accessLevel !== 'DENIED'
                    : simulationResult[perm.key];
                  
                  return (
                    <div
                      key={perm.key}
                      className={`p-4 rounded-lg border-2 ${
                        allowed
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <div className="text-2xl mb-2">{perm.icon}</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{perm.label}</div>
                      <div className={`text-sm font-bold ${
                        allowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                      }`}>
                        {allowed ? 'Allowed' : 'Denied'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Permissions */}
            {simulationResult.permissions.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4">Detailed Permissions</h3>
                <div className="space-y-2">
                  {simulationResult.permissions.map((perm: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                          {selectedModule}.{perm.action}
                        </span>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-semibold">
                        ALLOWED
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800 mt-6">
          <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-2">🔐 How RLS Works</h3>
          <div className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
            <p>
              <strong>Row Level Security (RLS)</strong> enforces access control at the database level:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Owner/Admin:</strong> Access to all company data</li>
              <li><strong>Manager:</strong> Access to assigned branch data</li>
              <li><strong>Salesman:</strong> Access to own records or branch records (configurable)</li>
              <li><strong>User:</strong> Access to own records only</li>
            </ul>
            <p className="mt-3">
              The RLS policy automatically filters queries based on the user's role and branch assignments, ensuring data security at the database level.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}