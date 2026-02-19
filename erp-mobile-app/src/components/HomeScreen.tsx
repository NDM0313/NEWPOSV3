import {
  ShoppingCart, ShoppingBag, Shirt, Camera, DollarSign, Receipt, Package, User as UserIcon,
  LogOut, TrendingUp, Settings as SettingsIcon, Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { User, Branch, Screen } from '../types';
import { useResponsive } from '../hooks/useResponsive';
import { FeaturesShowcase } from './FeaturesShowcase';

interface HomeScreenProps {
  user: User;
  branch: Branch;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}

interface ModuleCard {
  id: Screen;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  enabled: boolean;
}

const MODULES: ModuleCard[] = [
  { id: 'sales', title: 'Sales', icon: <ShoppingCart className="w-8 h-8" />, color: '#3B82F6', bgColor: 'bg-[#3B82F6]/10', enabled: true },
  { id: 'purchase', title: 'Purchase', icon: <ShoppingBag className="w-8 h-8" />, color: '#10B981', bgColor: 'bg-[#10B981]/10', enabled: true },
  { id: 'rental', title: 'Rental', icon: <Shirt className="w-8 h-8" />, color: '#8B5CF6', bgColor: 'bg-[#8B5CF6]/10', enabled: true },
  { id: 'studio', title: 'Studio', icon: <Camera className="w-8 h-8" />, color: '#EC4899', bgColor: 'bg-[#EC4899]/10', enabled: true },
  { id: 'accounts', title: 'Accounts', icon: <DollarSign className="w-8 h-8" />, color: '#F59E0B', bgColor: 'bg-[#F59E0B]/10', enabled: true },
  { id: 'expense', title: 'Expense', icon: <Receipt className="w-8 h-8" />, color: '#EF4444', bgColor: 'bg-[#EF4444]/10', enabled: true },
  { id: 'products', title: 'Products', icon: <Package className="w-8 h-8" />, color: '#3B82F6', bgColor: 'bg-[#3B82F6]/10', enabled: true },
  { id: 'inventory', title: 'Inventory', icon: <Package className="w-8 h-8" />, color: '#10B981', bgColor: 'bg-[#10B981]/10', enabled: true },
  { id: 'contacts', title: 'Contacts', icon: <UserIcon className="w-8 h-8" />, color: '#6366F1', bgColor: 'bg-[#6366F1]/10', enabled: true },
  { id: 'reports', title: 'Reports', icon: <TrendingUp className="w-8 h-8" />, color: '#8B5CF6', bgColor: 'bg-[#8B5CF6]/10', enabled: true },
  { id: 'settings', title: 'Settings', icon: <SettingsIcon className="w-8 h-8" />, color: '#6B7280', bgColor: 'bg-[#6B7280]/10', enabled: true },
];

export function HomeScreen({ user, branch, onNavigate, onLogout }: HomeScreenProps) {
  const responsive = useResponsive();
  const [showFeatures, setShowFeatures] = useState(false);

  if (showFeatures) {
    return <FeaturesShowcase onClose={() => setShowFeatures(false)} />;
  }

  const enabled = MODULES.filter((m) => m.enabled);

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-gradient-to-br from-[#1F2937] to-[#111827] p-6 pb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Din Collection</h1>
            <p className="text-sm text-[#9CA3AF]">Welcome, {user.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-[#10B981] rounded-full" />
              <p className="text-xs text-[#D1D5DB]">{branch.name}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg transition-colors text-white"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111827]/50 border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Today's Sales</p>
            <p className="text-lg font-bold text-[#10B981]">Rs. 45,000</p>
          </div>
          <div className="bg-[#111827]/50 border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Pending</p>
            <p className="text-lg font-bold text-[#F59E0B]">Rs. 12,000</p>
          </div>
        </div>
      </div>

      <div className={responsive.spacing.page}>
        <h2 className="text-sm font-medium text-[#9CA3AF] mb-4">MODULES</h2>
        <div
          className={`grid ${responsive.spacing.grid}`}
          style={{ gridTemplateColumns: `repeat(${responsive.columns.dashboard}, minmax(0, 1fr))` }}
        >
          {enabled.map((module) => (
            <button
              key={module.id}
              onClick={() => onNavigate(module.id)}
              className={`bg-[#1F2937] border border-[#374151] rounded-2xl ${responsive.isTablet ? 'p-8' : 'p-6'} hover:border-[#3B82F6] active:scale-95 transition-all group`}
            >
              <div
                className={`${responsive.isTablet ? 'w-20 h-20' : 'w-16 h-16'} ${module.bgColor} rounded-2xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform`}
                style={{ color: module.color }}
              >
                {module.icon}
              </div>
              <p className={`font-medium text-center text-white ${responsive.isTablet ? 'text-base' : 'text-sm'}`}>
                {module.title}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-6 p-4 bg-[#1F2937] border border-[#374151] rounded-xl">
          <p className="text-xs text-[#9CA3AF] text-center">
            {responsive.isTablet ? 'Click on any module to access its features' : 'Use bottom navigation to switch between modules quickly'}
          </p>
        </div>

        <button
          onClick={() => setShowFeatures(true)}
          className="mt-4 w-full p-4 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] rounded-xl hover:from-[#5558E3] hover:to-[#4338CA] active:scale-95 transition-all"
        >
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-semibold">View All Features & Methods</span>
          </div>
          <p className="text-xs text-white/70 mt-1">12 Modules • 100+ Features • Complete Workflows</p>
        </button>
      </div>
    </div>
  );
}
