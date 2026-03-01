import { Shield, Users, Grid3x3, Building2, Code, LayoutDashboard, Moon, Sun, Settings as SettingsIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';

export function Sidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/roles', icon: Shield, label: 'Roles' },
    { path: '/permissions', icon: Grid3x3, label: 'Permissions Matrix' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/branches', icon: Building2, label: 'Branch Access' },
    { path: '/rls-simulator', icon: Code, label: 'RLS Simulator' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="w-64 bg-slate-900 dark:bg-slate-950 text-white h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 border-b border-slate-700 dark:border-slate-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="size-6 text-emerald-400" />
          ERP Permission
        </h1>
        <p className="text-sm text-slate-400 mt-1">Architecture System</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/settings' && location.pathname.startsWith('/settings'));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 dark:hover:bg-slate-900'
              }`}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700 dark:border-slate-800 space-y-3">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors text-slate-300"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="size-5" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="size-5" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
        
        <div className="text-xs text-slate-500">
          Standard ERP Permission Architecture v1.0
        </div>
      </div>
    </div>
  );
}