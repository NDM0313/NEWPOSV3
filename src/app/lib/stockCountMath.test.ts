import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDecrement,
  applyDirectEntry,
  applyIncrement,
  classifyCountStatus,
  computeAdjustmentDelta,
  computeDifference,
  confirmZero,
  isZeroVariance,
  startFormalRecount,
} from './stockCountMath';

describe('stockCountMath', () => {
  it('System 2 + one +1 → count 1, difference -1', () => {
    const physical = applyIncrement(null, 1);
    assert.equal(physical, 1);
    assert.equal(computeDifference(physical, 2), -1);
    assert.equal(classifyCountStatus(physical), 'counted_qty');
  });

  it('another +1 → count 2, difference 0', () => {
    const physical = applyIncrement(1, 1);
    assert.equal(physical, 2);
    assert.equal(computeDifference(physical, 2), 0);
  });

  it('re-find accumulates: first 2 then +3 → 5 (not replace)', () => {
    const first = applyIncrement(null, 2);
    assert.equal(first, 2);
    const afterRefind = applyIncrement(first, 3);
    assert.equal(afterRefind, 5);
  });

  it('System 2 and physical count 4 → delta +2', () => {
    assert.equal(computeAdjustmentDelta(4, 2), 2);
    assert.equal(computeDifference(4, 2), 2);
  });

  it('zero or negative baseline reconciles correctly', () => {
    assert.equal(computeAdjustmentDelta(3, 0), 3);
    assert.equal(computeAdjustmentDelta(3, -2), 5);
    assert.equal(computeDifference(3, -1), 4);
  });

  it('uncounted is distinct from counted zero', () => {
    assert.equal(classifyCountStatus(null), 'uncounted');
    assert.equal(classifyCountStatus(undefined), 'uncounted');
    assert.equal(classifyCountStatus(confirmZero()), 'counted_zero');
    assert.equal(computeDifference(null, 5), null);
    assert.equal(computeDifference(0, 5), -5);
  });

  it('formal recount replaces previous pass rather than adding', () => {
    const afterPass1 = applyIncrement(applyIncrement(null), 1); // 2
    const recount = startFormalRecount(afterPass1);
    assert.equal(recount.physicalQty, null);
    assert.equal(recount.priorPhysical, 2);
    assert.equal(recount.nextPassNumber(1), 2);
    const pass2 = applyIncrement(recount.physicalQty, 1);
    assert.equal(pass2, 1); // not 2+1=3
  });

  it('-1 never goes below zero; uncounted stays uncounted', () => {
    assert.equal(applyDecrement(null), null);
    assert.equal(applyDecrement(0), 0);
    assert.equal(applyDecrement(1), 0);
  });

  it('direct entry and zero variance helpers', () => {
    assert.equal(applyDirectEntry(4.5), 4.5);
    assert.equal(isZeroVariance(0), true);
    assert.equal(isZeroVariance(0.00000001), true);
    assert.throws(() => applyDirectEntry(-1));
  });

  it('post-baseline movements stay intact under delta rule', () => {
    // Baseline 2; later sale -1 would make live stock 1; posting physical 2 still uses delta 0 from baseline.
    assert.equal(computeAdjustmentDelta(2, 2), 0);
    // Baseline 2; physical 1 → delta -1 even if live stock already moved.
    assert.equal(computeAdjustmentDelta(1, 2), -1);
  });
});
