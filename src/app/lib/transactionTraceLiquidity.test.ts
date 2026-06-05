import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLiquidityPaymentAccount } from './liquidityPaymentAccount';

test('1002 and 1003 cash type accounts are liquidity', () => {
  assert.equal(isLiquidityPaymentAccount({ code: '1002', type: 'cash', name: 'CASH G140' }), true);
  assert.equal(isLiquidityPaymentAccount({ code: '1003', type: 'cash', name: 'Cash in NDM' }), true);
});

test('AR line is not liquidity', () => {
  assert.equal(isLiquidityPaymentAccount({ code: 'AR-CUS0001', type: 'asset', name: 'Receivable' }), false);
});

test('bank type is liquidity without canonical code', () => {
  assert.equal(isLiquidityPaymentAccount({ code: '1012', type: 'bank', name: 'FHD MZ' }), true);
});
