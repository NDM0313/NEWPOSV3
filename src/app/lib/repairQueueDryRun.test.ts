import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildNumberingDryRunPreviews,
  expensePaymentCandidateToDryRunPreview,
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
  assert.equal(rows[0].documentType, 'PAYMENT');
});

test('buildNumberingDryRunPreviews preserves documentType when not double-wrapped', () => {
  const first = buildNumberingDryRunPreviews([
    {
      document_type: 'PRODUCT',
      label: 'Product',
      sequence_last: 28,
      database_max: 30,
      effective_max: 30,
      status: 'out_of_sync',
    },
  ]);
  assert.equal(first[0].documentType, 'PRODUCT');
});

test('isValidRepairConfirmPhrase requires exact match', () => {
  assert.equal(isValidRepairConfirmPhrase(SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE, SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE), true);
  assert.equal(isValidRepairConfirmPhrase('wrong', SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE), false);
});

test('expensePaymentCandidateToDryRunPreview marks repairable rows safe', () => {
  const preview = expensePaymentCandidateToDryRunPreview({
    expenseNo: 'EXP-0021',
    expenseAmount: 7000,
    paymentRef: 'PAY-123',
    paymentAmount: 13500,
    jeLiquidityAmount: 7000,
    canApplyRepair: true,
    proposedAfterAmount: 7000,
  });
  assert.equal(preview.safeToApply, true);
  assert.match(preview.afterSummary, /7,000/);
});

test('expensePaymentCandidateToDryRunPreview blocks when JE differs', () => {
  const preview = expensePaymentCandidateToDryRunPreview({
    expenseNo: 'EXP-0099',
    expenseAmount: 7000,
    paymentRef: 'PAY-999',
    paymentAmount: 13500,
    jeLiquidityAmount: 13500,
    canApplyRepair: false,
    blockReason: 'JE liquidity amount differs from expense',
    proposedAfterAmount: 7000,
  });
  assert.equal(preview.safeToApply, false);
  assert.match(preview.afterSummary, /JE liquidity/i);
});
