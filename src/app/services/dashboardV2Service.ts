/**
 * Dashboard V2 — single facade for dashboard snapshot loading.
 */
import { supabase } from '@/lib/supabase';
import { safeRpcBranchId } from '@/app/lib/safeRpcBranchId';
import {
  getDashboardMetrics,
  parseFinancialMetrics,
  type FinancialDashboardMetrics,
} from '@/app/services/financialDashboardService';
import { inventoryService } from '@/app/services/inventoryService';
import { mapOverviewToStockAlerts } from '@/app/lib/dashboardV2Stock';
import { priorComparablePeriod } from '@/app/lib/dashboardV2Period';
import {
  buildMeta,
  buildStockAlerts,
  buildSummaryFromMetrics,
  defaultLimitations,
  mergeTrends,
  type DashboardV2Alert,
  type DashboardV2Snapshot,
  type BranchMetricRow,
} from '@/app/lib/dashboardV2Mappers';

export interface LoadSnapshotParams {
  companyId: string;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
}

interface CacheEntry {
  at: number;
  data: DashboardV2Snapshot;
}

const CACHE_TTL_MS = 60_000;
const snapshotCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<DashboardV2Snapshot>>();

function cacheKey(p: LoadSnapshotParams): string {
  const bid = p.branchId && p.branchId !== 'all' ? p.branchId : 'all';
  return `${p.companyId}:${bid}:${p.dateFrom}:${p.dateTo}`;
}

function mapRecentRows(rows: unknown[]): DashboardV2Snapshot['operations']['recentSales'] {
  return (rows || []).map((r: any) => ({
    id: String(r.id),
    label: String(r.label ?? r.id),
    amount: Number(r.amount) || 0,
    date: String(r.date ?? '').slice(0, 10),
  }));
}

function mapRentals(rows: unknown[]): DashboardV2Snapshot['operations']['rentals'] {
  return (rows || []).map((r: any) => ({
    id: String(r.id),
    bookingNo: String(r.booking_no ?? ''),
    status: String(r.status ?? ''),
    dueAmount: Number(r.due_amount) || 0,
    returnDate: String(r.return_date ?? '').slice(0, 10),
  }));
}

function buildLiquidityAlerts(summary: DashboardV2Snapshot['summary']): DashboardV2Alert[] {
  const alerts: DashboardV2Alert[] = [];
  if (summary.cashBalance < 0) {
    alerts.push({
      id: 'negative_cash',
      kind: 'negative_cash',
      title: 'Negative Cash',
      message: 'Cash GL balance is negative.',
      severity: 'critical',
      count: 1,
      amount: summary.cashBalance,
      viewTarget: 'accounting',
    });
  }
  if (summary.bankBalance < 0) {
    alerts.push({
      id: 'negative_bank',
      kind: 'negative_bank',
      title: 'Negative Bank',
      message: 'Bank GL balance is negative.',
      severity: 'critical',
      count: 1,
      amount: summary.bankBalance,
      viewTarget: 'accounting',
    });
  }
  if (summary.receivables > 0) {
    alerts.push({
      id: 'receivables',
      kind: 'receivables',
      title: 'Receivables',
      message: `${summary.receivables.toLocaleString()} outstanding from customers.`,
      severity: 'info',
      count: 1,
      amount: summary.receivables,
      viewTarget: 'customer-ledger',
    });
  }
  if (summary.payables > 0) {
    alerts.push({
      id: 'payables',
      kind: 'payables',
      title: 'Payables',
      message: `${summary.payables.toLocaleString()} owed to suppliers.`,
      severity: 'warning',
      count: 1,
      amount: summary.payables,
      viewTarget: 'supplier-ledger',
    });
  }
  return alerts;
}

