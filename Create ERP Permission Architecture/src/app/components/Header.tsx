import { Shield, Users, Grid3x3, Building2, Code, LayoutDashboard, Moon, Sun, Settings as SettingsIcon, User } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';

export function Header() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/roles', icon: Shield, label: 'Roles' },
    { path: '/permissions', icon: Grid3x3, label: 'Matrix' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/branches', icon: Building2, label: 'Branch' },
    { path: '/rls-simulator', icon: Code, label: 'RLS' },
  ];

  return (
    <div className="sticky top-0 z-50 bg-slate-900 dark:bg-slate-950 border-b border-slate-800">
      {/* Main Header */}
      <div className="h-[72px] px-6 flex items-center justify-between">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-3">
          <Shield className="size-7 text-emerald-400" />
          <div>
            <h1 className="text-lg font-bold text-white">ERP Permission Architecture</h1>
            <p className="text-xs text-slate-400">Standard System v1.0</p>
          </div>
        </div>

        {/* Right: User Avatar & Theme Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="size-10 flex items-center justify-center rounded-lg bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 transition-all text-slate-300"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          
          <div className="size-10 flex items-center justify-center rounded-full bg-emerald-600 text-white font-semibold">
            <User className="size-5" />
          </div>
        </div>
      </div>

      {/* Icon Navigation Row */}
      <div className="px-6 pb-4 flex items-center justify-center">
        <div className="flex items-center gap-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = 
              location.pathname === item.path || 
              (item.path === '/settings' && location.pathname.startsWith('/settings'));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className="group flex flex-col items-center gap-2 transition-all"
              >
                {/* Icon Container */}
                
                {/* Label */}
                <span
                  className={`text-xs font-medium transition-all ${
                    isActive ? 'text-white font-bold' : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  {item.label}
                </span>

                {/* Optional bottom indicator */}
                {isActive && (
                  <div className="h-0.5 w-6 bg-emerald-400 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}