import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  RefreshCw,
} from 'lucide-react';
import type { User } from '../../types';
import * as reportsApi from '../../api/reports';
import * as inventoryApi from '../../api/inventory';

interface DashboardModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
  onNewSale?: () => void;
  onNewPurchase?: () => void;
}

function StatCard({
  title,
  value,
  change,
  trend,
  icon,
  color,
}: {
  title: string;
  value: number;
  change?: number;
  trend?: 'up' | 'down';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple';
}) {
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
        {change != null && trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${trend === 'up' ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'}`}>
            {trend === 'up' ? <TrendingUp size={14} className="text-[#10B981]" /> : <TrendingDown size={14} className="text-[#EF4444]" />}
            <span className={`text-xs font-medium ${trend === 'up' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {Math.abs(change)}%
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-[#9CA3AF] mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">
        {title.includes('Orders') ? value : `Rs. ${value.toLocaleString()}`}
      </p>
    </div>
  );
}

export function DashboardModule({ onBack, user: _user, companyId, branchId, onNewSale, onNewPurchase }: DashboardModuleProps) {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sales, setSales] = useState(0);
  const [purchases, setPurchases] = useState(0);
  const [orders, setOrders] = useState(0);
  const [lowStock, setLowStock] = useState<{ name: string; current: number; min: number }[]>([]);
  const [pendingOrders, setPendingOrders] = useState<{ id: string; customer: string; amount: number; status: string }[]>([]);

  const days = timeRange === 'today' ? 1 : timeRange === 'week' ? 7 : 30;

  const loadData = async () => {
    if (!companyId) return;
    setIsRefreshing(true);
    const [salesRes, purchasesRes, invRes] = await Promise.all([
      reportsApi.getSalesSummary(companyId, branchId, days),
      reportsApi.getPurchasesSummary(companyId, branchId, days),
      inventoryApi.getInventory(companyId),
    ]);
    setIsRefreshing(false);
    setSales(salesRes.data?.totalSales ?? 0);
    setPurchases(purchasesRes.data?.totalPurchases ?? 0);
    setOrders(salesRes.data?.count ?? 0);
    const lowStockItems = (invRes.data || []).filter((p) => p.isLowStock).slice(0, 5);
    setLowStock(lowStockItems.map((p) => ({ name: p.name, current: p.stock, min: p.minStock })));
    setPendingOrders([]);
  };

  useEffect(() => {
    loadData();
  }, [companyId, branchId, days]);

  const profit = Math.max(0, sales - purchases);

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white">
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
            onClick={() => loadData()}
            disabled={isRefreshing}
            className="p-2 text-[#9CA3AF] hover:text-white hover:bg-[#374151] rounded-lg transition-colors disabled:opacity-50 text-white"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
              }`}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-3">
          <StatCard title="Total Sales" value={sales} icon={<DollarSign size={20} />} color="blue" />
          <StatCard title="Total Purchases" value={purchases} icon={<ShoppingCart size={20} />} color="green" />
          <StatCard title="Net Profit" value={profit} icon={<TrendingUp size={20} />} color="purple" />
          <StatCard title="Total Orders" value={orders} icon={<Package size={20} />} color="blue" />
        </div>

        {lowStock.length > 0 && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-white">Low Stock Alert</h3>
              <span className="ml-auto px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-xs rounded">
                {lowStock.length} items
              </span>
            </div>
            <div className="space-y-2">
              {lowStock.map((item, i) => (
                <div key={i} className="bg-[#111827] rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{item.name}</p>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      Current: {item.current} • Min: {item.min}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingOrders.length > 0 && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="font-semibold text-white mb-4">Pending Orders</h3>
            <div className="space-y-2">
              {pendingOrders.map((order) => (
                <div key={order.id} className="bg-[#111827] rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{order.id || 'Order'}</p>
                    <p className="text-xs text-[#9CA3AF] mt-1">{order.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white font-medium">Rs. {order.amount.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${order.status === 'pending' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {onNewSale && (
            <button onClick={onNewSale} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-colors text-left">
              <ShoppingCart className="w-6 h-6 text-[#3B82F6] mb-2" />
              <p className="text-sm font-medium text-white">New Sale</p>
            </button>
          )}
          {onNewPurchase && (
            <button onClick={onNewPurchase} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-colors text-left">
              <Package className="w-6 h-6 text-[#10B981] mb-2" />
              <p className="text-sm font-medium text-white">New Purchase</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
