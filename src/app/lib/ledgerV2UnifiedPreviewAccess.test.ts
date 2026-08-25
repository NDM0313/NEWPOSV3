import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessLedgerV2UnifiedPreview } from './ledgerV2UnifiedPreviewAccess';

test('developer role can access ledger v2 unified preview', () => {
  assert.equal(canAccessLedgerV2UnifiedPreview('developer'), true);
});

test('admin role can access ledger v2 unified preview', () => {
  assert.equal(canAccessLedgerV2UnifiedPreview('admin'), true);
});

test('staff role cannot access ledger v2 unified preview', () => {
  assert.equal(canAccessLedgerV2UnifiedPreview('staff'), false);
  assert.equal(canAccessLedgerV2UnifiedPreview('cashier'), false);
});