function buildRentalAlerts(rentals: DashboardV2Snapshot['operations']['rentals']): DashboardV2Alert[] {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = rentals.filter((r) => r.status === 'overdue' || (r.returnDate && r.returnDate < today));
  const dueSoon = rentals.filter(
    (r) => r.returnDate && r.returnDate >= today && r.status !== 'overdue' && r.dueAmount > 0
  );
  const alerts: DashboardV2Alert[] = [];
  if (overdue.length) {
    alerts.push({
      id: 'rental_overdue',
      kind: 'rental_overdue',
      title: 'Overdue Rentals',
      message: `${overdue.length} rental(s) overdue or past return date.`,
      severity: 'critical',
      count: overdue.length,
      viewTarget: 'rentals',
      previewRows: overdue.slice(0, 5).map((r) => ({ label: r.bookingNo, detail: r.returnDate })),
    });
  }
  if (dueSoon.length) {
    alerts.push({
      id: 'rental_due',
      kind: 'rental_due',
      title: 'Rental Payments Due',
      message: `${dueSoon.length} rental(s) with balance due.`,
      severity: 'warning',
      count: dueSoon.length,
      viewTarget: 'rentals',
      previewRows: dueSoon.slice(0, 5).map((r) => ({ label: r.bookingNo, detail: String(r.dueAmount) })),
    });
  }
  return alerts;
}

async function fetchV2Rpc(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('get_dashboard_v2_snapshot', {
    p_company_id: companyId,
    p_branch_id: safeRpcBranchId(branchId),
    p_start_date: dateFrom.slice(0, 10),
    p_end_date: dateTo.slice(0, 10),
  });
  if (error) {
    console.warn('[Dashboard V2] get_dashboard_v2_snapshot RPC failed:', error.message);
    return null;
  }
  const raw = (data as Record<string, unknown>) || null;
  if (!raw) return null;
  const metrics = raw.metrics as Record<string, unknown> | undefined;
  const rpcErr = raw.error != null ? String(raw.error) : '';
  if (rpcErr && (!metrics || Object.keys(metrics).length === 0)) {
    console.warn('[Dashboard V2] RPC returned error payload:', rpcErr);
    return null;
  }
  return raw;
}

