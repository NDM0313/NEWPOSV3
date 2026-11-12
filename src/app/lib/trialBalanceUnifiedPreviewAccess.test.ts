import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessTrialBalanceUnifiedPreview } from './trialBalanceUnifiedPreviewAccess';

test('developer role can access trial balance unified preview', () => {
  assert.equal(canAccessTrialBalanceUnifiedPreview('developer'), true);
});

test('admin role can access trial balance unified preview', () => {
  assert.equal(canAccessTrialBalanceUnifiedPreview('admin'), true);
});

test('staff role cannot access trial balance unified preview', () => {
  assert.equal(canAccessTrialBalanceUnifiedPreview('staff'), false);
});
