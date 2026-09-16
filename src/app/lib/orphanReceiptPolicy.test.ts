import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOrphanReceiptJournalEntry,
  resolveOrphanReceiptDisplayStatus,
} from './orphanReceiptPolicy.ts';

test('isOrphanReceiptJournalEntry detects zero-line manual_receipt with payment', () => {
  assert.equal(
    isOrphanReceiptJournalEntry({
      reference_type: 'manual_receipt',
      payment_id: 'pay-1',
      journalLineCount: 0,
    }),
    true,
  );
  assert.equal(
    isOrphanReceiptJournalEntry({
      reference_type: 'manual_receipt',
      payment_id: 'pay-1',
      journalLineCount: 2,
    }),
    false,
  );
  assert.equal(
    isOrphanReceiptJournalEntry({
      reference_type: 'sale',
      payment_id: 'pay-1',
      journalLineCount: 0,
    }),
    false,
  );
});

test('resolveOrphanReceiptDisplayStatus maps void and orphan', () => {
  assert.equal(
    resolveOrphanReceiptDisplayStatus({
      reference_type: 'manual_receipt',
      payment_id: 'p',
      journalLineCount: 0,
    }),
    'orphan_posting_failed',
  );
  assert.equal(
    resolveOrphanReceiptDisplayStatus({
      reference_type: 'manual_receipt',
      payment_id: 'p',
      journalLineCount: 2,
    }),
    'posted',
  );
  assert.equal(
    resolveOrphanReceiptDisplayStatus({
      reference_type: 'manual_receipt',
      payment_id: 'p',
      is_void: true,
      journalLineCount: 0,
    }),
    'voided',
  );
});
