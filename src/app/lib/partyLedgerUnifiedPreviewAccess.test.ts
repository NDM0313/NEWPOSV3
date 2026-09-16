import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessPartyLedgerUnifiedPreview } from './partyLedgerUnifiedPreviewAccess';

test('developer role can access party ledger unified preview', () => {
  assert.equal(canAccessPartyLedgerUnifiedPreview('developer'), true);
});

test('admin role can access party ledger unified preview', () => {
  assert.equal(canAccessPartyLedgerUnifiedPreview('admin'), true);
});

test('staff role cannot access party ledger unified preview', () => {
  assert.equal(canAccessPartyLedgerUnifiedPreview('staff'), false);
});
