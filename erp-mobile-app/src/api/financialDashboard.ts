/**
 * Executive dashboard metrics — same RPC as web `financialDashboardService`.
 * AR/AP in RPC (migration 20260370+) = SUM(get_contact_balances_summary) for company or selected branch.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { safeRpcBranchId } from './contactBalancesRpc';

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
  ar_ap_basis?: string;
  ar_ap_scope?: string;
  period_purchases?: number;
  period_operating_expenses?: number;
  sales_trend: { date: string; value: number }[];
  expense_trend: { date: string; value: number }[];
  profit_trend: { date: string; value: number }[];
  error?: string;
}

function normalizeTrend(raw: unknown): { date: string; value: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const o = x as { date?: unknown; value?: unknown };
    const d = o.date != null ? String(o.date).slice(0, 10) : '';
    return { date: d, value: Number(o.value) || 0 };
  });
}

export async function getFinancialDashboardMetrics(
  companyId: string,
  branchId?: string | null
): Promise<{ data: FinancialDashboardMetrics | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  if (!companyId) return { data: null, error: 'Missing company.' };

  const { data, error } = await supabase.rpc('get_financial_dashboard_metrics', {
    p_company_id: companyId,
    p_branch_id: safeRpcBranchId(branchId),
  });

  if (error) {
    return { data: null, error: error.message };
  }

  const raw = data as Record<string, unknown> | null;
  if (!raw) return { data: null, error: null };

  return {
    data: {
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
      sales_trend: normalizeTrend(raw.sales_trend),
      expense_trend: normalizeTrend(raw.expense_trend),
      profit_trend: normalizeTrend(raw.profit_trend),
      error: raw.error != null ? String(raw.error) : undefined,
    },
    error: null,
  };
}

/** Sum the last `n` points in a trend (RPC trends are ordered oldest → newest). */
export function sumTrendTail(trend: { value: number }[], n: number): number {
  if (!trend.length || n <= 0) return 0;
  const slice = trend.slice(-n);
  return slice.reduce((s, x) => s + (Number(x.value) || 0), 0);
}
