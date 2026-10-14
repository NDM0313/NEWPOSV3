import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapTrialBalanceRowsToProfitLossPreview } from './profitLossUnifiedPreviewMapper';

test('maps revenue and expense TB rows to P&L preview', () => {
  const result = mapTrialBalanceRowsToProfitLossPreview({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    rows: [
      { account_id: 'r1', account_code: '4000', account_name: 'Sales', account_type: 'revenue', debit: 0, credit: 1000, balance: -1000 },
      { account_id: 'c1', account_code: '5000', account_name: 'COGS', account_type: 'expense', debit: 400, credit: 0, balance: 400 },
      { account_id: 'e1', account_code: '5200', account_name: 'Discount', account_type: 'expense', debit: 50, credit: 0, balance: 50 },
    ],
  });

  assert.equal(result.previewOnly, true);
  assert.equal(result.totalRevenue, 1000);
  assert.equal(result.totalCostOfSales, 400);
  assert.equal(result.grossProfit, 600);
  assert.equal(result.totalExpenses, 50);
  assert.equal(result.netProfit, 550);
  assert.ok(result.accountingRuleNotes.some((n) => n.includes('NEEDS_RULE_CONFIRMATION')));
});

test('zero activity yields zero net profit', () => {
  const result = mapTrialBalanceRowsToProfitLossPreview({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    rows: [],
  });
  assert.equal(result.netProfit, 0);
});
