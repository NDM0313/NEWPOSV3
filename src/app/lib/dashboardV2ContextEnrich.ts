/**
 * Enrich Dashboard V2 snapshot from loaded ERP contexts when RPC data is empty or partial.
 * Mirrors legacy Dashboard.tsx executiveFromContext + AccountingContext cash/bank merge.
 */
import type { FinancialDashboardMetrics } from '@/app/services/financialDashboardService';
import type { DashboardV2Snapshot } from '@/app/lib/dashboardV2Mappers';
import { buildSummaryFromMetrics, mergeTrends } from '@/app/lib/dashboardV2Mappers';
import { PURCHASE_POSTED_ACCOUNTING_STATUSES } from '@/app/lib/documentStatusConstants';
import { safeRpcBranchId } from '@/app/lib/safeRpcBranchId';

export interface ContextEnrichInput {
  sales: { id: string; date?: string; total?: number; status?: string; branchId?: string; invoiceNo?: string; invoice_no?: string }[];
  purchases: { id: string; poDate?: string; total?: number; status?: string; branchId?: string; poNumber?: string; po_number?: string }[];
  expenses: { id: string; expenseDate?: string; amount?: number; status?: string; branchId?: string; description?: string }[];
  accounts?: { type?: string; accountType?: string; balance?: number }[];
  dateFrom: string;
  dateTo: string;
  branchId?: string | null;
  priorMetrics?: FinancialDashboardMetrics | null;
}

function inRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const ds = dateStr.slice(0, 10);
  return ds >= from && ds <= to;
}

function matchesBranch(rowBranchId: string | undefined, filterBranchId: string | null): boolean {
  if (!filterBranchId) return true;
  if (!rowBranchId) return true;
  return rowBranchId === filterBranchId;
}

function saleDate(s: ContextEnrichInput['sales'][0]): string {
  return String((s as { date?: string; sale_date?: string; invoice_date?: string }).date
    ?? (s as { sale_date?: string }).sale_date
    ?? (s as { invoice_date?: string }).invoice_date
    ?? '').slice(0, 10);
}

function purchDate(p: ContextEnrichInput['purchases'][0]): string {
  return String(p.poDate ?? (p as { po_date?: string }).po_date ?? '').slice(0, 10);
}

function expDate(e: ContextEnrichInput['expenses'][0]): string {
  return String(e.expenseDate ?? (e as { expense_date?: string }).expense_date ?? '').slice(0, 10);
}

function metricsFromContext(input: ContextEnrichInput): FinancialDashboardMetrics {
  const { sales, purchases, expenses, dateFrom, dateTo, branchId } = input;
  const branchFilter = safeRpcBranchId(branchId ?? null);

  const finalSales = sales.filter(
    (s) => (s.status ?? '').toLowerCase() === 'final' && matchesBranch(s.branchId, branchFilter) && inRange(saleDate(s), dateFrom, dateTo)
  );
  const finalPurchases = purchases.filter(
    (p) => isPostedPurchaseStatus(p.status) && matchesBranch(p.branchId, branchFilter) && inRange(purchDate(p), dateFrom, dateTo)
  );
  const paidExpenses = expenses.filter(
    (e) => (e.status ?? '').toLowerCase() === 'paid' && matchesBranch(e.branchId, branchFilter) && inRange(expDate(e), dateFrom, dateTo)
  );

  const periodSales = finalSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const periodPurchases = finalPurchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
  const periodOperatingExpenses = paidExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = periodSales - periodPurchases - periodOperatingExpenses;

  const sales_trend: { date: string; value: number }[] = [];
  const expense_trend: { date: string; value: number }[] = [];
  const profit_trend: { date: string; value: number }[] = [];

  const start = new Date(`${dateFrom}T12:00:00`);
  const end = new Date(`${dateTo}T12:00:00`);
  for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
    const ds = t.toISOString().slice(0, 10);
    const daySales = finalSales.filter((s) => saleDate(s) === ds).reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const dayPurch = finalPurchases.filter((p) => purchDate(p) === ds).reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const dayExp = paidExpenses.filter((e) => expDate(e) === ds).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    sales_trend.push({ date: ds, value: daySales });
    expense_trend.push({ date: ds, value: dayPurch + dayExp });
    profit_trend.push({ date: ds, value: daySales - dayPurch - dayExp });
  }

  const receivables = sales
    .filter((s) => (s.status ?? '').toLowerCase() === 'final')
    .reduce((sum, s) => sum + (Number((s as { due?: number; due_amount?: number }).due ?? (s as { due_amount?: number }).due_amount) || 0), 0);
  const payables = purchases
    .filter((p) => isPostedPurchaseStatus(p.status))
    .reduce((sum, p) => sum + (Number((p as { due?: number; due_amount?: number }).due ?? (p as { due_amount?: number }).due_amount) || 0), 0);

  return {
    today_sales: periodSales,
    today_profit: netProfit,
    monthly_revenue: periodSales,
    monthly_expenses: periodPurchases + periodOperatingExpenses,
    monthly_profit: netProfit,
    profit_margin_pct: periodSales > 0 ? Math.round((netProfit / periodSales) * 10000) / 100 : 0,
    cash_balance: 0,
    bank_balance: 0,
    receivables,
    payables,
    period_purchases: periodPurchases,
    period_operating_expenses: periodOperatingExpenses,
    sales_trend,
    expense_trend,
    profit_trend,
    ar_ap_basis: 'context_fallback',
    period_scope: branchFilter ? 'branch' : 'all_branches',
    cash_bank_scope: 'company',
  };
}

