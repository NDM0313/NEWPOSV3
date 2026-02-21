import {
  ShoppingCart, ShoppingBag, Shirt, Camera, Receipt, Package, Archive,
  CreditCard, Users, Home, LogOut, ChevronRight, TrendingUp, Settings, Calculator,
} from 'lucide-react';
import type { User, Branch, Screen } from '../types';

interface TabletSidebarProps {
  user: User;
  branch: Branch;
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}

interface ModuleItem {
  id: Screen;
  title: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
}

export function TabletSidebar({ user, branch, currentScreen, onNavigate, onLogout }: TabletSidebarProps) {
  const modules: ModuleItem[] = [
    { id: 'dashboard', title: 'Dashboard', icon: <Home size={20} />, color: '#8B5CF6', enabled: true },
    { id: 'sales', title: 'Sales', icon: <ShoppingCart size={20} />, color: '#3B82F6', enabled: true },
    { id: 'purchase', title: 'Purchase', icon: <ShoppingBag size={20} />, color: '#10B981', enabled: true },
    { id: 'rental', title: 'Rental', icon: <Shirt size={20} />, color: '#8B5CF6', enabled: true },
    { id: 'studio', title: 'Studio', icon: <Camera size={20} />, color: '#EC4899', enabled: true },
    { id: 'accounts', title: 'Accounts', icon: <Calculator size={20} />, color: '#F59E0B', enabled: true },
    { id: 'expense', title: 'Expense', icon: <Receipt size={20} />, color: '#EF4444', enabled: true },
    { id: 'products', title: 'Products', icon: <Archive size={20} />, color: '#8B5CF6', enabled: true },
    { id: 'inventory', title: 'Inventory', icon: <Package size={20} />, color: '#10B981', enabled: true },
    { id: 'pos', title: 'Point of Sale', icon: <CreditCard size={20} />, color: '#3B82F6', enabled: true },
    { id: 'contacts', title: 'Contacts', icon: <Users size={20} />, color: '#6366F1', enabled: true },
    { id: 'reports', title: 'Reports', icon: <TrendingUp size={20} />, color: '#8B5CF6', enabled: true },
    { id: 'settings', title: 'Settings', icon: <Settings size={20} />, color: '#6B7280', enabled: true },
  ];

  const enabled = modules.filter((m) => m.enabled);

  return (
    <div className="w-72 h-screen bg-[#1F2937] border-r border-[#374151] flex flex-col">
      <div className="p-6 border-b border-[#374151]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <span className="text-xl font-bold text-white">DC</span>
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-white">Din Collection</h1>
            <p className="text-xs text-[#9CA3AF]">ERP System</p>
          </div>
        </div>
        <div className="bg-[#111827] rounded-lg p-3">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-[#9CA3AF]">{branch.name}</p>
          <span className="inline-block mt-2 px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs rounded-full font-medium">
            {user.role.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-3 space-y-1">
          {enabled.map((module) => {
            const isActive = currentScreen === module.id;
            return (
              <button
                key={module.id}
                onClick={() => onNavigate(module.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive ? 'bg-[#8B5CF6] text-white shadow-lg' : 'text-[#9CA3AF] hover:bg-[#374151] hover:text-white'
                }`}
              >
                <span style={{ color: isActive ? 'white' : module.color }}>{module.icon}</span>
                <span className="flex-1 text-left text-sm font-medium">{module.title}</span>
                {isActive && <ChevronRight size={16} className="opacity-60" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 border-t border-[#374151]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
