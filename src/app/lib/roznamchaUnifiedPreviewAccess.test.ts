import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessRoznamchaUnifiedPreview } from './roznamchaUnifiedPreviewAccess';

test('developer role can access roznamcha unified preview', () => {
  assert.equal(canAccessRoznamchaUnifiedPreview('developer'), true);
});

test('admin role can access roznamcha unified preview', () => {
  assert.equal(canAccessRoznamchaUnifiedPreview('admin'), true);
});

test('staff role cannot access roznamcha unified preview', () => {
  assert.equal(canAccessRoznamchaUnifiedPreview('staff'), false);
});
