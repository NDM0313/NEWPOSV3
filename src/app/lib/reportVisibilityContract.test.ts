import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayBookIncludeInNormalMode,
  isCorrectionReversalReferenceType,
  shouldIncludeCancelledSaleActivityInNormalStatement,
  shouldIncludeInNormalCashMovement,
} from './reportVisibilityContract';

test('JE-0168 class correction_reversal excluded from normal cash movement', () => {
  assert.equal(isCorrectionReversalReferenceType('correction_reversal'), true);
  assert.equal(
    shouldIncludeInNormalCashMovement({ referenceType: 'correction_reversal', journalIsVoid: false }),
    false
  );
  assert.equal(dayBookIncludeInNormalMode('correction_reversal'), false);
});

test('cancelled sale activity hidden from normal party statement', () => {
  assert.equal(
    shouldIncludeCancelledSaleActivityInNormalStatement({
      jeReferenceType: 'sale',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  assert.equal(
    shouldIncludeCancelledSaleActivityInNormalStatement({
      jeReferenceType: 'sale_reversal',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  assert.equal(
    shouldIncludeCancelledSaleActivityInNormalStatement({
      jeReferenceType: 'sale',
      linkedSaleStatus: 'final',
    }),
    true
  );
});

test('active payment still included in normal cash movement', () => {
  assert.equal(
    shouldIncludeInNormalCashMovement({
      referenceType: 'payment',
      journalIsVoid: false,
      paymentVoidedAt: null,
    }),
    true
  );
});
