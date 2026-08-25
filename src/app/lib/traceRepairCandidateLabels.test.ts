import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTraceRepairCandidateLabel } from './traceRepairCandidateLabels';
import type { TraceRepairCandidate } from './transactionTraceRepairDiagnostics';

test('buildTraceRepairCandidateLabel maps payment relink candidate', () => {
  const candidate: TraceRepairCandidate = {
    canQueue: true,
    reason: 'Orphan payment matches JE',
    targetTable: 'payments',
    targetId: 'pay-1',
    queueItem: {
      actionId: 'payment.relink_payment_to_journal',
      sourceTab: 'payment',
      params: { paymentId: 'pay-1', journalEntryId: 'je-1' },
      detectedReason: 'Orphan payment matches JE',
      severity: 'medium',
      title: 'Relink payment to journal entry',
    },
  };
  const label = buildTraceRepairCandidateLabel(candidate);
  assert.ok(label);
  assert.equal(label!.actionId, 'payment.relink_payment_to_journal');
  assert.equal(label!.riskLevel, 'medium');
  assert.equal(label!.targetTable, 'payments');
  assert.equal(label!.targetId, 'pay-1');
  assert.ok(label!.whatWillChange.some((c) => c.includes('payment_id')));
  assert.ok(label!.whatWillNeverChange.some((c) => c.includes('JE lines')));
});

test('buildTraceRepairCandidateLabel maps branch sync from params', () => {
  const candidate: TraceRepairCandidate = {
    canQueue: true,
    reason: 'Payment branch null',
    targetTable: 'payments',
    targetId: 'pay-2',
    queueItem: {
      actionId: 'payment.sync_branch_from_document',
      sourceTab: 'trace',
      params: { targetTable: 'payments', rowId: 'pay-2' },
      detectedReason: 'Payment branch null',
      severity: 'medium',
    },
  };
  const label = buildTraceRepairCandidateLabel(candidate);
  assert.ok(label);
  assert.equal(label!.targetTable, 'payments');
  assert.equal(label!.targetId, 'pay-2');
});

test('buildTraceRepairCandidateLabel maps rental relink', () => {
  const candidate: TraceRepairCandidate = {
    canQueue: true,
    reason: 'Rental payment missing journal_entry_id',
    targetTable: 'rental_payments',
    targetId: 'rp-1',
    queueItem: {
      actionId: 'rental.relink_rental_payment_to_journal',
      sourceTab: 'trace',
      params: { rentalPaymentId: 'rp-1', journalEntryId: 'je-9' },
      detectedReason: 'Rental payment missing journal_entry_id',
      severity: 'medium',
    },
  };
  const label = buildTraceRepairCandidateLabel(candidate);
  assert.ok(label);
  assert.equal(label!.actionId, 'rental.relink_rental_payment_to_journal');
  assert.equal(label!.targetTable, 'rental_payments');
});

test('buildTraceRepairCandidateLabel returns null for non-queueable', () => {
  assert.equal(
    buildTraceRepairCandidateLabel({ canQueue: false, reason: 'No repair' }),
    null
  );
});