function cashBankFromAccounts(accounts: ContextEnrichInput['accounts']): { cash: number; bank: number } {
  let cash = 0;
  let bank = 0;
  for (const a of accounts ?? []) {
    const t = String(a.type ?? a.accountType ?? '').toLowerCase();
    const bal = Number(a.balance) || 0;
    if (t === 'cash') cash += bal;
    if (t === 'bank') bank += bal;
  }
  return { cash, bank };
}

function isPostedPurchaseStatus(status: string | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return (PURCHASE_POSTED_ACCOUNTING_STATUSES as readonly string[]).includes(s);
}

function shouldUseContextPeriod(rpc: FinancialDashboardMetrics, ctx: FinancialDashboardMetrics): boolean {
  const rpcSales = Number(rpc.today_sales) || Number(rpc.monthly_revenue) || 0;
  const ctxSales = Number(ctx.today_sales) || 0;
  const ctxHasTrend = (ctx.sales_trend?.length ?? 0) > 0 && ctx.sales_trend.some((t) => Number(t.value) > 0);
  return rpcSales === 0 && (ctxSales > 0 || ctxHasTrend);
}

function recentFromContext(input: ContextEnrichInput): Pick<DashboardV2Snapshot['operations'], 'recentSales' | 'recentPurchases' | 'recentExpenses'> {
  const { sales, purchases, expenses, dateFrom, dateTo, branchId } = input;
  const branchFilter = safeRpcBranchId(branchId ?? null);

  const recentSales = sales
    .filter((s) => (s.status ?? '').toLowerCase() === 'final' && matchesBranch(s.branchId, branchFilter) && inRange(saleDate(s), dateFrom, dateTo))
    .sort((a, b) => saleDate(b).localeCompare(saleDate(a)))
    .slice(0, 10)
    .map((s) => ({
      id: s.id,
      label: String(s.invoiceNo ?? s.invoice_no ?? s.id),
      amount: Number(s.total) || 0,
      date: saleDate(s),
    }));

  const recentPurchases = purchases
    .filter((p) => isPostedPurchaseStatus(p.status) && matchesBranch(p.branchId, branchFilter) && inRange(purchDate(p), dateFrom, dateTo))
    .sort((a, b) => purchDate(b).localeCompare(purchDate(a)))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      label: String(p.poNumber ?? p.po_number ?? p.id),
      amount: Number(p.total) || 0,
      date: purchDate(p),
    }));

  const recentExpenses = expenses
    .filter((e) => (e.status ?? '').toLowerCase() === 'paid' && matchesBranch(e.branchId, branchFilter) && inRange(expDate(e), dateFrom, dateTo))
    .sort((a, b) => expDate(b).localeCompare(expDate(a)))
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      label: String(e.description ?? e.id),
      amount: Number(e.amount) || 0,
      date: expDate(e),
    }));

  return { recentSales, recentPurchases, recentExpenses };
}

