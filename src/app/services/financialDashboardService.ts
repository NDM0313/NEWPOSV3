/**
 * Phase-2 Intelligence: Executive Financial Dashboard
 * Lightweight metrics for sub-1s load. Prefer RPC; fallback to parallel fetches.
 * ERP Final Stabilization: get_dashboard_metrics RPC returns metrics + sales_by_category + low_stock in one call.
 */
import { supabase } from '@/lib/supabase';

export interface FinancialDashboardMetrics {
  today_sales: number;
  today_profit: number;
  monthly_revenue: number;
  monthly_expenses: number;
  monthly_profit: number;
  profit_margin_pct: number;
  cash_balance: number;
  bank_balance: number;
  receivables: number;
  payables: number;
  sales_trend: { date: string; value: number }[];
  expense_trend: { date: string; value: number }[];
  profit_trend: { date: string; value: number }[];
  error?: string;
}

/**
 * Fetch executive financial metrics. Uses get_financial_dashboard_metrics RPC when available.
 */
export async function getFinancialDashboardMetrics(
  companyId: string
): Promise<FinancialDashboardMetrics> {
  if (!companyId) {
    return getEmptyMetrics();
  }

  try {
    const { data, error } = await supabase.rpc('get_financial_dashboard_metrics', {
      p_company_id: companyId,
    });

    if (error) {
      console.warn('[FINANCIAL DASHBOARD] RPC failed, using fallback:', error.message);
      return getMetricsFallback(companyId);
    }

    const raw = data as Record<string, unknown> | null;
    if (!raw) return getEmptyMetrics();

    return {
      today_sales: Number(raw.today_sales) ?? 0,
      today_profit: Number(raw.today_profit) ?? 0,
      monthly_revenue: Number(raw.monthly_revenue) ?? 0,
      monthly_expenses: Number(raw.monthly_expenses) ?? 0,
      monthly_profit: Number(raw.monthly_profit) ?? 0,
      profit_margin_pct: Number(raw.profit_margin_pct) ?? 0,
      cash_balance: Number(raw.cash_balance) ?? 0,
      bank_balance: Number(raw.bank_balance) ?? 0,
      receivables: Number(raw.receivables) ?? 0,
      payables: Number(raw.payables) ?? 0,
      sales_trend: Array.isArray(raw.sales_trend)
        ? (raw.sales_trend as { date: string; value: number }[])
        : [],
      expense_trend: Array.isArray(raw.expense_trend)
        ? (raw.expense_trend as { date: string; value: number }[])
        : [],
      profit_trend: Array.isArray(raw.profit_trend)
        ? (raw.profit_trend as { date: string; value: number }[])
        : [],
      error: raw.error as string | undefined,
    };
  } catch (e) {
    console.warn('[FINANCIAL DASHBOARD] Error:', e);
    return getMetricsFallback(companyId);
  }
}

function getEmptyMetrics(): FinancialDashboardMetrics {
  return {
    today_sales: 0,
    today_profit: 0,
    monthly_revenue: 0,
    monthly_expenses: 0,
    monthly_profit: 0,
    profit_margin_pct: 0,
    cash_balance: 0,
    bank_balance: 0,
    receivables: 0,
    payables: 0,
    sales_trend: [],
    expense_trend: [],
    profit_trend: [],
  };
}

/**
 * Fallback when RPC is not available: parallel lightweight queries.
 */
