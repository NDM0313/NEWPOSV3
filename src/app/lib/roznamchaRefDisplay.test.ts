import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isInternalPaymentBackfillRef } from './documentNumberSuffix';
import { resolveCanonicalRoznamchaRef } from './roznamchaRefDisplay';

test('isInternalPaymentBackfillRef detects PAY-BF and PAY-BACKFILL', () => {
  assert.equal(isInternalPaymentBackfillRef('PAY-BF-79260b60-1e09-4f25-8000-504fafc39e89'), true);
  assert.equal(isInternalPaymentBackfillRef('PAY-BACKFILL-abc'), true);
  assert.equal(isInternalPaymentBackfillRef('GE-BF-e1113741-8902-47fc-b19a-edcb27f14e71'), true);
  assert.equal(isInternalPaymentBackfillRef('PAY-0042'), false);
  assert.equal(isInternalPaymentBackfillRef('RCV-0010'), false);
});

test('resolveCanonicalRoznamchaRef skips PAY-BF when expense_no present', () => {
  const r = resolveCanonicalRoznamchaRef({
    referenceNumber: 'PAY-BF-79260b60-1e09-4f25-8000-504fafc39e89',
    expenseNo: 'EXP-0123',
    journalEntryNo: 'JE-0456',
  });
  assert.equal(r.ref, 'EXP-0123');
  assert.equal(r.journalEntryNo, 'JE-0456');
});

test('resolveCanonicalRoznamchaRef falls back to JE for PAY-BACKFILL', () => {
  const r = resolveCanonicalRoznamchaRef({
    referenceNumber: 'PAY-BACKFILL-e5464c62-7431-4e45-b65c-df125c02d172',
    journalEntryNo: 'JE-0789',
  });
  assert.equal(r.ref, 'JE-0789');
  assert.equal(r.journalEntryNo, null);
});

test('resolveCanonicalRoznamchaRef keeps normal PAY ref', () => {
  const r = resolveCanonicalRoznamchaRef({
    referenceNumber: 'PAY-0042',
    journalEntryNo: 'JE-0100',
  });
  assert.equal(r.ref, 'PAY-0042');
  assert.equal(r.journalEntryNo, 'JE-0100');
});