function salesByCategoryFromContext(input: ContextEnrichInput): { categoryName: string; total: number }[] {
  // Context sales may not have category — skip unless we can derive; return empty
  return [];
}

/** Merge context data into snapshot when RPC fields are missing or all-zero. */
export function enrichDashboardSnapshot(
  snapshot: DashboardV2Snapshot,
  input: ContextEnrichInput
): DashboardV2Snapshot {
  const { accounts, priorMetrics } = input;
  let metrics: FinancialDashboardMetrics = {
    today_sales: snapshot.summary.periodSales,
    today_profit: snapshot.summary.netProfit,
    monthly_revenue: snapshot.summary.periodSales,
    monthly_expenses: snapshot.summary.periodPurchases + snapshot.summary.periodOperatingExpenses,
    monthly_profit: snapshot.summary.netProfit,
    profit_margin_pct: snapshot.summary.profitMarginPct,
    cash_balance: snapshot.summary.cashBalance,
    bank_balance: snapshot.summary.bankBalance,
    receivables: snapshot.summary.receivables,
    payables: snapshot.summary.payables,
    period_purchases: snapshot.summary.periodPurchases,
    period_operating_expenses: snapshot.summary.periodOperatingExpenses,
    sales_trend: snapshot.charts.salesTrend,
    expense_trend: snapshot.charts.purchasesExpensesTrend.map((t) => ({ date: t.date, value: t.purchases })),
    profit_trend: snapshot.charts.profitTrend,
    ar_ap_basis: snapshot.meta.arApBasis,
    period_scope: snapshot.meta.periodScope,
    cash_bank_scope: snapshot.meta.cashBankScope,
  };

  const contextMetrics = metricsFromContext(input);
  if (shouldUseContextPeriod(metrics, contextMetrics)) {
    metrics = { ...metrics, ...contextMetrics };
  } else {
    if ((Number(metrics.receivables) || 0) === 0 && (contextMetrics.receivables || 0) > 0) {
      metrics.receivables = contextMetrics.receivables;
    }
    if ((Number(metrics.payables) || 0) === 0 && (contextMetrics.payables || 0) > 0) {
      metrics.payables = contextMetrics.payables;
    }
  }

  const { cash, bank } = cashBankFromAccounts(accounts);
  if ((accounts?.length ?? 0) > 0) {
    metrics.cash_balance = cash;
    metrics.bank_balance = bank;
  } else if (Number(metrics.cash_balance) === 0 && Number(metrics.bank_balance) === 0) {
    // keep RPC values
  }

  const summary = buildSummaryFromMetrics(metrics, priorMetrics ?? null);
  summary.cashBankByAccount = snapshot.summary.cashBankByAccount;

  const contextRecent = recentFromContext(input);
  const operations = {
    ...snapshot.operations,
    recentSales: snapshot.operations.recentSales.length ? snapshot.operations.recentSales : contextRecent.recentSales,
    recentPurchases: snapshot.operations.recentPurchases.length ? snapshot.operations.recentPurchases : contextRecent.recentPurchases,
    recentExpenses: snapshot.operations.recentExpenses.length ? snapshot.operations.recentExpenses : contextRecent.recentExpenses,
  };

  const salesTrend = metrics.sales_trend ?? [];
  const expenseTrend = metrics.expense_trend ?? [];
  const profitTrend = metrics.profit_trend ?? [];

  return {
    ...snapshot,
    summary,
    meta: {
      ...snapshot.meta,
      arApBasis: metrics.ar_ap_basis ?? snapshot.meta.arApBasis,
      periodScope: metrics.period_scope ?? snapshot.meta.periodScope,
    },
    charts: {
      ...snapshot.charts,
      salesTrend,
      purchasesExpensesTrend: mergeTrends(salesTrend, expenseTrend),
      profitTrend,
      salesByCategory:
        snapshot.charts.salesByCategory.length > 0
          ? snapshot.charts.salesByCategory
          : salesByCategoryFromContext(input),
    },
    operations,
  };
}
