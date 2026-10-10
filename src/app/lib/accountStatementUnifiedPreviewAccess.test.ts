import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessAccountStatementUnifiedPreview } from './accountStatementUnifiedPreviewAccess';

test('developer role can access account statement unified preview', () => {
  assert.equal(canAccessAccountStatementUnifiedPreview('developer'), true);
});

test('admin role can access account statement unified preview', () => {
  assert.equal(canAccessAccountStatementUnifiedPreview('admin'), true);
});

test('staff role cannot access account statement unified preview', () => {
  assert.equal(canAccessAccountStatementUnifiedPreview('staff'), false);
});
