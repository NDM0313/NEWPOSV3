import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPartyLedgerPreviewRpcScope,
  defaultUnifiedBasisForPartyLedger,
  normalizePartyLedgerPreviewBranch,
  partyLedgerPreviewBranchScope,
} from './partyLedgerUnifiedPreviewScope';

test('normalizePartyLedgerPreviewBranch maps all to null', () => {
  assert.equal(normalizePartyLedgerPreviewBranch(null), null);
  assert.equal(normalizePartyLedgerPreviewBranch('all'), null);
});

test('partyLedgerPreviewBranchScope is null', () => {
  assert.equal(partyLedgerPreviewBranchScope(), null);
});

test('defaultUnifiedBasisForPartyLedger maps mode to basis', () => {
  assert.equal(defaultUnifiedBasisForPartyLedger('effective', false), 'effective_party');
  assert.equal(defaultUnifiedBasisForPartyLedger('audit', false), 'audit_full_history');
  assert.equal(defaultUnifiedBasisForPartyLedger('effective', true), 'audit_full_history');
});

test('buildPartyLedgerPreviewRpcScope passes contact and dates', () => {
  const scope = buildPartyLedgerPreviewRpcScope({
    contactId: 'c-1',
    partyType: 'customer',
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
    mode: 'effective',
    showReversals: false,
  });
  assert.equal(scope.contactId, 'c-1');
  assert.equal(scope.partyType, 'customer');
  assert.equal(scope.dateFrom, '2026-01-01');
  assert.equal(scope.branchId, null);
  assert.equal(scope.basis, 'effective_party');
});
