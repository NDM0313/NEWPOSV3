import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessBsPlUnifiedPreview } from './bsPlUnifiedPreviewAccess';

test('developer role can access BS/P&L unified preview', () => {
  assert.equal(canAccessBsPlUnifiedPreview('developer'), true);
});

test('admin role can access BS/P&L unified preview', () => {
  assert.equal(canAccessBsPlUnifiedPreview('admin'), true);
});

test('staff role cannot access BS/P&L unified preview', () => {
  assert.equal(canAccessBsPlUnifiedPreview('staff'), false);
  assert.equal(canAccessBsPlUnifiedPreview('cashier'), false);
});
