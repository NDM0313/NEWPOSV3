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
import { getDashboardMetrics, type FinancialDashboardMetrics } from '../../services/financialDashboardService';
import { getBusinessAlerts, type BusinessAlert } from '../../services/businessAlertsService';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { businessService } from '../../services/businessService';

const DashboardRevenueChart = lazy(() =>
  import('./DashboardRevenueChart').then((m) => ({ default: m.DashboardRevenueChart }))
);

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

const CreateYourBusinessCard: React.FC<{ signOut: () => Promise<void> }> = ({ signOut }) => {
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const handleFixAccount = async () => {
    setFixError(null);
    setFixing(true);
    try {
      const result = await businessService.linkAuthUserToBusiness();
      if (result.success) {
        window.location.reload();
        return;
      }
      setFixError(result.error || 'Could not link account.');
    } catch {
      setFixError('Something went wrong.');
    } finally {
      setFixing(false);
    }
  };
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md p-8 rounded-xl bg-[#1F2937] border border-[#374151]">
        <h2 className="text-xl font-bold text-white mb-2">Create your business</h2>
        <p className="text-[#9CA3AF] mb-6">
          You’re signed in but don’t have a business yet. Sign out and use <strong className="text-white">Create New Business</strong> on the login page to get started.
        </p>
        {fixError && <p className="text-red-400 text-sm mb-3">{fixError}</p>}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50"
            onClick={handleFixAccount}
            disabled={fixing}
          >
            {fixing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            I already created a business – fix my account
          </button>
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
    </div>
  );
};

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
  const { companyId, signOut, profileLoadComplete } = useSupabase();
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
  const [financialMetrics, setFinancialMetrics] = useState<FinancialDashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);

  // Business alerts (separate lightweight call)
  useEffect(() => {
    if (!companyId) return;
    getBusinessAlerts(companyId).then(setAlerts).catch(() => setAlerts([]));
  }, [companyId]);

  // Consolidated dashboard: 1 RPC (get_dashboard_metrics) → metrics + sales_by_category + low_stock; fallback to separate calls
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const start = startDate ? startDate.slice(0, 10) : null;
    const end = endDate ? endDate.slice(0, 10) : null;
    const branchId = globalFilter.branchId ?? null;
    getDashboardMetrics(companyId, branchId, start, end)
      .then((payload) => {
        setFinancialMetrics(payload.metrics);
        setSalesByCategory(payload.sales_by_category ?? []);
        setLowStockProducts(
          (payload.low_stock_items ?? []).map((r) => ({
            id: r.id,
            name: r.name ?? undefined,
            sku: r.sku ?? undefined,
            current_stock: r.current_stock,
            min_stock: r.min_stock,
          }))
        );
      })
      .catch(() => {
        setFinancialMetrics(null);
        setSalesByCategory([]);
        setLowStockProducts([]);
      })
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, globalFilter.branchId]);

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

  // Executive summary fallback: when RPC fails, compute from context using global date range
  const periodStart = useMemo(() => (startDate ? startDate.slice(0, 10) : null), [startDate]);
  const periodEnd = useMemo(() => (endDate ? endDate.slice(0, 10) : null), [endDate]);

  const executiveFromContext = useMemo((): FinancialDashboardMetrics => {
    const finalSales = sales.sales.filter((s: any) => s.status === 'final');
    const finalPurchases = purchases.purchases.filter((p: any) => p.status === 'final' || p.status === 'received');
    const paidExpenses = expenses.expenses.filter((e: any) => e.status === 'paid');

    const inRange = (d: string) => {
      if (!periodStart || !periodEnd) return true;
      const ds = (d || '').toString().slice(0, 10);
      return ds >= periodStart && ds <= periodEnd;
    };

    const periodSales = finalSales
      .filter((s: any) => inRange((s.date || s.sale_date || s.invoice_date || '').toString()))
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const periodPurchases = finalPurchases
      .filter((p: any) => inRange((p.poDate || p.po_date || '').toString()))
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const periodExpensesOnly = paidExpenses
      .filter((e: any) => inRange((e.expenseDate || e.expense_date || '').toString()))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const periodExpenses = periodPurchases + periodExpensesOnly;

    const receivables = finalSales.reduce((sum, s) => sum + (Number((s as any).due ?? (s as any).due_amount) || 0), 0);
    const payables = finalPurchases.reduce((sum, p) => sum + (Number((p as any).due ?? (p as any).due_amount) || 0), 0);

    const periodProfit = periodSales - periodExpenses;
    const profit_margin_pct = periodSales > 0 ? Math.round((periodProfit / periodSales) * 10000) / 100 : 0;

    const last7: { date: string; value: number }[] = [];
    const rangeStart = periodStart ? new Date(periodStart) : new Date();
    const rangeEnd = periodEnd ? new Date(periodEnd) : new Date();
    const start = periodStart && periodEnd ? rangeStart : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const end = periodStart && periodEnd ? rangeEnd : new Date();
    for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
      const ds = t.toISOString().slice(0, 10);
      const daySales = finalSales
        .filter((s: any) => (s.date || s.sale_date || s.invoice_date || '').toString().slice(0, 10) === ds)
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      const dayPurch = finalPurchases
        .filter((p: any) => (p.poDate || p.po_date || '').toString().slice(0, 10) === ds)
        .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
      const dayExp = paidExpenses
        .filter((e: any) => (e.expenseDate || e.expense_date || '').toString().slice(0, 10) === ds)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      last7.push({ date: ds, value: daySales - dayPurch - dayExp });
    }
    const sales_trend = last7.map((t) => ({ date: t.date, value: finalSales.filter((s: any) => (s.date || s.sale_date || s.invoice_date || '').toString().slice(0, 10) === t.date).reduce((sum, s) => sum + (Number(s.total) || 0), 0) }));
    const expense_trend = last7.map((t) => ({
      date: t.date,
      value: finalPurchases.filter((p: any) => (p.poDate || p.po_date || '').toString().slice(0, 10) === t.date).reduce((sum, p) => sum + (Number(p.total) || 0), 0)
        + paidExpenses.filter((e: any) => (e.expenseDate || e.expense_date || '').toString().slice(0, 10) === t.date).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    }));
    const profit_trend = last7;

    return {
      today_sales: periodSales,
      today_profit: periodProfit,
      monthly_revenue: periodSales,
      monthly_expenses: periodExpenses,
      monthly_profit: periodProfit,
      profit_margin_pct,
      cash_balance: 0,
      bank_balance: 0,
      receivables,
      payables,
      period_purchases: periodPurchases,
      period_operating_expenses: periodExpensesOnly,
      sales_trend,
      expense_trend,
      profit_trend,
    };
  }, [sales.sales, purchases.purchases, expenses.expenses, periodStart, periodEnd]);

  // Prefer RPC metrics whenever we have a successful response (even if all zeros for selected range).
  // Only fall back to context when RPC failed or returned null.
  const displayMetrics = financialMetrics ?? executiveFromContext;
  /** Cash/bank from COA rows in AccountingContext (journal TB merge) — not stored accounts.balance or date-window entry sums. */
  const displayMetricsWithCashBank = useMemo(() => {
    let cash = 0;
    let bank = 0;
    for (const a of accounting.accounts || []) {
      const t = String(a.type || a.accountType || '').toLowerCase();
      if (t === 'cash') cash += Number(a.balance) || 0;
      if (t === 'bank') bank += Number(a.balance) || 0;
    }
    if ((accounting.accounts?.length ?? 0) > 0) {
      return { ...displayMetrics, cash_balance: cash, bank_balance: bank };
    }
    return displayMetrics;
  }, [displayMetrics, accounting.accounts]);

  const ymdToday = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dashboardRangeLabel = useMemo(() => {
    if (periodStart && periodEnd) {
      if (periodStart === periodEnd) {
        return periodStart === ymdToday ? 'Today' : periodStart;
      }
      return `${periodStart} → ${periodEnd}`;
    }
    return 'Selected period';
  }, [periodStart, periodEnd, ymdToday]);
  const isCalendarTodayOnly =
    Boolean(periodStart && periodEnd && periodStart === periodEnd && periodStart === ymdToday);
  const salesCardTitle = isCalendarTodayOnly ? 'Today sales' : 'Period sales';
  const profitCardTitle = isCalendarTodayOnly
    ? 'Today profit'
    : 'Period net profit';
  const purchasesCardTitle = 'Purchases (period)';
  const operatingExpCardTitle = 'Operating expenses';
  const pu = Number(displayMetricsWithCashBank.period_purchases) || 0;
  const opEx = Number(displayMetricsWithCashBank.period_operating_expenses) || 0;
  const combinedOutflows = Number(displayMetricsWithCashBank.monthly_expenses) || 0;
  /** Old get_dashboard_metrics JSON had no split; infer combined-only card when totals disagree with zero parts. */
  const showLegacyCombinedExpenses =
    pu === 0 && opEx === 0 && combinedOutflows > 0;

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

  // Logged in but no company: show "Create your business" only after profile load complete (avoids false state on transient errors)
  if (!companyId) {
    if (!profileLoadComplete) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-[#9CA3AF]">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
            <span>Loading your profile…</span>
          </div>
        </div>
      );
    }
    return (
      <CreateYourBusinessCard signOut={signOut} />
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
        <h3 className="text-lg font-bold text-white mb-1">Executive summary</h3>
        <p className="text-xs text-[#9CA3AF] mb-4">
          Cards follow the <span className="text-gray-300">global date filter</span>
          {periodStart && periodEnd ? ` (${dashboardRangeLabel}).` : '.'} Period net = sales − purchases − operating expenses (not the same as cash).
        </p>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 h-24 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6] col-span-2 md:col-span-3 lg:col-span-5 justify-self-center" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <StatCard title={salesCardTitle} value={formatCurrency(displayMetricsWithCashBank.today_sales)} change="—" icon={DollarSign} trend="up" iconColor="text-[#10B981]" />
              <StatCard title={profitCardTitle} value={formatCurrency(displayMetricsWithCashBank.today_profit)} change="—" icon={TrendingUp} trend={displayMetricsWithCashBank.today_profit >= 0 ? 'up' : 'down'} iconColor="text-[#3B82F6]" />
              {showLegacyCombinedExpenses ? (
                <StatCard
                  title="Outflows (combined)"
                  value={formatCurrency(combinedOutflows)}
                  change="purchases + OpEx"
                  icon={ArrowUpRight}
                  trend="down"
                  iconColor="text-[#F59E0B]"
                />
              ) : (
                <>
                  <StatCard title={purchasesCardTitle} value={formatCurrency(pu)} change="—" icon={ShoppingBag} trend="down" iconColor="text-[#8B5CF6]" />
                  <StatCard title={operatingExpCardTitle} value={formatCurrency(opEx)} change="—" icon={ArrowUpRight} trend="down" iconColor="text-[#F59E0B]" />
                </>
              )}
              <StatCard title="Profit margin" value={`${displayMetricsWithCashBank.profit_margin_pct}%`} change="—" icon={TrendingUp} trend={displayMetricsWithCashBank.profit_margin_pct >= 0 ? 'up' : 'down'} iconColor="text-[#06B6D4]" />
              <StatCard title="Cash balance" value={formatCurrency(displayMetricsWithCashBank.cash_balance)} change="—" icon={Wallet} trend="up" iconColor="text-[#10B981]" />
              <StatCard title="Bank balance" value={formatCurrency(displayMetricsWithCashBank.bank_balance)} change="—" icon={Building2} trend="up" iconColor="text-[#3B82F6]" />
              <StatCard title="Receivables" value={formatCurrency(displayMetricsWithCashBank.receivables)} change="—" icon={ArrowDownRight} trend="up" iconColor="text-[#3B82F6]" />
              <StatCard title="Payables" value={formatCurrency(displayMetricsWithCashBank.payables)} change="—" icon={ArrowUpRight} trend="down" iconColor="text-[#F59E0B]" />
            </div>
            {(displayMetricsWithCashBank.sales_trend?.length > 0 || displayMetricsWithCashBank.expense_trend?.length > 0 || displayMetricsWithCashBank.profit_trend?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-[#1F2937]/50 rounded-lg p-4 border border-[#374151]">
                  <h4 className="text-sm font-medium text-[#9CA3AF] mb-2">Sales trend (range)</h4>
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
                  <h4 className="text-sm font-medium text-[#9CA3AF] mb-2">Outflows trend (purchases + OpEx)</h4>
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
                  <h4 className="text-sm font-medium text-[#9CA3AF] mb-2">Net profit trend (range)</h4>
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

      {/* Issue 05: Same source as executive summary (displayMetrics) so cards match reports */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
          title="Total Due (Receivables)" 
          value={formatCurrency(displayMetricsWithCashBank.receivables)} 
          change="—" 
          icon={ArrowDownRight} 
          trend="up"
          iconColor="text-[#3B82F6]"
        />
        <StatCard 
          title="Supplier Due (Payables)" 
          value={formatCurrency(displayMetricsWithCashBank.payables)} 
          change="—" 
          icon={ArrowUpRight} 
          trend="down"
          iconColor="text-[#F59E0B]"
        />
        <StatCard 
          title="Net Profit" 
          value={formatCurrency(displayMetricsWithCashBank.monthly_profit)} 
          change={displayMetricsWithCashBank.monthly_profit >= 0 ? "—" : "—"} 
          icon={DollarSign} 
          trend={displayMetricsWithCashBank.monthly_profit >= 0 ? "up" : "down"}
          iconColor="text-[#10B981]"
        />
        <StatCard 
          title="Total Sales" 
          value={formatCurrency(displayMetricsWithCashBank.monthly_revenue)} 
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
             {loading ? (
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