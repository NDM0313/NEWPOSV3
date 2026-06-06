import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildNumberingDryRunPreviews,
  isValidRepairConfirmPhrase,
  SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE,
} from './repairQueueDryRun';

test('buildNumberingDryRunPreviews flags out_of_sync rows', () => {
  const rows = buildNumberingDryRunPreviews([
    {
      document_type: 'PAYMENT',
      label: 'Payment',
      sequence_last: 5,
      database_max: 8,
      effective_max: 8,
      status: 'out_of_sync',
    },
  ]);
  assert.match(rows[0].previewAction, /sync/i);
  assert.equal(rows[0].status, 'out_of_sync');
});

test('isValidRepairConfirmPhrase requires exact match', () => {
  assert.equal(isValidRepairConfirmPhrase(SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE, SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE), true);
  assert.equal(isValidRepairConfirmPhrase('wrong', SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE), false);
});
