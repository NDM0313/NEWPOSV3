import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUnbalancedJeRepair } from './unbalancedJeRepairClassifier';

test('sale + final → REBUILD_SALE', () => {
  const r = classifyUnbalancedJeRepair({
    referenceType: 'sale',
    saleStatus: 'final',
    hasReferenceId: true,
  });
  assert.equal(r.strategy, 'REBUILD_SALE');
  assert.equal(r.canAutoFix, true);
});

test('sale_reversal + cancelled → REBUILD_SALE_REVERSAL', () => {
  const r = classifyUnbalancedJeRepair({
    referenceType: 'sale_reversal',
    saleStatus: 'cancelled',
    hasReferenceId: true,
  });
  assert.equal(r.strategy, 'REBUILD_SALE_REVERSAL');
  assert.equal(r.canAutoFix, true);
});

test('purchase → MANUAL_REVIEW', () => {
  const r = classifyUnbalancedJeRepair({
    referenceType: 'purchase',
    hasReferenceId: true,
  });
  assert.equal(r.strategy, 'MANUAL_REVIEW');
  assert.equal(r.canAutoFix, false);
});

test('payment-linked → MANUAL_REVIEW', () => {
  const r = classifyUnbalancedJeRepair({
    referenceType: 'sale',
    saleStatus: 'final',
    hasReferenceId: true,
    hasPaymentId: true,
  });
  assert.equal(r.canAutoFix, false);
});

test('sale_reversal on non-cancelled → MANUAL_REVIEW', () => {
  const r = classifyUnbalancedJeRepair({
    referenceType: 'sale_reversal',
    saleStatus: 'final',
    hasReferenceId: true,
  });
  assert.equal(r.strategy, 'MANUAL_REVIEW');
  assert.equal(r.canAutoFix, false);
});
