/**
 * Executive dashboard period metrics from direct queries when RPC returns zeros
 * or predates branch/date-scoped get_dashboard_metrics migration.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { safeRpcBranchId } from './contactBalancesRpc';
import { dateRangeEndIso } from '../lib/createdByScope';
import type { FinancialDashboardMetrics } from './financialDashboard';

function applyBranchFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  branchId: string | null | undefined
): T {
  const bid = safeRpcBranchId(branchId);
  if (bid) return query.eq('branch_id', bid);
  return query;
}

function sumField(rows: Array<Record<string, unknown>> | null, key: string): number {
  return (rows ?? []).reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

function buildDailyTrends(
  fromDate: string,
  toDate: string,
  salesByDay: Map<string, number>,
  purchByDay: Map<string, number>,
  expByDay: Map<string, number>
): Pick<FinancialDashboardMetrics, 'sales_trend' | 'expense_trend' | 'profit_trend'> {
  const sales_trend: { date: string; value: number }[] = [];
  const expense_trend: { date: string; value: number }[] = [];
  const profit_trend: { date: string; value: number }[] = [];
  const start = new Date(`${fromDate.slice(0, 10)}T12:00:00`);
  const end = new Date(`${toDate.slice(0, 10)}T12:00:00`);
  for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
    const ds = t.toISOString().slice(0, 10);
    const sales = salesByDay.get(ds) || 0;
    const purch = purchByDay.get(ds) || 0;
    const exp = expByDay.get(ds) || 0;
    sales_trend.push({ date: ds, value: sales });
    expense_trend.push({ date: ds, value: purch + exp });
    profit_trend.push({ date: ds, value: sales - purch - exp });
  }
  return { sales_trend, expense_trend, profit_trend };
}

function bucketByDate(rows: Array<Record<string, unknown>>, dateKey: string, amountKey: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const day = r[dateKey] != null ? String(r[dateKey]).slice(0, 10) : '';
    if (!day) continue;
    map.set(day, (map.get(day) || 0) + (Number(r[amountKey]) || 0));
  }
  return map;
}

export async function queryExecutivePeriodMetrics(
  companyId: string,
  branchId: string | null | undefined,
  fromDate: string,
  toDate: string
): Promise<Partial<FinancialDashboardMetrics> | null> {
  if (!isSupabaseConfigured || !companyId) return null;
  const from = fromDate.slice(0, 10);
  const to = toDate.slice(0, 10);
  const toIso = dateRangeEndIso(to);

  let salesQ = supabase
    .from('sales')
    .select('total, invoice_date')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', from)
    .lte('invoice_date', toIso);
  salesQ = applyBranchFilter(salesQ, branchId);

  let purchQ = supabase
    .from('purchases')
    .select('total, po_date')
    .eq('company_id', companyId)
    .in('status', ['final', 'received'])
    .gte('po_date', from)
    .lte('po_date', toIso)
    .is('cancelled_at', null);
  purchQ = applyBranchFilter(purchQ, branchId);

  let expQ = supabase
    .from('expenses')
    .select('amount, expense_date')
    .eq('company_id', companyId)
    .eq('status', 'paid')
    .gte('expense_date', from)
    .lte('expense_date', toIso);
  expQ = applyBranchFilter(expQ, branchId);

  const [salesRes, purchRes, expRes] = await Promise.all([salesQ, purchQ, expQ]);

  if (salesRes.error && purchRes.error && expRes.error) return null;

  const salesRows = (salesRes.data ?? []) as Array<Record<string, unknown>>;
  const purchRows = (purchRes.data ?? []) as Array<Record<string, unknown>>;
  const expRows = (expRes.data ?? []) as Array<Record<string, unknown>>;

  const periodSales = sumField(salesRows, 'total');
  const periodPurchases = sumField(purchRows, 'total');
  const periodOperatingExpenses = sumField(expRows, 'amount');
  const netProfit = periodSales - periodPurchases - periodOperatingExpenses;
  const profitMarginPct =
    periodSales > 0 ? Math.round((netProfit / periodSales) * 10000) / 100 : 0;

  const trends = buildDailyTrends(
    from,
    to,
    bucketByDate(salesRows, 'invoice_date', 'total'),
    bucketByDate(purchRows, 'po_date', 'total'),
    bucketByDate(expRows, 'expense_date', 'amount')
  );

  return {
    today_sales: periodSales,
    today_profit: netProfit,
    monthly_revenue: periodSales,
    monthly_expenses: periodPurchases + periodOperatingExpenses,
    monthly_profit: netProfit,
    profit_margin_pct: profitMarginPct,
    period_purchases: periodPurchases,
    period_operating_expenses: periodOperatingExpenses,
    ...trends,
  };
}

export function mergePeriodMetrics(
  base: FinancialDashboardMetrics,
  direct: Partial<FinancialDashboardMetrics> | null
): FinancialDashboardMetrics {
  if (!direct) return base;
  const rpcSales = Number(base.today_sales) || Number(base.monthly_revenue) || 0;
  const directSales = Number(direct.today_sales) || Number(direct.monthly_revenue) || 0;
  const useDirect =
    directSales > rpcSales ||
    (rpcSales === 0 && (directSales > 0 || (direct.sales_trend?.some((t) => t.value > 0) ?? false)));

  if (!useDirect) return base;

  return {
    ...base,
    today_sales: direct.today_sales ?? base.today_sales,
    today_profit: direct.today_profit ?? base.today_profit,
    monthly_revenue: direct.monthly_revenue ?? base.monthly_revenue,
    monthly_expenses: direct.monthly_expenses ?? base.monthly_expenses,
    monthly_profit: direct.monthly_profit ?? base.monthly_profit,
    profit_margin_pct: direct.profit_margin_pct ?? base.profit_margin_pct,
    period_purchases: direct.period_purchases ?? base.period_purchases,
    period_operating_expenses: direct.period_operating_expenses ?? base.period_operating_expenses,
    sales_trend: direct.sales_trend?.length ? direct.sales_trend : base.sales_trend,
    expense_trend: direct.expense_trend?.length ? direct.expense_trend : base.expense_trend,
    profit_trend: direct.profit_trend?.length ? direct.profit_trend : base.profit_trend,
    ar_ap_basis: base.ar_ap_basis ?? 'direct_query_period',
  };
}
