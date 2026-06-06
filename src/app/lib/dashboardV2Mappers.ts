/**
 * Dashboard V2 — map RPC / service payloads into DashboardV2Snapshot.
 */
import type { FinancialDashboardMetrics } from '@/app/services/financialDashboardService';
import type { DashboardV2StockRow } from '@/app/lib/dashboardV2Stock';
import { formatPeriodLabel, trendPercent } from '@/app/lib/dashboardV2Period';

export interface DashboardV2Alert {
  id: string;
  kind: 'low_stock' | 'out_of_stock' | 'negative_stock' | 'rental_due' | 'rental_overdue' | 'negative_cash' | 'negative_bank' | 'receivables' | 'payables';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  count: number;
  amount?: number;
  viewTarget?: string;
  previewRows?: { label: string; detail: string }[];
}

export interface BranchMetricRow {
  branchId: string;
  branchName: string;
  sales: number;
  purchases: number;
  expenses: number;
}

export interface DashboardV2Snapshot {
  meta: {
    loadedAt: string;
    dateFrom: string;
    dateTo: string;
    branchId: string | null;
    periodLabel: string;
    periodScope: string;
    cashBankScope: string;
    arApBasis?: string;
  };
  summary: {
    periodSales: number;
    periodPurchases: number;
    periodOperatingExpenses: number;
    grossProfit: number;
    netProfit: number;
    profitMarginPct: number;
    profitBasis: 'operational';
    cashBalance: number;
    bankBalance: number;
    cashBankByAccount: { code: string; name: string; balance: number }[];
    receivables: number;
    payables: number;
    priorPeriod?: {
      periodSales: number;
      netProfit: number;
      salesTrendPct: number | null;
      profitTrendPct: number | null;
    };
  };
  branchBreakdown: BranchMetricRow[];
  alerts: DashboardV2Alert[];
  charts: {
    salesTrend: { date: string; value: number }[];
    purchasesExpensesTrend: { date: string; purchases: number; expenses: number }[];
    profitTrend: { date: string; value: number }[];
    salesByCategory: { categoryName: string; total: number }[];
    paymentMethodBreakdown: { method: string; amount: number }[];
    topCustomers: { name: string; total: number }[];
  };
  operations: {
    lowStock: DashboardV2StockRow[];
    recentSales: { id: string; label: string; amount: number; date: string }[];
    recentPurchases: { id: string; label: string; amount: number; date: string }[];
    recentExpenses: { id: string; label: string; amount: number; date: string }[];
    recentPayments: { id: string; label: string; amount: number; date: string }[];
    rentals: { id: string; bookingNo: string; status: string; dueAmount: number; returnDate: string }[];
  };
  limitations: string[];
}

export function buildSummaryFromMetrics(
  m: FinancialDashboardMetrics,
  prior?: FinancialDashboardMetrics | null
): DashboardV2Snapshot['summary'] {
  const periodSales = Number(m.today_sales) || Number(m.monthly_revenue) || 0;
  const periodPurchases = Number(m.period_purchases) || 0;
  const periodOperatingExpenses = Number(m.period_operating_expenses) || 0;
  const netProfit = periodSales - periodPurchases - periodOperatingExpenses;
  const grossProfit = netProfit;
  const profitMarginPct = periodSales > 0 ? Math.round((netProfit / periodSales) * 1000) / 10 : 0;
  const summary: DashboardV2Snapshot['summary'] = {
    periodSales,
    periodPurchases,
    periodOperatingExpenses,
    grossProfit,
    netProfit,
    profitMarginPct,
    profitBasis: 'operational',
    cashBalance: Number(m.cash_balance) || 0,
    bankBalance: Number(m.bank_balance) || 0,
    cashBankByAccount: [],
    receivables: Number(m.receivables) || 0,
    payables: Number(m.payables) || 0,
  };
  if (prior) {
    const pSales = Number(prior.today_sales) || Number(prior.monthly_revenue) || 0;
    const pProfit =
      pSales - (Number(prior.period_purchases) || 0) - (Number(prior.period_operating_expenses) || 0);
    summary.priorPeriod = {
      periodSales: pSales,
      netProfit: pProfit,
      salesTrendPct: trendPercent(periodSales, pSales),
      profitTrendPct: trendPercent(netProfit, pProfit),
    };
  }
  return summary;
}

export function buildStockAlerts(stockRows: DashboardV2StockRow[]): DashboardV2Alert[] {
  const alerts: DashboardV2Alert[] = [];
  const low = stockRows.filter((r) => r.status === 'low');
  const out = stockRows.filter((r) => r.status === 'out');
  const neg = stockRows.filter((r) => r.status === 'negative');
  if (low.length) {
    alerts.push({
      id: 'low_stock',
      kind: 'low_stock',
      title: 'Low Stock',
      message: `${low.length} product(s) below minimum stock level.`,
      severity: 'warning',
      count: low.length,
      viewTarget: 'inventory',
      previewRows: low.slice(0, 5).map((r) => ({ label: r.name, detail: `${r.stock} / min ${r.minStock}` })),
    });
  }
  if (out.length) {
    alerts.push({
      id: 'out_of_stock',
      kind: 'out_of_stock',
      title: 'Out of Stock',
      message: `${out.length} product(s) with zero stock.`,
      severity: 'critical',
      count: out.length,
      viewTarget: 'inventory',
      previewRows: out.slice(0, 5).map((r) => ({ label: r.name, detail: `Stock: ${r.stock}` })),
    });
  }
  if (neg.length) {
    alerts.push({
      id: 'negative_stock',
      kind: 'negative_stock',
      title: 'Negative Stock',
      message: `${neg.length} product(s) with negative quantity.`,
      severity: 'critical',
      count: neg.length,
      viewTarget: 'inventory',
      previewRows: neg.slice(0, 5).map((r) => ({ label: r.name, detail: `${r.stock}` })),
    });
  }
  return alerts;
}

export function mergeTrends(
  salesTrend: { date: string; value: number }[],
  expenseTrend: { date: string; value: number }[]
): { date: string; purchases: number; expenses: number }[] {
  const byDate = new Map<string, { purchases: number; expenses: number }>();
  for (const e of expenseTrend) {
    byDate.set(e.date, { purchases: e.value, expenses: 0 });
  }
  return salesTrend.map((s) => {
    const ex = byDate.get(s.date);
    return { date: s.date, purchases: ex?.purchases ?? 0, expenses: ex?.expenses ?? 0 };
  });
}

export function defaultLimitations(): string[] {
  return [
    'Period profit is operational (sales − purchases − paid expenses), not GL P&L.',
    'COGS is not journal-sourced in v1 — use Profit & Loss report for GL accuracy.',
    'Cash and bank balances are company-wide GL as-of today.',
  ];
}

export function buildMeta(
  dateFrom: string,
  dateTo: string,
  branchId: string | null,
  m: FinancialDashboardMetrics
): DashboardV2Snapshot['meta'] {
  return {
    loadedAt: new Date().toISOString(),
    dateFrom,
    dateTo,
    branchId,
    periodLabel: formatPeriodLabel(dateFrom, dateTo),
    periodScope: m.period_scope || (branchId && branchId !== 'all' ? 'branch' : 'all_branches'),
    cashBankScope: m.cash_bank_scope || 'company',
    arApBasis: m.ar_ap_basis,
  };
}
