import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareBalanceSheetUnifiedPreview,
  compareProfitLossUnifiedPreview,
} from './bsPlUnifiedPreviewDiff';

test('compareBalanceSheetUnifiedPreview passes on matching totals', () => {
  const diff = compareBalanceSheetUnifiedPreview({
    legacy: {
      assets: { label: 'Assets', items: [], total: 100 },
      liabilities: { label: 'Liabilities', items: [], total: 40 },
      equity: { label: 'Equity', items: [], total: 60 },
      totalAssets: 100,
      totalLiabilitiesAndEquity: 100,
      difference: 0,
      tbImbalance: 0,
      asOfDate: '2026-06-01',
    },
    preview: {
      previewOnly: true,
      needsFinanceGoldenApproval: true,
      asOfDate: '2026-06-01',
      totalAssets: 100,
      totalLiabilities: 40,
      totalEquity: 60,
      totalLiabilitiesAndEquity: 100,
      difference: 0,
      tbImbalance: 0,
      netIncome: 0,
      assetLineCount: 1,
      liabilityLineCount: 1,
      equityLineCount: 1,
      accountingRuleNotes: [],
    },
  });
  assert.equal(diff.pass, true);
  assert.equal(diff.assetsDelta, 0);
});

test('compareProfitLossUnifiedPreview detects net profit delta', () => {
  const diff = compareProfitLossUnifiedPreview({
    legacy: {
      revenue: { label: 'Revenue', items: [], total: 1000 },
      costOfSales: { label: 'COGS', items: [], total: 200 },
      grossProfit: 800,
      expenses: { label: 'Expenses', items: [], total: 100 },
      netProfit: 700,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    },
    preview: {
      previewOnly: true,
      needsFinanceGoldenApproval: true,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      totalRevenue: 1000,
      totalCostOfSales: 200,
      grossProfit: 800,
      totalExpenses: 100,
      netProfit: 650,
      revenueLineCount: 1,
      costLineCount: 1,
      expenseLineCount: 1,
      accountingRuleNotes: [],
    },
  });
  assert.equal(diff.pass, false);
  assert.equal(diff.netProfitDelta, 50);
});
