import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStockLabel,
  isPickerStockGateExempt,
  isProductSaleBlockedByStock,
  isSaleBlockedByStock,
} from './productStockGate.ts';

describe('productStockGate picker exemptions', () => {
  it('blocks tracked zero-stock when negative stock disallowed', () => {
    assert.equal(isSaleBlockedByStock(0, false), true);
    assert.equal(
      isProductSaleBlockedByStock({ sku: 'FABRIC-001', stock: 0, trackStock: true }, false),
      true
    );
    assert.equal(formatStockLabel(0, false), 'Out of stock');
  });

  it('exempts CUSTOM-* SKUs even at zero stock', () => {
    assert.equal(isPickerStockGateExempt({ sku: 'CUSTOM-BRIDAL' }), true);
    assert.equal(isPickerStockGateExempt({ sku: 'CUSTOM-CASUAL' }), true);
    assert.equal(
      isProductSaleBlockedByStock({ sku: 'CUSTOM-BRIDAL', stock: 0, trackStock: false }, false),
      false
    );
    assert.equal(formatStockLabel(0, false, { exempt: true }), 'Made to order');
  });

  it('exempts track_stock false non-CUSTOM products', () => {
    assert.equal(isPickerStockGateExempt({ sku: 'SERVICE-FEE', trackStock: false }), true);
    assert.equal(isPickerStockGateExempt({ sku: 'SERVICE-FEE', track_stock: false }), true);
    assert.equal(
      isProductSaleBlockedByStock({ sku: 'SERVICE-FEE', stock: 0, trackStock: false }, false),
      false
    );
  });

  it('does not exempt tracked in-stock or when negative allowed', () => {
    assert.equal(isPickerStockGateExempt({ sku: 'SKU-1', trackStock: true }), false);
    assert.equal(isProductSaleBlockedByStock({ sku: 'SKU-1', stock: 5, trackStock: true }, false), false);
    assert.equal(isProductSaleBlockedByStock({ sku: 'SKU-1', stock: 0, trackStock: true }, true), false);
  });
});
