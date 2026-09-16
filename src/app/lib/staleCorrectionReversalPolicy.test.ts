import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildStaleReversalVoidReason,
  correctionReversalReviewEligibility,
  isStaleCorrectionReversalVoidEligible,
  staleCorrectionReversalVoidBlockedReason,
  STALE_REVERSAL_VOID_LABEL,
} from './staleCorrectionReversalPolicy';

test('JE-0168-shaped stale reversal eligible when payment voided and source JE voided', () => {
  const row = {
    reference_type: 'correction_reversal',
    is_void: false,
    payment_id: 'pay-1',
    reference_id: 'src-je-1',
    action_fingerprint: null,
  };
  const ctx = {
    sourceJournalIsVoid: true,
    sourceJournalIsActive: false,
    paymentVoidedAt: '2026-06-02T08:02:43Z',
  };
  assert.equal(isStaleCorrectionReversalVoidEligible(row, ctx), true);
  assert.equal(staleCorrectionReversalVoidBlockedReason(row, ctx), null);
});

test('active correction_reversal blocked when source payment still live', () => {
  const row = {
    reference_type: 'correction_reversal',
    is_void: false,
    payment_id: 'pay-1',
  };
  const ctx = {
    sourceJournalIsVoid: false,
    sourceJournalIsActive: true,
    paymentVoidedAt: null,
  };
  assert.equal(isStaleCorrectionReversalVoidEligible(row, ctx), false);
  assert.match(staleCorrectionReversalVoidBlockedReason(row, ctx) || '', /still active/i);
});

test('developer repair fingerprint blocked', () => {
  const row = {
    reference_type: 'correction_reversal',
    is_void: false,
    action_fingerprint: 'developer_repair:gl_correction:rental-1100-leakage:abc',
  };
  const ctx = { sourceJournalIsVoid: true, paymentVoidedAt: '2026-06-01' };
  assert.equal(isStaleCorrectionReversalVoidEligible(row, ctx), false);
  assert.match(staleCorrectionReversalVoidBlockedReason(row, ctx) || '', /Developer repair/i);
});

test('already voided not eligible', () => {
  assert.equal(
    isStaleCorrectionReversalVoidEligible(
      { reference_type: 'correction_reversal', is_void: true },
      { sourceJournalIsVoid: true, paymentVoidedAt: '2026-06-01' }
    ),
    false
  );
});

test('void reason builder and label', () => {
  assert.equal(STALE_REVERSAL_VOID_LABEL, 'Remove from live GL');
  assert.match(buildStaleReversalVoidReason('JE-0168'), /stale_correction_reversal_cleanup:JE-0168/);
});

test('correctionReversalReviewEligibility marks stale reversal eligible', () => {
  const result = correctionReversalReviewEligibility(
    {
      reference_type: 'correction_reversal',
      is_void: false,
      payment_id: 'pay-1',
      reference_id: 'src-1',
    },
    {
      sourceJournalIsVoid: true,
      sourceJournalIsActive: false,
      paymentVoidedAt: '2026-06-02T08:02:43Z',
    }
  );
  assert.equal(result.status, 'eligible');
  assert.match(result.label, /Remove from live GL/i);
});

test('correctionReversalReviewEligibility marks live-source reversal blocked', () => {
  const result = correctionReversalReviewEligibility(
    {
      reference_type: 'correction_reversal',
      is_void: false,
      payment_id: 'pay-1',
    },
    {
      sourceJournalIsVoid: false,
      sourceJournalIsActive: true,
      paymentVoidedAt: null,
    }
  );
  assert.equal(result.status, 'blocked');
  assert.match(result.label, /still active/i);
});
