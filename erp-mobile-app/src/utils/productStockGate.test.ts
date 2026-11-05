import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatStockLabel, getTotalProductStock, isSaleBlockedByStock } from './productStockGate.ts';
import { sumProductStockFromKeyMap } from './productStockFetch.ts';

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
      hasVariations: true,
      stock: 0,
      variations: [{ stock: 0 }, { stock: 0 }],
      totalStock: 52833.57,
    };
    assert.equal(getTotalProductStock(product), 52833.57);
    assert.equal(isSaleBlockedByStock(getTotalProductStock(product), false), false);
    assert.match(formatStockLabel(getTotalProductStock(product), false), /52833/);
  });

  it('without totalStock falls back to active variation + orphan', () => {
    assert.equal(
      getTotalProductStock({
        hasVariations: true,
        stock: 2,
        variations: [{ stock: 3 }, { stock: 5 }],
      }),
      10,
    );
  });

  it('formatStockLabel shows Out of stock when zero and negative disallowed', () => {
    assert.equal(formatStockLabel(0, false), 'Out of stock');
    assert.equal(formatStockLabel(0, true), 'Stock: 0');
  });
});
