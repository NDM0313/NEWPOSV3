import { ShoppingCart, ShoppingBag, Shirt, Camera, DollarSign, Receipt, Package, User as UserIcon, LogOut, TrendingUp, Settings as SettingsIcon, Info, Sparkles } from 'lucide-react';
import { User, Branch, Screen } from '../App';
import { useResponsive } from '../hooks/useResponsive';
import { useState } from 'react';
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

export function HomeScreen({ user, branch, onNavigate, onLogout }: HomeScreenProps) {
  const responsive = useResponsive();
  const [showFeatures, setShowFeatures] = useState(false);

  if (showFeatures) {
    return <FeaturesShowcase onClose={() => setShowFeatures(false)} />;
  }
  
  const modules: ModuleCard[] = [
    {
      id: 'sales',
      title: 'Sales',
      icon: <ShoppingCart className="w-8 h-8" />,
      color: '#3B82F6',
      bgColor: 'bg-[#3B82F6]/10',
      enabled: true,
    },
    {
      id: 'purchase',
      title: 'Purchase',
      icon: <ShoppingBag className="w-8 h-8" />,
      color: '#10B981',
      bgColor: 'bg-[#10B981]/10',
      enabled: true,
    },
    {
      id: 'rental',
      title: 'Rental',
      icon: <Shirt className="w-8 h-8" />,
      color: '#8B5CF6',
      bgColor: 'bg-[#8B5CF6]/10',
      enabled: true,
    },
    {
      id: 'studio',
      title: 'Studio',
      icon: <Camera className="w-8 h-8" />,
      color: '#EC4899',
      bgColor: 'bg-[#EC4899]/10',
      enabled: true,
    },
    {
      id: 'accounts',
      title: 'Accounts',
      icon: <DollarSign className="w-8 h-8" />,
      color: '#F59E0B',
      bgColor: 'bg-[#F59E0B]/10',
      enabled: true,
    },
    {
      id: 'expense',
      title: 'Expense',
      icon: <Receipt className="w-8 h-8" />,
      color: '#EF4444',
      bgColor: 'bg-[#EF4444]/10',
      enabled: true,
    },
    {
      id: 'contacts',
      title: 'Contacts',
      icon: <UserIcon className="w-8 h-8" />,
      color: '#6366F1',
      bgColor: 'bg-[#6366F1]/10',
      enabled: true,
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: <TrendingUp className="w-8 h-8" />,
      color: '#8B5CF6',
      bgColor: 'bg-[#8B5CF6]/10',
      enabled: true,
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: <SettingsIcon className="w-8 h-8" />,
      color: '#6B7280',
      bgColor: 'bg-[#6B7280]/10',
      enabled: true,
    },
  ];

  const enabledModules = modules.filter(m => m.enabled);

  // Tablet Dashboard View
  if (responsive.isTablet) {
    return (
      <div className="min-h-screen pb-20 bg-[#111827]">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name}! 👋</h1>
            <p className="text-white/80">Here's what's happening with your business today</p>
          </div>
        </div>

        {/* Constrained Content Container - Professional SaaS Layout */}
        <div className="max-w-6xl mx-auto p-8">
          {/* Quick Stats - 3 Column Layout for Better Balance */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#3B82F6]/10 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-[#3B82F6]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Today's Sales</p>
                  <p className="text-2xl font-bold text-white">Rs. 45,000</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#10B981]">↗ +12%</span>
                <span className="text-[#6B7280]">vs yesterday</span>
              </div>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#F59E0B]/10 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Pending Orders</p>
                  <p className="text-2xl font-bold text-white">12</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#6B7280]">3 deliveries today</span>
              </div>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center">
                  <Shirt className="w-6 h-6 text-[#8B5CF6]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Active Rentals</p>
                  <p className="text-2xl font-bold text-white">8</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#EF4444]">2 returns due</span>
              </div>
            </div>
          </div>

          {/* Two Column Layout - Left: Modules, Right: Recent Activity */}
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column - Modules */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Quick Access</h2>
              <div className="grid grid-cols-3 gap-4">
                {enabledModules.map((module) => (
                  <button
                    key={module.id}
                    onClick={() => onNavigate(module.id)}
                    className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6] hover:scale-105 active:scale-95 transition-all group"
                  >
                    <div
                      className={`w-12 h-12 ${module.bgColor} rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:scale-110 transition-transform`}
                      style={{ color: module.color }}
                    >
                      {module.icon}
                    </div>
                    <p className="font-medium text-center text-white text-sm">{module.title}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column - Recent Activity */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
              <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6">
                <div className="space-y-4">
                  {[
                    { type: 'Sale', customer: 'Sarah Ahmed', amount: 'Rs. 15,000', time: '10 mins ago', color: '#3B82F6' },
                    { type: 'Rental', customer: 'Ayesha Khan', amount: 'Rs. 8,000', time: '25 mins ago', color: '#8B5CF6' },
                    { type: 'Purchase', customer: 'Ali Fabrics', amount: 'Rs. 25,000', time: '1 hour ago', color: '#10B981' },
                    { type: 'Sale', customer: 'Fatima Sheikh', amount: 'Rs. 12,000', time: '2 hours ago', color: '#3B82F6' },
                    { type: 'Expense', customer: 'Utilities Bill', amount: 'Rs. 3,500', time: '3 hours ago', color: '#EF4444' },
                  ].map((activity, idx) => (
                    <div key={idx} className="flex items-center justify-between py-3 border-b border-[#374151] last:border-0">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${activity.color}20` }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activity.color }}></div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{activity.type}</p>
                          <p className="text-xs text-[#6B7280]">{activity.customer}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{activity.amount}</p>
                        <p className="text-xs text-[#6B7280]">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl p-4 transition-colors">
                  <p className="text-sm font-semibold">New Sale</p>
                  <p className="text-xs opacity-80 mt-1">Quick entry</p>
                </button>
                <button className="bg-[#10B981] hover:bg-[#059669] text-white rounded-xl p-4 transition-colors">
                  <p className="text-sm font-semibold">New Rental</p>
                  <p className="text-xs opacity-80 mt-1">Book now</p>
                </button>
              </div>
            </div>
          </div>

          {/* Features Button */}
          <button
            onClick={() => setShowFeatures(true)}
            className="mt-8 w-full p-4 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] rounded-xl hover:from-[#5558E3] hover:to-[#4338CA] active:scale-95 transition-all"
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

  // Mobile Dashboard View
  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1F2937] to-[#111827] p-6 pb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1">Din Collection</h1>
            <p className="text-sm text-[#9CA3AF]">Welcome, {user.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
              <p className="text-xs text-[#D1D5DB]">{branch.name}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111827]/50 backdrop-blur-sm border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Today's Sales</p>
            <p className="text-lg font-bold text-[#10B981]">Rs. 45,000</p>
          </div>
          <div className="bg-[#111827]/50 backdrop-blur-sm border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Pending</p>
            <p className="text-lg font-bold text-[#F59E0B]">Rs. 12,000</p>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className={responsive.spacing.page}>
        <h2 className="text-sm font-medium text-[#9CA3AF] mb-4">MODULES</h2>
        <div 
          className={`grid ${responsive.spacing.grid}`}
          style={{ gridTemplateColumns: `repeat(${responsive.columns.dashboard}, minmax(0, 1fr))` }}
        >
          {enabledModules.map((module) => (
            <button
              key={module.id}
              onClick={() => onNavigate(module.id)}
              className={`bg-[#1F2937] border border-[#374151] rounded-2xl ${
                responsive.isTablet ? 'p-8' : 'p-6'
              } hover:border-[#3B82F6] active:scale-[0.95] transition-all group`}
            >
              <div
                className={`${
                  responsive.isTablet ? 'w-20 h-20' : 'w-16 h-16'
                } ${module.bgColor} rounded-2xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform`}
                style={{ color: module.color }}
              >
                {module.icon}
              </div>
              <p className={`font-medium text-center ${responsive.isTablet ? 'text-base' : 'text-sm'}`}>
                {module.title}
              </p>
            </button>
          ))}
        </div>

        {/* Info Card */}
        <div className="mt-6 p-4 bg-[#1F2937] border border-[#374151] rounded-xl">
          <p className="text-xs text-[#9CA3AF] text-center">
            {responsive.isTablet 
              ? 'Click on any module to access its features'
              : 'Use bottom navigation to switch between modules quickly'
            }
          </p>
        </div>

        {/* Features & Methods Button */}
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