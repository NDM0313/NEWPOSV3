import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  categorizeStockMovement,
  formatVariationAttributesLabel,
  itemKindLabel,
  pickProductImageRef,
  resolveItemKind,
  sumHistoryByCategory,
  withRunningBalance,
} from './stockCountDisplay';
import {
  applyIncrement,
  classifyCountStatus,
  computeDifference,
  startFormalRecount,
} from './stockCountMath';

describe('stockCountDisplay — variation identity', () => {
  it('labels product vs variation and formats attributes', () => {
    assert.equal(resolveItemKind(false), 'product');
    assert.equal(resolveItemKind(true), 'variation');
    assert.equal(itemKindLabel('product'), 'Product');
    assert.equal(itemKindLabel('variation'), 'Variation');
    assert.equal(
      formatVariationAttributesLabel({ SIZE: 'M', COLOR: 'Green' }),
      'SIZE: M · COLOR: Green'
    );
    assert.equal(formatVariationAttributesLabel({}), '');
    assert.equal(formatVariationAttributesLabel(null), '');
  });

  it('does not invent attributes when incomplete', () => {
    assert.equal(formatVariationAttributesLabel({ SIZE: 'M', COLOR: '' }), 'SIZE: M');
  });
});

describe('stockCountDisplay — history categories', () => {
  it('splits movement types by convention and sign', () => {
    assert.equal(
      categorizeStockMovement({ movement_type: 'adjustment', reference_type: 'opening_balance' }),
      'opening'
    );
    assert.equal(categorizeStockMovement({ movement_type: 'purchase', quantity: 5 }), 'purchase');
    assert.equal(
      categorizeStockMovement({ movement_type: 'purchase_return', quantity: -1 }),
      'purchase_return'
    );
    assert.equal(categorizeStockMovement({ movement_type: 'sale', quantity: -2 }), 'sale');
    assert.equal(
      categorizeStockMovement({ movement_type: 'sale_return', quantity: 1 }),
      'sale_return'
    );
    assert.equal(
      categorizeStockMovement({ movement_type: 'transfer', quantity: 3 }),
      'transfer_in'
    );
    assert.equal(
      categorizeStockMovement({ movement_type: 'transfer', quantity: -3 }),
      'transfer_out'
    );
    assert.equal(
      categorizeStockMovement({ movement_type: 'adjustment', reference_type: 'stock_count' }),
      'adjustment'
    );
    assert.equal(categorizeStockMovement({ movement_type: 'rental_out', quantity: -2 }), 'rental_out');
    assert.equal(categorizeStockMovement({ movement_type: 'rental_in', quantity: 2 }), 'rental_in');
    assert.equal(categorizeStockMovement({ movement_type: 'weird_xyz', quantity: 1 }), 'other');
  });

  it('totals by category with signed quantities', () => {
    const totals = sumHistoryByCategory([
      { movement_type: 'purchase', quantity: 10 },
      { movement_type: 'sale', quantity: -3 },
      { movement_type: 'sale', quantity: -1 },
      { movement_type: 'adjustment', reference_type: 'stock_count', quantity: -1 },
    ]);
    assert.equal(totals.purchase, 10);
    assert.equal(totals.sale, -4);
    assert.equal(totals.adjustment, -1);
  });

  it('computes running balance chronologically', () => {
    const withBal = withRunningBalance([
      { created_at: '2026-01-03T00:00:00Z', quantity: -1 },
      { created_at: '2026-01-01T00:00:00Z', quantity: 5 },
      { created_at: '2026-01-02T00:00:00Z', quantity: 2 },
    ]);
    assert.deepEqual(
      withBal.map((r) => r.running_balance),
      [5, 7, 6]
    );
  });
});

describe('stockCountDisplay — image ref for ProductImage', () => {
  it('picks first image_urls entry without inventing a URL', () => {
    assert.equal(
      pickProductImageRef(['product-images/co/p/a.jpg', 'product-images/co/p/b.jpg']),
      'product-images/co/p/a.jpg'
    );
    assert.equal(pickProductImageRef([]), undefined);
    assert.equal(pickProductImageRef(null, null), undefined);
    assert.equal(pickProductImageRef(null, 'fallback.jpg'), 'fallback.jpg');
  });

  it('missing image ref is undefined so UI can show placeholder (not blank square)', () => {
    assert.equal(pickProductImageRef(undefined), undefined);
    assert.equal(pickProductImageRef(['', '  ']), undefined);
  });
});

describe('stockCountDisplay — sales vs rentals vs purchase returns', () => {
  it('keeps sale, sale_return, rental_out, rental_in, purchase_return distinct', () => {
    const totals = sumHistoryByCategory([
      { movement_type: 'sale', quantity: -4 },
      { movement_type: 'sale_return', quantity: 1 },
      { movement_type: 'rental_out', quantity: -2 },
      { movement_type: 'rental_in', quantity: 1 },
      { movement_type: 'purchase_return', quantity: -3 },
    ]);
    assert.equal(totals.sale, -4);
    assert.equal(totals.sale_return, 1);
    assert.equal(totals.rental_out, -2);
    assert.equal(totals.rental_in, 1);
    assert.equal(totals.purchase_return, -3);
    assert.equal(totals.other, 0);
  });
});

describe('stockCountMath — preserved counting rules with history isolation', () => {
  it('System 2 → +1 → 1 / -1; another +1 → 2 / 0; recount replaces', () => {
    const a = applyIncrement(null, 1);
    assert.equal(a, 1);
    assert.equal(computeDifference(a, 2), -1);
    assert.equal(classifyCountStatus(a), 'counted_qty');
    const b = applyIncrement(a, 1);
    assert.equal(b, 2);
    assert.equal(computeDifference(b, 2), 0);
    const recount = startFormalRecount(b);
    assert.equal(recount.physicalQty, null);
    assert.equal(applyIncrement(recount.physicalQty, 1), 1);
  });

  it('history viewing does not change count math intermediates', () => {
    const physical = applyIncrement(applyIncrement(null), 1);
    const before = computeDifference(physical, 2);
    sumHistoryByCategory([{ movement_type: 'sale', quantity: -99 }]);
    assert.equal(computeDifference(physical, 2), before);
  });
});
