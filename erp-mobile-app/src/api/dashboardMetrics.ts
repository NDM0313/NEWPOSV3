/**
 * Executive dashboard — same RPC as web `getDashboardMetrics`.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { safeRpcBranchId, fetchContactBalancesSummary } from './contactBalancesRpc';
import { getFinancialDashboardMetrics, type FinancialDashboardMetrics } from './financialDashboard';
import { mergePeriodMetrics, queryExecutivePeriodMetrics } from './dashboardPeriodMetrics';

export type { FinancialDashboardMetrics };

export interface DashboardLowStockItem {
  id: string;
  name?: string | null;
  sku?: string | null;
  current_stock: number;
  min_stock: number;
}

export interface DashboardMetricsPayload {
  metrics: FinancialDashboardMetrics;
  sales_by_category: Array<{ categoryName: string; total: number }>;
  low_stock_items: DashboardLowStockItem[];
  error?: string;
}

function parseFinancialMetrics(raw: Record<string, unknown>): FinancialDashboardMetrics {
  return {
    today_sales: Number(raw.today_sales) || 0,
    today_profit: Number(raw.today_profit) || 0,
    monthly_revenue: Number(raw.monthly_revenue) || 0,
    monthly_expenses: Number(raw.monthly_expenses) || 0,
    monthly_profit: Number(raw.monthly_profit) || 0,
    profit_margin_pct: Number(raw.profit_margin_pct) || 0,
    cash_balance: Number(raw.cash_balance) || 0,
    bank_balance: Number(raw.bank_balance) || 0,
    receivables: Number(raw.receivables) || 0,
    payables: Number(raw.payables) || 0,
    ar_ap_basis: raw.ar_ap_basis != null ? String(raw.ar_ap_basis) : undefined,
    ar_ap_scope: raw.ar_ap_scope != null ? String(raw.ar_ap_scope) : undefined,
    period_purchases: Number(raw.period_purchases) || 0,
    period_operating_expenses: Number(raw.period_operating_expenses) || 0,
    sales_trend: Array.isArray(raw.sales_trend)
      ? (raw.sales_trend as { date: string; value: number }[])
      : [],
    expense_trend: Array.isArray(raw.expense_trend)
      ? (raw.expense_trend as { date: string; value: number }[])
      : [],
    profit_trend: Array.isArray(raw.profit_trend)
      ? (raw.profit_trend as { date: string; value: number }[])
      : [],
    error: raw.error != null ? String(raw.error) : undefined,
  };
}

function emptyPayload(): DashboardMetricsPayload {
  return {
    metrics: {
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
    },
    sales_by_category: [],
    low_stock_items: [],
  };
}

async function enrichLiquidityMetrics(
  companyId: string,
  branchId: string | null | undefined,
  metrics: FinancialDashboardMetrics
): Promise<FinancialDashboardMetrics> {
  let next = { ...metrics };
  const needsGl =
    (Number(next.cash_balance) || 0) === 0 &&
    (Number(next.bank_balance) || 0) === 0 &&
    (Number(next.receivables) || 0) === 0 &&
    (Number(next.payables) || 0) === 0;

  if (needsGl) {
    const { data: fin, error: finErr } = await getFinancialDashboardMetrics(companyId, branchId);
    if (fin && !finErr) {
      next = {
        ...next,
        cash_balance: Number(fin.cash_balance) || next.cash_balance,
        bank_balance: Number(fin.bank_balance) || next.bank_balance,
        receivables: Number(fin.receivables) || next.receivables,
        payables: Number(fin.payables) || next.payables,
        ar_ap_basis: fin.ar_ap_basis ?? next.ar_ap_basis,
        ar_ap_scope: fin.ar_ap_scope ?? next.ar_ap_scope,
      };
    }
  }

  if ((Number(next.receivables) || 0) === 0 || (Number(next.payables) || 0) === 0) {
    const { map, error: balErr } = await fetchContactBalancesSummary(companyId, branchId);
    if (!balErr && map.size > 0) {
      let rec = 0;
      let pay = 0;
      for (const v of map.values()) {
        rec += v.receivables;
        pay += v.payables;
      }
      if ((Number(next.receivables) || 0) === 0 && rec > 0) next.receivables = rec;
      if ((Number(next.payables) || 0) === 0 && pay > 0) next.payables = pay;
      next.ar_ap_basis = next.ar_ap_basis ?? 'get_contact_balances_summary';
    }
  }

  return next;
}

async function getDashboardMetricsFallback(
  companyId: string,
  branchId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
): Promise<{ data: DashboardMetricsPayload | null; error: string | null }> {
  const { data: metrics, error: finErr } = await getFinancialDashboardMetrics(companyId, branchId);
  if (finErr || !metrics) {
    return { data: null, error: finErr ?? 'Financial metrics unavailable.' };
  }
  let merged = metrics;
  if (startDate && endDate) {
    const direct = await queryExecutivePeriodMetrics(companyId, branchId, startDate, endDate);
    merged = mergePeriodMetrics(merged, direct);
  }
  merged = await enrichLiquidityMetrics(companyId, branchId, merged);
  return {
    data: {
      metrics: merged,
      sales_by_category: [],
      low_stock_items: [],
      error: merged.error,
    },
    error: null,
  };
}

export async function getDashboardMetrics(
  companyId: string,
  branchId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
): Promise<{ data: DashboardMetricsPayload | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  if (!companyId) return { data: null, error: 'Missing company.' };

  try {
    const { data, error } = await supabase.rpc('get_dashboard_metrics', {
      p_company_id: companyId,
      p_branch_id: safeRpcBranchId(branchId),
      p_start_date: startDate ? startDate.slice(0, 10) : null,
      p_end_date: endDate ? endDate.slice(0, 10) : null,
    });

    if (error) throw error;

    const raw = data as Record<string, unknown> | null;
    if (!raw) throw new Error('No data');

    const metricsRaw = raw.metrics as Record<string, unknown> | undefined;
    let metrics = metricsRaw ? parseFinancialMetrics(metricsRaw) : emptyPayload().metrics;

    if (startDate && endDate) {
      const direct = await queryExecutivePeriodMetrics(companyId, branchId, startDate, endDate);
      metrics = mergePeriodMetrics(metrics, direct);
    }
    metrics = await enrichLiquidityMetrics(companyId, branchId, metrics);

    return {
      data: {
        metrics,
        sales_by_category: Array.isArray(raw.sales_by_category)
          ? (raw.sales_by_category as Array<{ categoryName: string; total: number }>)
          : [],
        low_stock_items: Array.isArray(raw.low_stock_items)
          ? (raw.low_stock_items as DashboardLowStockItem[])
          : [],
        error: raw.error != null ? String(raw.error) : undefined,
      },
      error: null,
    };
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn('[DASHBOARD] get_dashboard_metrics RPC failed, using fallback:', e);
    }
    return getDashboardMetricsFallback(companyId, branchId, startDate, endDate);
  }
}
