import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, ArrowDownRight, ArrowUpRight, AlertTriangle, Loader2, Store, ShoppingCart, Package, Warehouse, Wallet, Building2 } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useSales } from '../../context/SalesContext';
import { usePurchases } from '../../context/PurchaseContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useAccounting } from '../../context/AccountingContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { useSettings } from '../../context/SettingsContext';
import { useCheckPermission } from '../../hooks/useCheckPermission';
import { productService } from '../../services/productService';
import { getSalesByCategory } from '../../services/dashboardService';
import { getFinancialDashboardMetrics, type FinancialDashboardMetrics } from '../../services/financialDashboardService';
import { getBusinessAlerts, type BusinessAlert } from '../../services/businessAlertsService';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

const DashboardRevenueChart = lazy(() =>
  import('./DashboardRevenueChart').then((m) => ({ default: m.DashboardRevenueChart }))
);

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

interface LowStockItem {
  id: string;
  name?: string;
  sku?: string;
  current_stock?: number;
  min_stock?: number;
}

export const Dashboard = () => {
  const { setCurrentView } = useNavigation();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const accounting = useAccounting();
  const { companyId, signOut } = useSupabase();
  const { modules: settingsModules } = useSettings();
  const { hasPermission } = useCheckPermission();
  const { formatCurrency } = useFormatCurrency();
  const globalFilter = useGlobalFilter();
  const { startDate, endDate, startDateObj, endDateObj, setCurrentModule } = globalFilter;

  useEffect(() => {
    setCurrentModule('dashboard');
  }, [setCurrentModule]);

  const [lowStockProducts, setLowStockProducts] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesByCategory, setSalesByCategory] = useState<Array<{ categoryName: string; total: number }>>([]);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [financialMetrics, setFinancialMetrics] = useState<FinancialDashboardMetrics | null>(null);
  const [loadingFinancial, setLoadingFinancial] = useState(true);
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);

  // Business alerts (Phase-2)
  useEffect(() => {
    if (!companyId) return;
    getBusinessAlerts(companyId).then(setAlerts).catch(() => setAlerts([]));
  }, [companyId]);

  // Executive financial metrics (single RPC, sub-1s)
  useEffect(() => {
    if (!companyId) {
      setLoadingFinancial(false);
      return;
    }
    setLoadingFinancial(true);
    getFinancialDashboardMetrics(companyId)
      .then(setFinancialMetrics)
      .catch(() => setFinancialMetrics(null))
      .finally(() => setLoadingFinancial(false));
  }, [companyId]);

  // Load low stock items (movement-based; no current_stock column)
  const loadProducts = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const low = await productService.getLowStockProducts(companyId);
      setLowStockProducts(Array.isArray(low) ? low : []);
    } catch (error) {
      console.error('[DASHBOARD] Error loading low stock:', error);
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load sales by category from backend (global date range applied)
  useEffect(() => {
    if (!companyId) {
      setLoadingCategory(false);
      return;
    }
    setLoadingCategory(true);
    const start = startDate ? startDate.slice(0, 10) : null;
    const end = endDate ? endDate.slice(0, 10) : null;
    getSalesByCategory(companyId, start, end)
      .then(setSalesByCategory)
      .catch((err) => {
        console.error('[DASHBOARD] Sales by category error:', err);
        setSalesByCategory([]);
      })
      .finally(() => setLoadingCategory(false));
  }, [companyId, startDate, endDate]);

  // Filter data by global date range
  const filterByDateRange = useCallback((dateStr: string | undefined): boolean => {
    if (!startDateObj && !endDateObj) return true;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (startDateObj && date < startDateObj) return false;
    if (endDateObj && date > endDateObj) return false;
    return true;
  }, [startDateObj, endDateObj]);

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

  const lowStockItems = useMemo(() => {
    return lowStockProducts.slice(0, 5).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.current_stock ?? 0,
      min: p.min_stock ?? 0,
    }));
  }, [lowStockProducts]);

  // Executive summary: use API metrics when available and non-empty; otherwise compute from context so it's always functional
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, []);
  const monthEndStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  }, []);

  const executiveFromContext = useMemo((): FinancialDashboardMetrics => {
    const finalSales = sales.sales.filter((s: any) => s.status === 'final');
    const finalPurchases = purchases.purchases.filter((p: any) => p.status === 'final' || p.status === 'received');
    const paidExpenses = expenses.expenses.filter((e: any) => e.status === 'paid');

    const todaySales = finalSales
      .filter((s: any) => (s.date || s.sale_date || '').toString().slice(0, 10) === todayStr)
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const todayPurchases = finalPurchases
      .filter((p: any) => (p.poDate || p.po_date || '').toString().slice(0, 10) === todayStr)
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const todayExpenses = paidExpenses
      .filter((e: any) => (e.expenseDate || e.expense_date || '').toString().slice(0, 10) === todayStr)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const monthlyRevenue = finalSales
      .filter((s: any) => {
        const d = (s.date || s.sale_date || '').toString().slice(0, 10);
        return d >= monthStartStr && d <= monthEndStr;
      })
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const monthlyPurchases = finalPurchases
      .filter((p: any) => {
        const d = (p.poDate || p.po_date || '').toString().slice(0, 10);
        return d >= monthStartStr && d <= monthEndStr;
      })
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const monthlyExpensesOnly = paidExpenses
      .filter((e: any) => {
        const d = (e.expenseDate || e.expense_date || '').toString().slice(0, 10);
        return d >= monthStartStr && d <= monthEndStr;
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const monthlyExpenses = monthlyPurchases + monthlyExpensesOnly;

    const receivables = finalSales.reduce((sum, s) => sum + (Number((s as any).due ?? (s as any).due_amount) || 0), 0);
    const payables = finalPurchases.reduce((sum, p) => sum + (Number((p as any).due ?? (p as any).due_amount) || 0), 0);

    const monthlyProfit = monthlyRevenue - monthlyExpenses;
    const profit_margin_pct = monthlyRevenue > 0 ? Math.round((monthlyProfit / monthlyRevenue) * 10000) / 100 : 0;

    const last7: { date: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const daySales = finalSales
        .filter((s: any) => (s.date || s.sale_date || '').toString().slice(0, 10) === ds)
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      const dayPurch = finalPurchases
        .filter((p: any) => (p.poDate || p.po_date || '').toString().slice(0, 10) === ds)
        .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
      const dayExp = paidExpenses
        .filter((e: any) => (e.expenseDate || e.expense_date || '').toString().slice(0, 10) === ds)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      last7.push({ date: ds, value: daySales - dayPurch - dayExp });
    }
    const sales_trend = last7.map((t) => ({ date: t.date, value: finalSales.filter((s: any) => (s.date || s.sale_date || '').toString().slice(0, 10) === t.date).reduce((sum, s) => sum + (Number(s.total) || 0), 0) }));
    const expense_trend = last7.map((t) => ({
      date: t.date,
      value: finalPurchases.filter((p: any) => (p.poDate || p.po_date || '').toString().slice(0, 10) === t.date).reduce((sum, p) => sum + (Number(p.total) || 0), 0)
        + paidExpenses.filter((e: any) => (e.expenseDate || e.expense_date || '').toString().slice(0, 10) === t.date).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    }));
    const profit_trend = last7;

    return {
      today_sales: todaySales,
      today_profit: todaySales - todayPurchases - todayExpenses,
      monthly_revenue: monthlyRevenue,
      monthly_expenses: monthlyExpenses,
      monthly_profit: monthlyProfit,
      profit_margin_pct,
      cash_balance: 0,
      bank_balance: 0,
      receivables,
      payables,
      sales_trend,
      expense_trend,
      profit_trend,
    };
  }, [sales.sales, purchases.purchases, expenses.expenses, todayStr, monthStartStr, monthEndStr]);

  const hasNonZeroMetrics = financialMetrics && (
    (financialMetrics.today_sales !== 0) || (financialMetrics.monthly_revenue !== 0) ||
    (financialMetrics.cash_balance !== 0) || (financialMetrics.bank_balance !== 0) ||
    (financialMetrics.receivables !== 0) || (financialMetrics.payables !== 0)
  );
  const displayMetrics = (financialMetrics && hasNonZeroMetrics) ? financialMetrics : executiveFromContext;
  const displayMetricsWithCashBank = useMemo(() => {
    if ((financialMetrics && hasNonZeroMetrics) && (financialMetrics.cash_balance !== 0 || financialMetrics.bank_balance !== 0)) {
      return displayMetrics;
    }
    const cash = accounting.getAccountBalance ? accounting.getAccountBalance('Cash' as any) : 0;
    const bank = accounting.getAccountBalance ? accounting.getAccountBalance('Bank' as any) : 0;
    if (cash === 0 && bank === 0) return displayMetrics;
    return { ...displayMetrics, cash_balance: cash, bank_balance: bank };
  }, [displayMetrics, financialMetrics, hasNonZeroMetrics, accounting]);

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

  // No full-page loading: render shell immediately for sub-1s first paint (staged loading)

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
      {/* Business Alerts (Phase-2) */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 5).map((a) => (
            <div
              key={a.id}
              className={`rounded-xl p-3 flex items-center justify-between border ${
                a.severity === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                a.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}
            >
              <span className="font-medium">{a.title}</span>
              <span className="text-sm opacity-90">{a.message}</span>
              {a.actionUrl && (
                <button
                  type="button"
                  onClick={() => setCurrentView(a.actionUrl as any)}
                  className="text-sm font-medium opacity-90 hover:underline"
                >
                  View
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Executive financial summary (Phase-2 Intelligence) */}
      <div className="bg-[#111827]/50 border border-[#374151] p-6 rounded-xl">
        <h3 className="text-lg font-bold text-white mb-4">Executive summary</h3>
        {loadingFinancial ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 h-24 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6] col-span-2 md:col-span-3 lg:col-span-5 justify-self-center" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <StatCard title="Today Sales" value={formatCurrency(displayMetricsWithCashBank.today_sales)} change="—" icon={DollarSign} trend="up" iconColor="text-[#10B981]" />
              <StatCard title="Today Profit" value={formatCurrency(displayMetricsWithCashBank.today_profit)} change="—" icon={TrendingUp} trend={displayMetricsWithCashBank.today_profit >= 0 ? 'up' : 'down'} iconColor="text-[#3B82F6]" />
              <StatCard title="Monthly Revenue" value={formatCurrency(displayMetricsWithCashBank.monthly_revenue)} change="—" icon={ShoppingBag} trend="up" iconColor="text-[#8B5CF6]" />
              <StatCard title="Monthly Expenses" value={formatCurrency(displayMetricsWithCashBank.monthly_expenses)} change="—" icon={ArrowUpRight} trend="down" iconColor="text-[#F59E0B]" />
              <StatCard title="Profit Margin" value={`${displayMetricsWithCashBank.profit_margin_pct}%`} change="—" icon={TrendingUp} trend={displayMetricsWithCashBank.profit_margin_pct >= 0 ? 'up' : 'down'} iconColor="text-[#06B6D4]" />
              <StatCard title="Cash Balance" value={formatCurrency(displayMetricsWithCashBank.cash_balance)} change="—" icon={Wallet} trend="up" iconColor="text-[#10B981]" />
              <StatCard title="Bank Balance" value={formatCurrency(displayMetricsWithCashBank.bank_balance)} change="—" icon={Building2} trend="up" iconColor="text-[#3B82F6]" />
              <StatCard title="Receivables" value={formatCurrency(displayMetricsWithCashBank.receivables)} change="—" icon={ArrowDownRight} trend="up" iconColor="text-[#3B82F6]" />
              <StatCard title="Payables" value={formatCurrency(displayMetricsWithCashBank.payables)} change="—" icon={ArrowUpRight} trend="down" iconColor="text-[#F59E0B]" />
            </div>
            {(displayMetricsWithCashBank.sales_trend?.length > 0 || displayMetricsWithCashBank.expense_trend?.length > 0 || displayMetricsWithCashBank.profit_trend?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-[#1F2937]/50 rounded-lg p-4 border border-[#374151]">
                  <h4 className="text-sm font-medium text-[#9CA3AF] mb-2">Sales trend (7d)</h4>
                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(displayMetricsWithCashBank.sales_trend || []).map((t) => ({ name: t.date.slice(5), value: t.value }))}>
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} formatter={(v: number) => [formatCurrency(v), 'Sales']} />
                        <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-[#1F2937]/50 rounded-lg p-4 border border-[#374151]">
                  <h4 className="text-sm font-medium text-[#9CA3AF] mb-2">Expense trend (7d)</h4>
                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(displayMetricsWithCashBank.expense_trend || []).map((t) => ({ name: t.date.slice(5), value: t.value }))}>
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} formatter={(v: number) => [formatCurrency(v), 'Expenses']} />
                        <Line type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-[#1F2937]/50 rounded-lg p-4 border border-[#374151]">
                  <h4 className="text-sm font-medium text-[#9CA3AF] mb-2">Profit trend (7d)</h4>
                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(displayMetricsWithCashBank.profit_trend || []).map((t) => ({ name: t.date.slice(5), value: t.value }))}>
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} formatter={(v: number) => [formatCurrency(v), 'Profit']} />
                        <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick access: module cards (same visibility as sidebar, including POS) */}
      <div className="bg-[#111827]/50 border border-[#374151] p-6 rounded-xl">
        <h3 className="text-lg font-bold text-white mb-4">Quick access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {hasPermission('sales.view') && (
            <ModuleCard icon={ShoppingCart} label="Sales" onClick={() => setCurrentView('sales')} />
          )}
          {hasPermission('purchases.view') && (
            <ModuleCard icon={ShoppingBag} label="Purchases" onClick={() => setCurrentView('purchases')} />
          )}
          {hasPermission('products.view') && (
            <ModuleCard icon={Package} label="Products" onClick={() => setCurrentView('products')} />
          )}
          {hasPermission('products.view') && (
            <ModuleCard icon={Warehouse} label="Inventory" onClick={() => setCurrentView('inventory')} />
          )}
          {settingsModules.posModuleEnabled && hasPermission('pos.view') && (
            <ModuleCard icon={Store} label="Point of Sale" onClick={() => setCurrentView('pos')} />
          )}
        </div>
      </div>

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
          <Suspense
            fallback={
              <div className="w-full h-[320px] flex items-center justify-center text-[#9CA3AF]">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
              </div>
            }
          >
            <DashboardRevenueChart
              data={chartData}
              formatCurrency={formatCurrency}
              emptyMessage="No sales or purchase data in the selected date range"
            />
          </Suspense>
        </div>

          <div className="space-y-6">
           {/* Low Stock List */}
          <div className="bg-[#111827]/50 border border-[#374151] p-6 rounded-xl flex-1">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              Critical Stock
            </h3>
            {loading ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
              </div>
            ) : lowStockItems.length > 0 ? (
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

const ModuleCard = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-3 p-4 rounded-xl border border-[#374151] bg-[#1F2937]/50 hover:border-[#3B82F6]/50 hover:bg-[#1F2937] transition-all text-left"
  >
    <div className="p-2 rounded-lg bg-[#3B82F6]/20 text-[#60A5FA]">
      <Icon size={20} />
    </div>
    <span className="font-medium text-white">{label}</span>
  </button>
);

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