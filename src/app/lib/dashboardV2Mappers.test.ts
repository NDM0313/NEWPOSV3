import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSummaryFromMetrics, buildStockAlerts, mergeTrends } from './dashboardV2Mappers';
import { formatPeriodLabel } from './dashboardV2Period';
import type { FinancialDashboardMetrics } from '@/app/services/financialDashboardService';
import type { DashboardV2StockRow } from './dashboardV2Stock';

function emptyMetrics(overrides: Partial<FinancialDashboardMetrics> = {}): FinancialDashboardMetrics {
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
    ...overrides,
  };
}

test('buildSummaryFromMetrics computes operational net profit', () => {
  const s = buildSummaryFromMetrics(
    emptyMetrics({
      today_sales: 1000,
      period_purchases: 300,
      period_operating_expenses: 200,
    })
  );
  assert.equal(s.netProfit, 500);
  assert.equal(s.profitBasis, 'operational');
});

test('buildStockAlerts preview count matches alert count', () => {
  const rows: DashboardV2StockRow[] = [
    { id: '1', productId: 'p1', name: 'A', sku: 'S', stock: 1, minStock: 5, status: 'low', category: 'C' },
    { id: '2', productId: 'p2', name: 'B', sku: 'S2', stock: 0, minStock: 1, status: 'out', category: 'C' },
  ];
  const alerts = buildStockAlerts(rows);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].count, 1);
});

test('mergeTrends aligns expense trend dates with sales trend', () => {
  const merged = mergeTrends(
    [{ date: '2026-01-01', value: 100 }],
    [{ date: '2026-01-01', value: 40 }]
  );
  assert.equal(merged[0].purchases, 40);
});

test('formatPeriodLabel via period helper', () => {
  assert.equal(formatPeriodLabel('2026-01-01', '2026-01-31'), '2026-01-01 → 2026-01-31');
});
