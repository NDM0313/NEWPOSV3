import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineClearanceAlloc, purchaseClearanceTotal, purchaseHasSeparateClearance } from './purchaseClearanceAlloc';

test('lineClearanceAlloc splits proportionally', () => {
  const alloc = lineClearanceAlloc(1000, 10000, 24573440);
  assert.equal(alloc, 2457344);
});

test('purchaseHasSeparateClearance when shipping_cost set', () => {
  assert.equal(purchaseHasSeparateClearance({ shipping_cost: 24573440 }), true);
  assert.equal(purchaseHasSeparateClearance({ shipping_cost: 0 }), false);
});

test('purchaseClearanceTotal reads shippingCost alias', () => {
  assert.equal(purchaseClearanceTotal({ shippingCost: 100 }), 100);
});
