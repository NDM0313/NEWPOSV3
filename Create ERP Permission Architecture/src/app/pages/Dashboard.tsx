import { Layout } from '../components/Layout';
import { roleConfigs } from '../data/mockData';
import { useData } from '../context/DataContext';
import { Shield, Users, Building2, CheckCircle2 } from 'lucide-react';

export function Dashboard() {
  const { permissions, users, branches } = useData();
  
  const totalPermissions = permissions.length;
  const allowedPermissions = permissions.filter(p => p.allowed).length;

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">ERP Permission Architecture</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Standard role-based permission system with branch-level access control
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Roles</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{roleConfigs.length}</p>
              </div>
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-lg">
                <Shield className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Users</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{users.filter(u => u.active).length}</p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <Users className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Branches</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{branches.length}</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                <Building2 className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Permissions</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{allowedPermissions}/{totalPermissions}</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                <CheckCircle2 className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Role Cards */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Role Hierarchy</h2>
          <div className="space-y-3">
            {roleConfigs.map((roleConfig) => (
              <div
                key={roleConfig.role}
                className="flex items-center gap-4 p-4 rounded-lg border-2 transition-all hover:shadow-md dark:hover:shadow-slate-900/50"
                style={{ borderColor: roleConfig.color + '40' }}
              >
                <div
                  className="size-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: roleConfig.color + '20' }}
                >
                  {roleConfig.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white uppercase">{roleConfig.role}</h3>
                    <span
                      className="px-2 py-1 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: roleConfig.color }}
                    >
                      Level {roleConfig.level}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{roleConfig.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Users</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {users.filter(u => u.role === roleConfig.role).length}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Layers */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 rounded-xl shadow-lg p-8 text-white border border-slate-700">
          <h2 className="text-xl font-bold mb-6">4-Layer Permission Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
              <div className="text-3xl mb-2">1️⃣</div>
              <h3 className="font-bold mb-2">ROLE LAYER</h3>
              <p className="text-sm text-slate-300">
                Owner, Admin, Manager, Salesman, User
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
              <div className="text-3xl mb-2">2️⃣</div>
              <h3 className="font-bold mb-2">BRANCH ACCESS</h3>
              <p className="text-sm text-slate-300">
                Multi-branch assignment control
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
              <div className="text-3xl mb-2">3️⃣</div>
              <h3 className="font-bold mb-2">MODULE PERMISSION</h3>
              <p className="text-sm text-slate-300">
                Sales, Payments, Ledger, Inventory
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
              <div className="text-3xl mb-2">4️⃣</div>
              <h3 className="font-bold mb-2">VISIBILITY RULE</h3>
              <p className="text-sm text-slate-300">
                Own vs Branch vs Company level
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}