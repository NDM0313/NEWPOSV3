import React, { useState } from 'react';
import { Shield, LayoutDashboard, UserCog, Grid3X3, Users, Building2, Lock } from 'lucide-react';
import { cn } from '../ui/utils';
import { DashboardTab } from './DashboardTab';
import { RolesTab } from './RolesTab';
import { MatrixTab } from './MatrixTab';
import { UsersTab } from './UsersTab';
import { BranchTab } from './BranchTab';
import { RlsTab } from './RlsTab';

export type ErpPermSubView = 'dashboard' | 'roles' | 'matrix' | 'users' | 'branch' | 'rls';

const TABS: { id: ErpPermSubView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'roles', label: 'Roles', icon: UserCog },
  { id: 'matrix', label: 'Matrix', icon: Grid3X3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'branch', label: 'Branch', icon: Building2 },
  { id: 'rls', label: 'RLS', icon: Lock },
];

export function ErpPermissionArchitecturePage() {
  const [subView, setSubView] = useState<ErpPermSubView>('dashboard');

  return (
    <div className="min-h-full bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ERP Permission Architecture</h1>
            <p className="text-sm text-gray-400 mt-0.5">Standard System v1.0</p>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Shield className="text-blue-500" size={20} />
          </div>
        </div>
      </div>

      {/* Top nav: Dashboard | Roles | Matrix | Users | Branch | RLS */}
      <nav className="border-b border-gray-800 bg-gray-900/30 px-6">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubView(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                subView === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="p-6">
        {subView === 'dashboard' && <DashboardTab />}
        {subView === 'roles' && <RolesTab />}
        {subView === 'matrix' && <MatrixTab />}
        {subView === 'users' && <UsersTab />}
        {subView === 'branch' && <BranchTab />}
        {subView === 'rls' && <RlsTab />}
      </main>
    </div>
  );
}
