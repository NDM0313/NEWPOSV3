import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COUNT_TOUCH_TARGET_PX,
  countCardOmitsBaselineEssay,
  countRowPresentation,
  MOBILE_COUNT_WORKFLOW_ORDER,
} from './stockCountRowPresentation';

describe('stockCountRowPresentation', () => {
  it('shows Current Stock clearly and hides difference when uncounted', () => {
    const p = countRowPresentation({
      physicalQty: null,
      countStatus: 'uncounted',
      currentSystemQty: 8,
      systemQtyBaseline: 3,
      baselineDrifted: true,
    });
    assert.equal(p.currentStockLabel, 'Current Stock');
    assert.equal(p.showDifference, false);
    assert.equal(p.physicalDisplayIsBlank, true);
    assert.equal(p.isConfirmedZero, false);
    assert.equal(p.showStockChangedBadge, true);
    assert.equal(p.stockChangedBadgeLabel, 'Stock changed');
  });

  it('keeps confirmed zero distinct from blank and shows difference', () => {
    const p = countRowPresentation({
      physicalQty: 0,
      countStatus: 'counted_zero',
      currentSystemQty: 8,
      systemQtyBaseline: 3,
    });
    assert.equal(p.physicalDisplayIsBlank, false);
    assert.equal(p.isConfirmedZero, true);
    assert.equal(p.showDifference, true);
  });

  it('does not put long baseline essays on the count card', () => {
    assert.equal(countCardOmitsBaselineEssay(), true);
  });

  it('documents mobile workflow order and touch target size', () => {
    assert.deepEqual([...MOBILE_COUNT_WORKFLOW_ORDER], [
      'session_branch',
      'search',
      'progress_summary',
      'product_cards',
      'review_post',
    ]);
    assert.ok(COUNT_TOUCH_TARGET_PX >= 44);
  });
});
