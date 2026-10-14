import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getFreightSettlement,
  isWholesaleImportClearance,
  purchaseClearanceAmount,
  purchaseSupplierDue,
  purchaseSupplierPayableBase,
  isCourierFreightChargeType,
} from './wholesaleImportPurchaseCalc';

test('purchaseSupplierPayableBase excludes shipping', () => {
  const base = purchaseSupplierPayableBase({
    subtotal: 43404978.4,
    discount_amount: 0,
    tax_amount: 0,
    shipping_cost: 24573440,
    total: 67978418.4,
  });
  assert.equal(base, 43404978.4);
});

test('purchaseSupplierDue for PO2025/0003 pattern', () => {
  const due = purchaseSupplierDue({
    subtotal: 43404978.4,
    discount_amount: 0,
    tax_amount: 0,
    paid_amount: 41343000,
    freight_settlement: 'courier',
  });
  assert.equal(due, 2061978.4);
});

test('isWholesaleImportClearance requires courier id', () => {
  assert.equal(
    isWholesaleImportClearance({ freight_settlement: 'courier', clearance_courier_id: 'abc' }),
    true
  );
  assert.equal(isWholesaleImportClearance({ freight_settlement: 'courier' }), false);
  assert.equal(isWholesaleImportClearance({ freight_settlement: 'supplier' }), false);
});

test('getFreightSettlement defaults to supplier', () => {
  assert.equal(getFreightSettlement({}), 'supplier');
  assert.equal(getFreightSettlement({ freight_settlement: 'courier' }), 'courier');
});

test('purchaseClearanceAmount reads shipping columns', () => {
  assert.equal(purchaseClearanceAmount({ shipping_cost: 100 }), 100);
  assert.equal(purchaseClearanceAmount({ shippingCost: 50 }), 50);
});

test('isCourierFreightChargeType', () => {
  assert.equal(isCourierFreightChargeType('freight'), true);
  assert.equal(isCourierFreightChargeType('loading'), false);
});
