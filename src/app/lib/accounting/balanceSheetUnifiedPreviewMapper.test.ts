import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapTrialBalanceToBalanceSheetPreview } from './balanceSheetUnifiedPreviewMapper';

test('maps asset and liability TB rows to BS preview sections', () => {
  const result = mapTrialBalanceToBalanceSheetPreview({
    asOfDate: '2026-06-01',
    accounts: [
      { id: 'a1', code: '1000', name: 'Cash', type: 'asset', is_group: false },
      { id: 'l1', code: '2000', name: 'AP', type: 'liability', is_group: false },
      { id: 'e1', code: '3000', name: 'Equity', type: 'equity', is_group: false },
    ],
    tb: {
      totalDebit: 1000,
      totalCredit: 1000,
      rows: [
        { account_id: 'a1', account_code: '1000', account_name: 'Cash', account_type: 'asset', debit: 1000, credit: 0, balance: 1000 },
        { account_id: 'l1', account_code: '2000', account_name: 'AP', account_type: 'liability', debit: 0, credit: 400, balance: -400 },
        { account_id: 'e1', account_code: '3000', account_name: 'Equity', account_type: 'equity', debit: 0, credit: 600, balance: -600 },
      ],
    },
  });

  assert.equal(result.previewOnly, true);
  assert.equal(result.needsFinanceGoldenApproval, true);
  assert.equal(result.totalAssets, 1000);
  assert.equal(result.totalLiabilities, 400);
  assert.equal(result.totalEquity, 600);
  assert.equal(result.difference, 0);
});

test('folds revenue/expense into net income on equity', () => {
  const result = mapTrialBalanceToBalanceSheetPreview({
    asOfDate: '2026-06-01',
    accounts: [
      { id: 'a1', code: '1000', name: 'Cash', type: 'asset', is_group: false },
      { id: 'r1', code: '4000', name: 'Sales', type: 'revenue', is_group: false },
      { id: 'e1', code: '3000', name: 'Equity', type: 'equity', is_group: false },
    ],
    tb: {
      totalDebit: 500,
      totalCredit: 500,
      rows: [
        { account_id: 'a1', account_code: '1000', account_name: 'Cash', account_type: 'asset', debit: 500, credit: 0, balance: 500 },
        { account_id: 'r1', account_code: '4000', account_name: 'Sales', account_type: 'revenue', debit: 0, credit: 200, balance: -200 },
        { account_id: 'e1', account_code: '3000', account_name: 'Equity', account_type: 'equity', debit: 0, credit: 300, balance: -300 },
      ],
    },
  });

  assert.equal(result.netIncome, 200);
  assert.equal(result.totalAssets, 500);
  assert.equal(result.totalEquity, 500);
  assert.equal(result.difference, 0);
});