async function getMetricsFallback(companyId: string): Promise<FinancialDashboardMetrics> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const saleDateCol = 'invoice_date';
  const purchDateCol = 'po_date';
  const expDateCol = 'expense_date';

  const [salesToday, salesMonth, purchasesToday, purchasesMonth, expensesToday, expensesMonth, salesDue, purchasesDue, accounts] =
    await Promise.all([
      supabase.from('sales').select('total').eq('company_id', companyId).eq('status', 'final').gte(saleDateCol, today).lte(saleDateCol, today),
      supabase.from('sales').select('total').eq('company_id', companyId).eq('status', 'final').gte(saleDateCol, monthStartStr).lte(saleDateCol, monthEnd),
      supabase.from('purchases').select('total').eq('company_id', companyId).in('status', ['final', 'received']).gte(purchDateCol, today).lte(purchDateCol, today),
      supabase.from('purchases').select('total').eq('company_id', companyId).in('status', ['final', 'received']).gte(purchDateCol, monthStartStr).lte(purchDateCol, monthEnd),
      supabase.from('expenses').select('amount').eq('company_id', companyId).eq('status', 'paid').gte(expDateCol, today).lte(expDateCol, today),
      supabase.from('expenses').select('amount').eq('company_id', companyId).eq('status', 'paid').gte(expDateCol, monthStartStr).lte(expDateCol, monthEnd),
      supabase.from('sales').select('due_amount').eq('company_id', companyId).eq('status', 'final').gt('due_amount', 0),
      supabase.from('purchases').select('due_amount').eq('company_id', companyId).in('status', ['final', 'received']).gt('due_amount', 0),
      supabase.from('accounts').select('code, balance, current_balance, type').eq('company_id', companyId).eq('is_active', true),
    ]);

  const sum = (arr: { total?: number; amount?: number; due_amount?: number }[] | null, key: 'total' | 'amount' | 'due_amount') =>
    (arr || []).reduce((s, r) => s + (Number((r as any)[key]) || 0), 0);

  const todaySales = sum(salesToday.data || [], 'total');
  const monthlyRevenue = sum(salesMonth.data || [], 'total');
  const todayPurchases = sum(purchasesToday.data || [], 'total');
  const monthlyPurchases = sum(purchasesMonth.data || [], 'total');
  const todayExpenses = sum(expensesToday.data || [], 'amount');
  const monthlyExpenses = sum(expensesMonth.data || [], 'amount');
  const receivables = sum(salesDue.data || [], 'due_amount');
  const payables = sum(purchasesDue.data || [], 'due_amount');

  let cash_balance = 0;
  let bank_balance = 0;
  (accounts.data || []).forEach((a: any) => {
    const bal = a.balance ?? a.current_balance ?? 0;
    if (a.code === '1000' || (a.type && String(a.type).toLowerCase() === 'cash')) cash_balance += Number(bal);
    if (a.code === '1010' || (a.type && String(a.type).toLowerCase() === 'bank')) bank_balance += Number(bal);
  });

  const monthlyExpTotal = monthlyPurchases + monthlyExpenses;
  const profit_margin_pct =
    monthlyRevenue > 0 ? Math.round(((monthlyRevenue - monthlyExpTotal) / monthlyRevenue) * 10000) / 100 : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const sales_trend: { date: string; value: number }[] = [];
  const expense_trend: { date: string; value: number }[] = [];
  const profit_trend: { date: string; value: number }[] = [];
  for (let d = new Date(weekStart); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    sales_trend.push({ date: dateStr, value: 0 });
    expense_trend.push({ date: dateStr, value: 0 });
    profit_trend.push({ date: dateStr, value: 0 });
  }
  // Optional: fill trend from daily aggregates (extra queries). For fallback keep zeros to avoid many round-trips.
  return {
    today_sales: todaySales,
    today_profit: todaySales - todayPurchases - todayExpenses,
    monthly_revenue: monthlyRevenue,
    monthly_expenses: monthlyExpTotal,
    monthly_profit: monthlyRevenue - monthlyExpTotal,
    profit_margin_pct,
    cash_balance,
    bank_balance,
    receivables,
    payables,
    sales_trend,
    expense_trend,
    profit_trend,
  };
}

/** Low stock item shape from get_dashboard_metrics RPC */
export interface DashboardLowStockItem {
  id: string;
  name: string | null;
  sku: string | null;
  current_stock: number;
  min_stock: number;
}

/** Combined dashboard payload from get_dashboard_metrics RPC (1 call instead of 5–13). */
export interface DashboardMetricsPayload {
  metrics: FinancialDashboardMetrics;
  sales_by_category: Array<{ categoryName: string; total: number }>;
  low_stock_items: DashboardLowStockItem[];
  error?: string;
}

