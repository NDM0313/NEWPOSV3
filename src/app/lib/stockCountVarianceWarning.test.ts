import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  stockCountVarianceWarning,
  summarizeVarianceWarnings,
} from './stockCountVarianceWarning';

describe('stockCountVarianceWarning', () => {
  it('flags overage when physical exceeds as-of baseline', () => {
    const w = stockCountVarianceWarning(5, 3);
    assert.equal(w.kind, 'over');
    assert.equal(w.variance, 2);
    assert.match(w.badgeLabel || '', /Over \+2/);
    assert.equal(w.diffTone, 'over');
  });

  it('flags shortage when physical is below baseline', () => {
    const w = stockCountVarianceWarning(1, 3);
    assert.equal(w.kind, 'short');
    assert.equal(w.variance, -2);
    assert.match(w.badgeLabel || '', /Short/);
    assert.equal(w.diffTone, 'short');
  });

  it('is ok when uncounted or zero variance', () => {
    assert.equal(stockCountVarianceWarning(null, 3).kind, 'ok');
    assert.equal(stockCountVarianceWarning(3, 3).kind, 'ok');
  });

  it('summarizes over/short across counted lines', () => {
    const s = summarizeVarianceWarnings([
      { physical_qty: 5, system_qty_baseline: 3, count_status: 'counted_qty' },
      { physical_qty: 1, system_qty_baseline: 4, count_status: 'counted_qty' },
      { physical_qty: null, system_qty_baseline: 2, count_status: 'uncounted' },
    ]);
    assert.equal(s.over, 1);
    assert.equal(s.short, 1);
  });
});
