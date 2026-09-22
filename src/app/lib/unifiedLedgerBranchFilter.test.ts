import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unifiedLedgerBranchIncludesRow,
  isVerifiedNullBranchRow,
  isTransactionalReferenceType,
} from '@/app/lib/unifiedLedgerBranchFilter.ts';

test('branch filter includes all rows when no branch filter', () => {
  assert.equal(
    unifiedLedgerBranchIncludesRow(null, { branchId: null, referenceType: 'sale' }),
    true
  );
});

test('branch filter includes matching branch', () => {
  assert.equal(
    unifiedLedgerBranchIncludesRow('branch-a', { branchId: 'branch-a', referenceType: 'sale' }),
    true
  );
});

test('branch filter excludes NULL branch transactional sale', () => {
  assert.equal(
    unifiedLedgerBranchIncludesRow('branch-a', { branchId: null, referenceType: 'sale' }),
    false
  );
});

test('branch filter allows NULL branch opening_balance_contact_ar', () => {
  assert.equal(isVerifiedNullBranchRow('opening_balance_contact_ar'), true);
  assert.equal(
    unifiedLedgerBranchIncludesRow('branch-a', {
      branchId: null,
      referenceType: 'opening_balance_contact_ar',
    }),
    true
  );
});

test('branch filter allows NULL branch journal / gl_correction family (SQL 190000)', () => {
  for (const referenceType of [
    'journal',
    'manual_journal',
    'gl_correction',
    'correction_reversal',
    '',
  ]) {
    assert.equal(isVerifiedNullBranchRow(referenceType), true, referenceType);
    assert.equal(
      unifiedLedgerBranchIncludesRow('branch-a', { branchId: null, referenceType }),
      true,
      referenceType
    );
  }
});

test('branch filter still excludes NULL branch transfer and payment', () => {
  assert.equal(
    unifiedLedgerBranchIncludesRow('branch-a', { branchId: null, referenceType: 'transfer' }),
    false
  );
  assert.equal(
    unifiedLedgerBranchIncludesRow('branch-a', { branchId: null, referenceType: 'payment' }),
    false
  );
});

test('transactional reference types include payment and purchase', () => {
  assert.equal(isTransactionalReferenceType('payment'), true);
  assert.equal(isTransactionalReferenceType('purchase'), true);
  assert.equal(isTransactionalReferenceType('opening_balance'), false);
});
