import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, ArrowDownRight, ArrowUpRight, AlertTriangle, ArrowRight, Scissors, Loader2 } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useSales } from '../../context/SalesContext';
import { usePurchases } from '../../context/PurchaseContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useDateRange } from '../../context/DateRangeContext';
import { productService } from '../../services/productService';
import { getSalesByCategory } from '../../services/dashboardService';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

interface Product {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  min_stock: number;
}

export const Dashboard = () => {
  const { setCurrentView } = useNavigation();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const { companyId, signOut } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { dateRange } = useDateRange();
  const startDate = dateRange.startDate;
  const endDate = dateRange.endDate;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesByCategory, setSalesByCategory] = useState<Array<{ categoryName: string; total: number }>>([]);
  const [loadingCategory, setLoadingCategory] = useState(true);

  // Load products for low stock items
  const loadProducts = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const productsData = await productService.getAllProducts(companyId);
      setProducts(productsData as Product[]);
    } catch (error) {
      console.error('[DASHBOARD] Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load sales by category from backend (date range applied)
  useEffect(() => {
    if (!companyId) {
      setLoadingCategory(false);
      return;
    }
    setLoadingCategory(true);
    const start = startDate ? new Date(startDate).toISOString().split('T')[0] : null;
    const end = endDate ? new Date(endDate).toISOString().split('T')[0] : null;
    getSalesByCategory(companyId, start, end)
      .then(setSalesByCategory)
      .catch((err) => {
        console.error('[DASHBOARD] Sales by category error:', err);
        setSalesByCategory([]);
      })
      .finally(() => setLoadingCategory(false));
  }, [companyId, startDate, endDate]);

  // Filter data by date range
  const filterByDateRange = useCallback((dateStr: string | undefined): boolean => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    
    const date = new Date(dateStr);
    if (startDate && date < new Date(startDate)) return false;
    if (endDate && date > new Date(endDate + 'T23:59:59')) return false;
    return true;
  }, [startDate, endDate]);

  // Calculate metrics from real data (filtered by date range)
  const metrics = useMemo(() => {
    const filteredSales = sales.sales.filter(sale => filterByDateRange(sale.date));
    const finalSales = filteredSales.filter(s => (s as any).status === 'final');
    const filteredPurchases = purchases.purchases.filter(purchase => filterByDateRange(purchase.poDate));
    const finalPurchases = filteredPurchases.filter(p => (p as any).status === 'final' || (p as any).status === 'received');
    const filteredExpenses = expenses.expenses.filter(expense => filterByDateRange(expense.expenseDate));

    const totalSales = finalSales.reduce((sum, sale) => sum + (sale.total ?? 0), 0);
    const totalPurchases = finalPurchases.reduce((sum, purchase) => sum + (purchase.total ?? 0), 0);
    
    const totalExpenses = filteredExpenses
      .filter(e => e.status === 'paid')
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    const totalReceivables = finalSales.reduce((sum, sale) => sum + (sale.due ?? 0), 0);
    const totalPayables = finalPurchases.reduce((sum, purchase) => sum + (purchase.due ?? 0), 0);
    
    const netProfit = totalSales - totalPurchases - totalExpenses;

    return {
      totalSales,
      totalPurchases,
      totalExpenses,
      totalReceivables,
      totalPayables,
      netProfit,
    };
  }, [sales.sales, purchases.purchases, expenses.expenses, filterByDateRange]);

  // Get low stock items
  const lowStockItems = useMemo(() => {
    return products
      .filter(p => p.current_stock < p.min_stock)
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.current_stock,
        min: p.min_stock,
      }));
  }, [products]);

  // Generate chart data from date range (or last 7 days if no range)
  const chartData = useMemo(() => {
    // Use date range if set, otherwise default to last 7 days
    let start: Date;
    let end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to last 7 days
      end = new Date();
      start = new Date();
      start.setDate(end.getDate() - 6);
    }
    
    const data: Array<{ name: string; sales: number; profit: number }> = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayLabel = currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      
      // Filter by date range
      const daySales = sales.sales
        .filter(s => {
          if (!s.date?.startsWith(dateStr)) return false;
          return filterByDateRange(s.date);
        })
        .reduce((sum, sale) => sum + (sale.type === 'invoice' ? sale.total : 0), 0);
      
      const dayPurchases = purchases.purchases
        .filter(p => {
          if (!p.poDate?.startsWith(dateStr)) return false;
          return filterByDateRange(p.poDate);
        })
        .reduce((sum, purchase) => sum + purchase.total, 0);
      
      const dayProfit = daySales - dayPurchases;
      
      data.push({
        name: dayLabel,
        sales: daySales,
        profit: dayProfit,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return data;
  }, [sales.sales, purchases.purchases, startDate, endDate, filterByDateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Logged in but no company (user not in public.users) — show create-business CTA
  if (!companyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8 rounded-xl bg-[#1F2937] border border-[#374151]">
          <h2 className="text-xl font-bold text-white mb-2">Create your business</h2>
          <p className="text-[#9CA3AF] mb-6">
            You’re signed in but don’t have a business yet. Sign out and use <strong className="text-white">Create New Business</strong> on the login page to get started.
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white hover:bg-[#2563EB]"
            onClick={async () => {
              await signOut();
              window.location.href = '/';
            }}
          >
            Sign out and go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-red-500 font-bold">Low Stock Alert</h3>
              <p className="text-red-400 text-sm">{lowStockItems.length} items are below minimum stock level</p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentView('inventory')}
            className="text-sm font-medium text-red-500 hover:text-red-400 flex items-center gap-1"
          >
            View Inventory <ArrowRight size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
          title="Total Due (Receivables)" 
          value={formatCurrency(metrics.totalReceivables)} 
          change="—" 
          icon={ArrowDownRight} 
          trend="up"
          iconColor="text-[#3B82F6]"
        />
        <StatCard 
          title="Supplier Due (Payables)" 
          value={formatCurrency(metrics.totalPayables)} 
          change="—" 
          icon={ArrowUpRight} 
          trend="down"
          iconColor="text-[#F59E0B]"
        />
        <StatCard 
          title="Net Profit" 
          value={formatCurrency(metrics.netProfit)} 
          change={metrics.netProfit >= 0 ? "—" : "—"} 
          icon={DollarSign} 
          trend={metrics.netProfit >= 0 ? "up" : "down"}
          iconColor="text-[#10B981]"
        />
        <StatCard 
          title="Total Sales" 
          value={formatCurrency(metrics.totalSales)} 
          change="—" 
          icon={ShoppingBag} 
          trend="up"
          iconColor="text-[#8B5CF6]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111827]/50 border border-[#374151] p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-6">Revenue & Profit</h3>
          <div className="w-full h-[320px] min-h-[320px]">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#9CA3AF]">
                <p className="text-sm">No sales or purchase data in the selected date range</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#9CA3AF" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                    itemStyle={{ color: '#F3F4F6' }}
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area type="monotone" dataKey="sales" name="Revenue" stroke="#3B82F6" fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

          <div className="space-y-6">
           {/* Low Stock List */}
          <div className="bg-[#111827]/50 border border-[#374151] p-6 rounded-xl flex-1">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              Critical Stock
            </h3>
            {lowStockItems.length > 0 ? (
              <>
                <div className="space-y-4">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-[#1F2937] rounded-lg border border-[#374151]">
                      <div>
                        <p className="font-medium text-white text-sm">{item.name}</p>
                        <p className="text-xs text-[#9CA3AF]">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-500">{item.stock}</p>
                        <p className="text-xs text-[#9CA3AF]">Min: {item.min}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setCurrentView('inventory')}
                  className="w-full mt-4 py-2 text-sm text-center text-[#3B82F6] hover:text-[#60A5FA]"
                >
                  View All Low Stock
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-[#9CA3AF]">
                <p className="text-sm">No low stock items</p>
              </div>
            )}
          </div>

          <div className="bg-[#111827]/50 border border-[#374151] p-6 rounded-xl">
             <h3 className="text-lg font-bold text-white mb-6">Sales by Category</h3>
             {loadingCategory ? (
               <div className="h-40 flex items-center justify-center">
                 <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
               </div>
             ) : salesByCategory.length === 0 ? (
               <div className="h-40 flex items-center justify-center text-[#9CA3AF] text-sm">
                 No sales by category in the selected date range
               </div>
             ) : (
               <div className="w-full h-48 min-h-[192px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={salesByCategory} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                     <XAxis type="number" stroke="#9CA3AF" tickFormatter={(v) => formatCurrency(v)} />
                     <YAxis type="category" dataKey="categoryName" stroke="#9CA3AF" width={90} tick={{ fontSize: 11 }} />
                     <Tooltip
                       contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                       formatter={(value: number) => [formatCurrency(value), 'Sales']}
                       labelFormatter={(label) => `Category: ${label}`}
                     />
                     <Bar dataKey="total" name="Sales" radius={[0, 4, 4, 0]}>
                       {salesByCategory.map((_, index) => (
                         <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, change, icon: Icon, trend, iconColor }: any) => (
  <div className="bg-[#111827]/50 border border-[#374151] rounded-xl p-4 md:p-6 relative overflow-hidden group hover:border-[#3B82F6]/50 transition-all duration-300">
    <div className="flex justify-between items-start mb-2 md:mb-4">
      <div className={`p-2 rounded-lg bg-[#374151]/50 ${iconColor || 'text-[#3B82F6]'}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
        trend === 'up' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'
      }`}>
        {change}
      </span>
    </div>
    <h3 className="text-[#9CA3AF] text-xs md:text-sm font-medium">{title}</h3>
    <p className="text-lg md:text-2xl font-bold text-white mt-1">{value}</p>
  </div>
);