async function loadSnapshotInner(params: LoadSnapshotParams): Promise<DashboardV2Snapshot> {
  const { companyId, branchId, dateFrom, dateTo } = params;
  const branchNorm = branchId && branchId !== 'all' ? branchId : null;

  const prior = priorComparablePeriod(dateFrom, dateTo);

  const [rpcRaw, overview, priorPayload] = await Promise.all([
    fetchV2Rpc(companyId, branchNorm, dateFrom, dateTo),
    inventoryService.getInventoryOverview(companyId, branchNorm),
    getDashboardMetrics(companyId, branchNorm, prior.from, prior.to).catch(() => null),
  ]);

  let metrics: FinancialDashboardMetrics;
  let salesByCategory: Array<{ categoryName: string; total: number }> = [];
  let branchBreakdown: BranchMetricRow[] = [];
  let recentSales: DashboardV2Snapshot['operations']['recentSales'] = [];
  let recentPurchases: DashboardV2Snapshot['operations']['recentPurchases'] = [];
  let recentExpenses: DashboardV2Snapshot['operations']['recentExpenses'] = [];
  let recentPayments: DashboardV2Snapshot['operations']['recentPayments'] = [];
  let paymentMethodBreakdown: { method: string; amount: number }[] = [];
  let topCustomers: { name: string; total: number }[] = [];
  let rentals: DashboardV2Snapshot['operations']['rentals'] = [];
  let cashBankByAccount: { code: string; name: string; balance: number }[] = [];

  if (rpcRaw?.metrics) {
    metrics = parseFinancialMetrics(rpcRaw.metrics as Record<string, unknown>);
    salesByCategory = Array.isArray(rpcRaw.sales_by_category)
      ? (rpcRaw.sales_by_category as Array<{ categoryName: string; total: number }>)
      : [];
    branchBreakdown = (Array.isArray(rpcRaw.branch_breakdown) ? rpcRaw.branch_breakdown : []).map((b: any) => ({
      branchId: String(b.branch_id),
      branchName: String(b.branch_name ?? 'Branch'),
      sales: Number(b.sales) || 0,
      purchases: Number(b.purchases) || 0,
      expenses: Number(b.expenses) || 0,
    }));
    recentSales = mapRecentRows(rpcRaw.recent_sales as unknown[]);
    recentPurchases = mapRecentRows(rpcRaw.recent_purchases as unknown[]);
    recentExpenses = mapRecentRows(rpcRaw.recent_expenses as unknown[]);
    recentPayments = mapRecentRows(rpcRaw.recent_payments as unknown[]);
    paymentMethodBreakdown = (Array.isArray(rpcRaw.payment_method_breakdown) ? rpcRaw.payment_method_breakdown : []).map(
      (p: any) => ({ method: String(p.method), amount: Number(p.amount) || 0 })
    );
    topCustomers = (Array.isArray(rpcRaw.top_customers) ? rpcRaw.top_customers : []).map((c: any) => ({
      name: String(c.name),
      total: Number(c.total) || 0,
    }));
    rentals = mapRentals(rpcRaw.rental_alerts as unknown[]);
    cashBankByAccount = (Array.isArray(rpcRaw.cash_bank_by_account) ? rpcRaw.cash_bank_by_account : []).map((a: any) => ({
      code: String(a.code ?? ''),
      name: String(a.name ?? ''),
      balance: Number(a.balance) || 0,
    }));
  } else {
    const fallback = await getDashboardMetrics(companyId, branchNorm, dateFrom, dateTo);
    metrics = fallback.metrics;
    salesByCategory = fallback.sales_by_category;
  }

  const priorMetrics = priorPayload?.metrics ?? null;
  const summary = buildSummaryFromMetrics(metrics, priorMetrics);
  summary.cashBankByAccount = cashBankByAccount;

  const lowStock = mapOverviewToStockAlerts(overview);
  const stockAlerts = buildStockAlerts(lowStock);
  const liquidityAlerts = buildLiquidityAlerts(summary);
  const rentalAlerts = buildRentalAlerts(rentals);

  const normTrend = (rows: { date: string; value: number }[]) =>
    (rows ?? []).map((t) => ({ date: String(t.date).slice(0, 10), value: Number(t.value) || 0 }));
  const salesTrend = normTrend(metrics.sales_trend ?? []);
  const expenseTrend = normTrend(metrics.expense_trend ?? []);
  const profitTrend = normTrend(metrics.profit_trend ?? []);

  return {
    meta: buildMeta(dateFrom, dateTo, branchNorm, metrics),
    summary,
    branchBreakdown,
    alerts: [...stockAlerts, ...rentalAlerts, ...liquidityAlerts],
    charts: {
      salesTrend,
      purchasesExpensesTrend: mergeTrends(salesTrend, expenseTrend),
      profitTrend,
      salesByCategory,
      paymentMethodBreakdown,
      topCustomers,
    },
    operations: {
      lowStock,
      recentSales,
      recentPurchases,
      recentExpenses,
      recentPayments,
      rentals,
    },
    limitations: defaultLimitations(),
  };
}

export async function loadDashboardV2Snapshot(params: LoadSnapshotParams): Promise<DashboardV2Snapshot> {
  const key = cacheKey(params);
  const cached = snapshotCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = loadSnapshotInner(params)
    .then((data) => {
      snapshotCache.set(key, { at: Date.now(), data });
      inFlight.delete(key);
      return data;
    })
    .catch((e) => {
      inFlight.delete(key);
      throw e;
    });

  inFlight.set(key, promise);
  return promise;
}

export function clearDashboardV2Cache(companyId?: string): void {
  if (!companyId) {
    snapshotCache.clear();
    inFlight.clear();
    return;
  }
  for (const k of [...snapshotCache.keys(), ...inFlight.keys()]) {
    if (k.startsWith(`${companyId}:`)) {
      snapshotCache.delete(k);
      inFlight.delete(k);
    }
  }
}
