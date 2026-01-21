import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, ArrowDownRight, ArrowUpRight, AlertTriangle, ArrowRight, Scissors, Loader2 } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useSales } from '../../context/SalesContext';
import { usePurchases } from '../../context/PurchaseContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useDateRange } from '../../context/DateRangeContext';
import { productService } from '../../services/productService';
import { formatCurrency } from '../../utils/formatCurrency';

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
  const { companyId } = useSupabase();
  const { startDate, endDate } = useDateRange();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Load products for low stock items
  const loadProducts = useCallback(async () => {
    if (!companyId) return;
    
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
    const filteredPurchases = purchases.purchases.filter(purchase => filterByDateRange(purchase.poDate));
    const filteredExpenses = expenses.expenses.filter(expense => filterByDateRange(expense.expenseDate));

    const totalSales = filteredSales.reduce((sum, sale) => 
      sale.type === 'invoice' ? sum + sale.total : sum, 0
    );
    
    const totalPurchases = filteredPurchases.reduce((sum, purchase) => 
      sum + purchase.total, 0
    );
    
    const totalExpenses = filteredExpenses
      .filter(e => e.status === 'paid')
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    const totalReceivables = sales.sales.reduce((sum, sale) => 
      sale.type === 'invoice' ? sum + sale.due : sum, 0
    );
    
    const totalPayables = purchases.purchases.reduce((sum, purchase) => 
      sum + purchase.due, 0
    );
    
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
    
    // Generate days array based on date range
    const days: string[] = [];
    const data: Array<{ name: string; sales: number; profit: number }> = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = currentDate.toISOString().split('T')[0];
      
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
        name: dayName,
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

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Due (Receivables)" 
          value={formatCurrency(metrics.totalReceivables)} 
          change="—" 
          icon={ArrowDownRight} 
          trend="up"
          iconColor="text-blue-500"
        />
        <StatCard 
          title="Supplier Due (Payables)" 
          value={formatCurrency(metrics.totalPayables)} 
          change="—" 
          icon={ArrowUpRight} 
          trend="down"
          iconColor="text-orange-500"
        />
        <StatCard 
          title="Net Profit" 
          value={formatCurrency(metrics.netProfit)} 
          change={metrics.netProfit >= 0 ? "—" : "—"} 
          icon={DollarSign} 
          trend={metrics.netProfit >= 0 ? "up" : "down"}
          iconColor="text-green-500"
        />
        <StatCard 
          title="Total Sales" 
          value={formatCurrency(metrics.totalSales)} 
          change="—" 
          icon={ShoppingBag} 
          trend="up"
          iconColor="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Revenue & Profit</h3>
          <div className="w-full h-[320px] min-h-[320px]">
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
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                  itemStyle={{ color: '#F3F4F6' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="sales" stroke="#3B82F6" fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
           {/* Low Stock List */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              Critical Stock
            </h3>
            {lowStockItems.length > 0 ? (
              <>
                <div className="space-y-4">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-500">{item.stock}</p>
                        <p className="text-xs text-gray-500">Min: {item.min}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setCurrentView('inventory')}
                  className="w-full mt-4 py-2 text-sm text-center text-blue-500 hover:text-blue-400"
                >
                  View All Low Stock
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No low stock items</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Sales by Category</h3>
             {/* Simple Placeholder for another chart */}
             <div className="h-40 flex items-center justify-center text-gray-500">
                <div className="flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, change, icon: Icon, trend, iconColor }: any) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl relative overflow-hidden group hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
    <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg ${iconColor ? iconColor.replace('text-', 'bg-').replace('500', '500/10') : 'bg-gray-100 dark:bg-gray-800'} ${iconColor || 'text-blue-500'}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
        trend === 'up' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
      }`}>
        {change}
      </span>
    </div>
    <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
  </div>
);