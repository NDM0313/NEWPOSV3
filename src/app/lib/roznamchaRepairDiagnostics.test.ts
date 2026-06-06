import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectRoznamchaRepairCandidate } from './roznamchaRepairDiagnostics';

test('detectRoznamchaRepairCandidate queues fill payment account', () => {
  const res = detectRoznamchaRepairCandidate({
    rowId: 'pay-1',
    sourcePaymentId: 'p1',
    sourceJournalEntryId: 'je1',
    paymentAccountId: null,
  });
  assert.equal(res.canQueue, true);
  assert.equal(res.queueItem?.actionId, 'payment.fill_payment_account_from_je');
});

test('detectRoznamchaRepairCandidate report duplicate when excluded with winner', () => {
  const res = detectRoznamchaRepairCandidate({
    rowId: 'dup-1',
    excludedReason: 'Excluded — merged',
    winnerRef: 'RCV-001',
  });
  assert.equal(res.queueItem?.actionId, 'roznamcha.report_duplicate_source');
});
