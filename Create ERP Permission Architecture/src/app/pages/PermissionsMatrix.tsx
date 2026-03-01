import { useState } from 'react';
import { Layout } from '../components/Layout';
import { roleConfigs } from '../data/mockData';
import { useData } from '../context/DataContext';
import { Module, Action, Role } from '../types/permission';
import { Check, X, Save } from 'lucide-react';

export function PermissionsMatrix() {
  const { permissions, updatePermission } = useData();
  const [selectedRole, setSelectedRole] = useState<Role>('salesman');
  const [hasChanges, setHasChanges] = useState(false);

  const modules: Module[] = ['sales', 'payments', 'ledger', 'inventory', 'accounts', 'reports', 'users', 'settings'];
  const actions: Action[] = ['view_own', 'view_branch', 'view_company', 'create', 'edit', 'delete', 'approve', 'receive', 'manage'];

  const getPermission = (role: Role, module: Module, action: Action): boolean => {
    const permission = permissions.find(
      p => p.role === role && p.module === module && p.action === action
    );
    return permission?.allowed || false;
  };

  const togglePermission = (module: Module, action: Action) => {
    const currentValue = getPermission(selectedRole, module, action);
    updatePermission({
      role: selectedRole,
      module,
      action,
      allowed: !currentValue
    });
    setHasChanges(true);
  };

  const roleConfig = roleConfigs.find(r => r.role === selectedRole);

  const rolePermissions = permissions.filter(p => p.role === selectedRole);
  const allowedCount = rolePermissions.filter(p => p.allowed).length;
  const deniedCount = rolePermissions.filter(p => !p.allowed).length;

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Permissions Matrix</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Toggle permissions for each role and module
            </p>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-lg">
              <Save className="size-4" />
              <span className="text-sm font-semibold">Changes Saved</span>
            </div>
          )}
        </div>

        {/* Role Selector */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Select Role to Edit</label>
          <div className="flex flex-wrap gap-3">
            {roleConfigs.map((rc) => (
              <button
                key={rc.role}
                onClick={() => {
                  setSelectedRole(rc.role);
                  setHasChanges(false);
                }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  selectedRole === rc.role
                    ? 'ring-2 ring-offset-2 dark:ring-offset-slate-800 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                style={
                  selectedRole === rc.role
                    ? { backgroundColor: rc.color, ringColor: rc.color }
                    : {}
                }
              >
                <span className="text-xl">{rc.icon}</span>
                <span className="uppercase">{rc.role}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current Role Info */}
        {roleConfig && (
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
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase">{roleConfig.role}</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">{roleConfig.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Matrix */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 dark:bg-slate-950 text-white">
                  <th className="text-left p-4 font-semibold sticky left-0 bg-slate-900 dark:bg-slate-950 z-10">
                    Module
                  </th>
                  {actions.map((action) => (
                    <th key={action} className="text-center p-4 font-semibold min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs uppercase tracking-wider">{action.replace('_', ' ')}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module, index) => (
                  <tr
                    key={module}
                    className={index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}
                  >
                    <td className="p-4 font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-inherit uppercase">
                      {module}
                    </td>
                    {actions.map((action) => {
                      const hasPermission = getPermission(selectedRole, module, action);
                      return (
                        <td key={action} className="text-center p-4 border-b border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => togglePermission(module, action)}
                            className={`inline-flex items-center justify-center size-10 rounded-lg transition-all hover:scale-110 ${
                              hasPermission
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {hasPermission ? (
                              <Check className="size-6 text-emerald-600 dark:text-emerald-400 font-bold" />
                            ) : (
                              <X className="size-6 text-slate-400 dark:text-slate-500" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Permission Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-6 border-2 border-emerald-200 dark:border-emerald-800">
            <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 mb-2">Total Allowed</h3>
            <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{allowedCount}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border-2 border-red-200 dark:border-red-800">
            <h3 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">Total Denied</h3>
            <p className="text-4xl font-bold text-red-600 dark:text-red-400">{deniedCount}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800">
            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-2">Permission Ratio</h3>
            <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
              {rolePermissions.length > 0 ? Math.round((allowedCount / rolePermissions.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}