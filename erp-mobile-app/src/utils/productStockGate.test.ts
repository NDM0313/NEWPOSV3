import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStockLabel,
  getTotalProductStock,
  isPickerStockGateExempt,
  isProductSaleBlockedByStock,
  isSaleBlockedByStock,
} from './productStockGate.ts';
import { sumProductStockFromKeyMap } from './productStockFetch.ts';

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

describe('product stock rollup parity', () => {
  it('sumProductStockFromKeyMap includes orphan + all variation keys', () => {
    const pid = 'prod-velvet';
    const map = {
      [pid]: 10.5,
      [`${pid}_var-active`]: 100,
      [`${pid}_var-inactive`]: 52833.57 - 110.5,
      'other-prod': 999,
      'other-prod_v1': 1,
    };
    assert.equal(sumProductStockFromKeyMap(map, pid), 52833.57);
    assert.equal(sumProductStockFromKeyMap(map, 'other-prod'), 1000);
    assert.equal(sumProductStockFromKeyMap(map, 'missing'), 0);
  });

  it('getTotalProductStock prefers totalStock over active-variation-only sum', () => {
    const product = {
      sku: 'VELVET-0014',
      trackStock: true,
      hasVariations: true,
      stock: 0,
      variations: [{ stock: 0 }, { stock: 0 }],
      totalStock: 52833.57,
    };
    assert.equal(getTotalProductStock(product), 52833.57);
    assert.equal(isProductSaleBlockedByStock(product, false), false);
    assert.match(formatStockLabel(getTotalProductStock(product), false), /52833/);
  });

  it('without totalStock falls back to active variation + orphan', () => {
    assert.equal(
      getTotalProductStock({
        hasVariations: true,
        stock: 2,
        variations: [{ stock: 3 }, { stock: 5 }],
      }),
      10
    );
  });
});
