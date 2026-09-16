import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapUnifiedTrialBalanceToBalanceSheetMain } from './balanceSheetUnifiedMainMapper';

test('mapUnifiedTrialBalanceToBalanceSheetMain balances assets and L+E', () => {
  const result = mapUnifiedTrialBalanceToBalanceSheetMain({
    tb: {
      rows: [
        { account_id: 'a1', account_code: '1010', account_name: 'Cash', account_type: 'asset', debit: 500, credit: 0, balance: 500 },
        { account_id: 'l1', account_code: '2000', account_name: 'AP', account_type: 'liability', debit: 0, credit: 200, balance: -200 },
        { account_id: 'e1', account_code: '3000', account_name: 'Capital', account_type: 'equity', debit: 0, credit: 300, balance: -300 },
      ],
      totalDebit: 500,
      totalCredit: 500,
    },
    accounts: [
      { id: 'a1', code: '1010', name: 'Cash', type: 'asset' },
      { id: 'l1', code: '2000', name: 'AP', type: 'liability' },
      { id: 'e1', code: '3000', name: 'Capital', type: 'equity' },
    ],
    asOfDate: '2026-06-30',
  });
  assert.equal(result.totalAssets, 500);
  assert.equal(result.liabilities.total, 200);
  assert.equal(result.equity.total, 300);
  assert.equal(result.difference, 0);
});
