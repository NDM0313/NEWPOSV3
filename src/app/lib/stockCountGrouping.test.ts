import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  branchDifference,
  demonstrateCrossBranchSwap,
  groupLinesByProductVariation,
  sumConfirmedPhysical,
  sumSystemQty,
} from './stockCountGrouping';

describe('stockCountGrouping — all branches', () => {
  it('sums expected stock across branches including zeros', () => {
    assert.equal(
      sumSystemQty([
        { system_qty_baseline: 2 },
        { system_qty_baseline: 3 },
        { system_qty_baseline: 0 },
      ]),
      5
    );
  });

  it('keeps branch diffs when company total variance is zero', () => {
    const demo = demonstrateCrossBranchSwap();
    assert.equal(demo.systemTotal, 5);
    assert.equal(demo.physicalTotal, 5);
    assert.deepEqual(demo.branchDiffs, [1, -1]);
  });

  it('does not treat uncounted branches as zero in total physical', () => {
    const r = sumConfirmedPhysical([
      { physical_qty: 3, count_status: 'counted_qty' },
      { physical_qty: null, count_status: 'uncounted' },
    ]);
    assert.equal(r.total, 3);
    assert.equal(r.partial, true);
    assert.equal(r.uncountedCount, 1);
    assert.equal(branchDifference(null, 2), null);
    assert.equal(branchDifference(0, 2), -2);
  });

  it('groups per product/variation and preserves branch lines', () => {
    const groups = groupLinesByProductVariation([
      {
        product_id: 'p1',
        variation_id: 'v1',
        system_qty_baseline: 2,
        physical_qty: 3,
        count_status: 'counted_qty',
        branch_id: 'A',
      },
      {
        product_id: 'p1',
        variation_id: 'v1',
        system_qty_baseline: 3,
        physical_qty: 2,
        count_status: 'counted_qty',
        branch_id: 'B',
      },
      {
        product_id: 'p2',
        variation_id: null,
        system_qty_baseline: 0,
        physical_qty: null,
        count_status: 'uncounted',
        branch_id: 'A',
      },
    ]);
    assert.equal(groups.length, 2);
    const g1 = groups.find((g) => g.variation_id === 'v1')!;
    assert.equal(g1.systemTotal, 5);
    assert.equal(g1.physical.total, 5);
    assert.equal(g1.lines.length, 2);
  });
});
