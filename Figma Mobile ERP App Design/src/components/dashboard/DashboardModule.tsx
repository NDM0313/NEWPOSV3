import { useState } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertCircle,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { User } from '../../App';

interface DashboardModuleProps {
  onBack: () => void;
  user: User;
}

export function DashboardModule({ onBack, user }: DashboardModuleProps) {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Mock data
  const stats = {
    today: {
      sales: { value: 45000, change: 12.5, trend: 'up' },
      purchases: { value: 28000, change: -5.2, trend: 'down' },
      profit: { value: 17000, change: 24.8, trend: 'up' },
      orders: { value: 24, change: 8.3, trend: 'up' },
    },
    week: {
      sales: { value: 285000, change: 15.3, trend: 'up' },
      purchases: { value: 165000, change: -2.1, trend: 'down' },
      profit: { value: 120000, change: 28.5, trend: 'up' },
      orders: { value: 156, change: 12.4, trend: 'up' },
    },
    month: {
      sales: { value: 1200000, change: 18.7, trend: 'up' },
      purchases: { value: 720000, change: 5.3, trend: 'up' },
      profit: { value: 480000, change: 32.1, trend: 'up' },
      orders: { value: 642, change: 15.8, trend: 'up' },
    },
  };

  const currentStats = stats[timeRange];

  const lowStockItems = [
    { name: 'Bridal Lehenga - Red', current: 2, min: 5 },
    { name: 'Wedding Gown - White', current: 1, min: 3 },
    { name: 'Party Dress - Blue', current: 3, min: 5 },
  ];

  const pendingOrders = [
    { id: 'ORD-001', customer: 'Ayesha Khan', amount: 45000, status: 'pending' },
    { id: 'ORD-002', customer: 'Sara Ahmed', amount: 32000, status: 'processing' },
    { id: 'ORD-003', customer: 'Fatima Ali', amount: 28000, status: 'pending' },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-white" />
              </div>
              <h1 className="text-white font-semibold text-base">Dashboard</h1>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-[#9CA3AF] hover:text-white hover:bg-[#374151] rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Time Range Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
              }`}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Main Stats */}
        <div className="space-y-3">
          {/* Sales */}
          <StatCard
            title="Total Sales"
            value={currentStats.sales.value}
            change={currentStats.sales.change}
            trend={currentStats.sales.trend as 'up' | 'down'}
            icon={<DollarSign size={20} />}
            color="blue"
          />

          {/* Purchases */}
          <StatCard
            title="Total Purchases"
            value={currentStats.purchases.value}
            change={currentStats.purchases.change}
            trend={currentStats.purchases.trend as 'up' | 'down'}
            icon={<ShoppingCart size={20} />}
            color="green"
          />

          {/* Profit */}
          <StatCard
            title="Net Profit"
            value={currentStats.profit.value}
            change={currentStats.profit.change}
            trend={currentStats.profit.trend as 'up' | 'down'}
            icon={<TrendingUp size={20} />}
            color="purple"
          />

          {/* Orders */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                  <Package size={20} className="text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{currentStats.orders.value}</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  currentStats.orders.trend === 'up' ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
                }`}
              >
                {currentStats.orders.trend === 'up' ? (
                  <TrendingUp size={14} className="text-[#10B981]" />
                ) : (
                  <TrendingDown size={14} className="text-[#EF4444]" />
                )}
                <span
                  className={`text-xs font-medium ${
                    currentStats.orders.trend === 'up' ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}
                >
                  {currentStats.orders.change}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-[#F59E0B]" />
            <h3 className="font-semibold text-white">Low Stock Alert</h3>
            <span className="ml-auto px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-xs rounded">
              {lowStockItems.length} items
            </span>
          </div>
          <div className="space-y-2">
            {lowStockItems.map((item, index) => (
              <div
                key={index}
                className="bg-[#111827] rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-white font-medium">{item.name}</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    Current: {item.current} • Min: {item.min}
                  </p>
                </div>
                <button className="px-3 py-1.5 bg-[#3B82F6] text-white text-xs rounded-lg font-medium">
                  Reorder
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Pending Orders</h3>
            <button className="text-xs text-[#3B82F6] font-medium">View All</button>
          </div>
          <div className="space-y-2">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#111827] rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-white font-medium">{order.id}</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">{order.customer}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white font-medium">
                    Rs. {order.amount.toLocaleString()}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      order.status === 'pending'
                        ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                        : 'bg-[#3B82F6]/10 text-[#3B82F6]'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-colors">
            <ShoppingCart className="w-6 h-6 text-[#3B82F6] mb-2" />
            <p className="text-sm font-medium text-white">New Sale</p>
          </button>
          <button className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-colors">
            <Package className="w-6 h-6 text-[#10B981] mb-2" />
            <p className="text-sm font-medium text-white">New Purchase</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  change: number;
  trend: 'up' | 'down';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple';
}

function StatCard({ title, value, change, trend, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-[#3B82F6]/10 text-[#3B82F6]',
    green: 'bg-[#10B981]/10 text-[#10B981]',
    purple: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',
  };

  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${colorClasses[color]} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
            trend === 'up' ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
          }`}
        >
          {trend === 'up' ? (
            <TrendingUp size={14} className="text-[#10B981]" />
          ) : (
            <TrendingDown size={14} className="text-[#EF4444]" />
          )}
          <span
            className={`text-xs font-medium ${
              trend === 'up' ? 'text-[#10B981]' : 'text-[#EF4444]'
            }`}
          >
            {Math.abs(change)}%
          </span>
        </div>
      </div>
      <p className="text-xs text-[#9CA3AF] mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">Rs. {value.toLocaleString()}</p>
    </div>
  );
}