/**
 * Fetch full dashboard in one RPC: metrics + sales by category + low stock.
 * Falls back to separate calls if RPC is not available.
 */
export async function getDashboardMetrics(
  companyId: string,
  branchId?: string | null,
  startDate?: string | null,
  endDate?: string | null
): Promise<DashboardMetricsPayload> {
  if (!companyId) {
    return {
      metrics: getEmptyMetrics(),
      sales_by_category: [],
      low_stock_items: [],
    };
  }
  try {
    const { data, error } = await supabase.rpc('get_dashboard_metrics', {
      p_company_id: companyId,
      p_branch_id: branchId || null,
      p_start_date: startDate ? startDate.slice(0, 10) : null,
      p_end_date: endDate ? endDate.slice(0, 10) : null,
    });
    if (error) throw error;
    const raw = data as Record<string, unknown> | null;
    if (!raw) throw new Error('No data');
    const metricsRaw = raw.metrics as Record<string, unknown> | undefined;
    return {
      metrics: metricsRaw ? parseFinancialMetrics(metricsRaw) : getEmptyMetrics(),
      sales_by_category: Array.isArray(raw.sales_by_category)
        ? (raw.sales_by_category as Array<{ categoryName: string; total: number }>)
        : [],
      low_stock_items: Array.isArray(raw.low_stock_items)
        ? (raw.low_stock_items as DashboardLowStockItem[])
        : [],
      error: raw.error as string | undefined,
    };
  } catch (e) {
    console.warn('[DASHBOARD] get_dashboard_metrics RPC failed, using fallback:', e);
    return getDashboardMetricsFallback(companyId, startDate, endDate);
  }
}

function parseFinancialMetrics(raw: Record<string, unknown>): FinancialDashboardMetrics {
  return {
    today_sales: Number(raw.today_sales) ?? 0,
    today_profit: Number(raw.today_profit) ?? 0,
    monthly_revenue: Number(raw.monthly_revenue) ?? 0,
    monthly_expenses: Number(raw.monthly_expenses) ?? 0,
    monthly_profit: Number(raw.monthly_profit) ?? 0,
    profit_margin_pct: Number(raw.profit_margin_pct) ?? 0,
    cash_balance: Number(raw.cash_balance) ?? 0,
    bank_balance: Number(raw.bank_balance) ?? 0,
    receivables: Number(raw.receivables) ?? 0,
    payables: Number(raw.payables) ?? 0,
    sales_trend: Array.isArray(raw.sales_trend) ? (raw.sales_trend as { date: string; value: number }[]) : [],
    expense_trend: Array.isArray(raw.expense_trend) ? (raw.expense_trend as { date: string; value: number }[]) : [],
    profit_trend: Array.isArray(raw.profit_trend) ? (raw.profit_trend as { date: string; value: number }[]) : [],
    error: raw.error as string | undefined,
  };
}

async function getDashboardMetricsFallback(
  companyId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<DashboardMetricsPayload> {
  const [metrics, salesByCategory, lowStock] = await Promise.all([
    getFinancialDashboardMetrics(companyId),
    getSalesByCategoryFromService(companyId, startDate, endDate),
    getLowStockFromService(companyId),
  ]);
  return {
    metrics,
    sales_by_category: salesByCategory,
    low_stock_items: lowStock,
  };
}

async function getSalesByCategoryFromService(
  companyId: string,
  start?: string | null,
  end?: string | null
): Promise<Array<{ categoryName: string; total: number }>> {
  const { getSalesByCategory } = await import('@/app/services/dashboardService');
  return getSalesByCategory(companyId, start ?? undefined, end ?? undefined);
}

async function getLowStockFromService(companyId: string): Promise<DashboardLowStockItem[]> {
  const { productService } = await import('@/app/services/productService');
  const rows = await productService.getLowStockProducts(companyId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? null,
    sku: r.sku ?? null,
    current_stock: r.current_stock ?? 0,
    min_stock: r.min_stock ?? 0,
  }));
}
