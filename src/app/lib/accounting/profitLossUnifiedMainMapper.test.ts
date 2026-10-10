import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapUnifiedTrialBalanceToProfitLossMain } from './profitLossUnifiedMainMapper';

test('mapUnifiedTrialBalanceToProfitLossMain splits COGS vs expenses', () => {
  const result = mapUnifiedTrialBalanceToProfitLossMain({
    rows: [
      {
        account_id: 'r1',
        account_code: '4000',
        account_name: 'Sales',
        account_type: 'revenue',
        debit: 0,
        credit: 1000,
        balance: -1000,
      },
      {
        account_id: 'c1',
        account_code: '5000',
        account_name: 'COGS',
        account_type: 'expense',
        debit: 200,
        credit: 0,
        balance: 200,
      },
      {
        account_id: 'e1',
        account_code: '5200',
        account_name: 'Discount',
        account_type: 'expense',
        debit: 50,
        credit: 0,
        balance: 50,
      },
    ],
    startDate: '2026-01-01',
    endDate: '2026-06-30',
  });
  assert.equal(result.revenue.total, 1000);
  assert.equal(result.costOfSales.total, 200);
  assert.equal(result.expenses.total, 50);
  assert.equal(result.netProfit, 750);
});
