import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isJe0168ClassReversal,
  unifiedLedgerBasisIncludesRow,
} from './unifiedLedgerBasisFilter';

test('effective_party hides correction_reversal (JE-0168 class)', () => {
  assert.equal(
    unifiedLedgerBasisIncludesRow('effective_party', {
      jeReferenceType: 'correction_reversal',
      journalIsVoid: false,
    }),
    false
  );
  assert.equal(isJe0168ClassReversal('correction_reversal'), true);
});

test('audit_full_history includes correction_reversal', () => {
  assert.equal(
    unifiedLedgerBasisIncludesRow('audit_full_history', {
      jeReferenceType: 'correction_reversal',
      journalIsVoid: false,
    }),
    true
  );
});

test('official_gl includes correction_reversal when not void', () => {
  assert.equal(
    unifiedLedgerBasisIncludesRow('official_gl', {
      jeReferenceType: 'correction_reversal',
      journalIsVoid: false,
    }),
    true
  );
});

test('effective_party hides voided payment trail', () => {
  assert.equal(
    unifiedLedgerBasisIncludesRow('effective_party', {
      jeReferenceType: 'payment',
      paymentVoidedAt: '2025-01-01T00:00:00Z',
    }),
    false
  );
});

test('effective_party includes normal sale row', () => {
  assert.equal(
    unifiedLedgerBasisIncludesRow('effective_party', {
      jeReferenceType: 'sale',
      linkedSaleStatus: 'finalized',
    }),
    true
  );
});

test('void journal excluded from all bases', () => {
  assert.equal(
    unifiedLedgerBasisIncludesRow('official_gl', {
      jeReferenceType: 'sale',
      journalIsVoid: true,
    }),
    false
  );
});

test('effective_party hides cancelled sale orphan gl_correction', () => {
  assert.equal(
    unifiedLedgerBasisIncludesRow('effective_party', {
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
});
