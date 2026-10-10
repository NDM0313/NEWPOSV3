import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessCashFlowUnifiedPreview } from './cashFlowUnifiedPreviewAccess';

test('developer role can access Cash Flow unified preview', () => {
  assert.equal(canAccessCashFlowUnifiedPreview('developer'), true);
});

test('admin role can access Cash Flow unified preview', () => {
  assert.equal(canAccessCashFlowUnifiedPreview('admin'), true);
});

test('staff role cannot access Cash Flow unified preview', () => {
  assert.equal(canAccessCashFlowUnifiedPreview('staff'), false);
  assert.equal(canAccessCashFlowUnifiedPreview('cashier'), false);
});
