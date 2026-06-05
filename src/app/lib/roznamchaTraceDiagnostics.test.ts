import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildRoznamchaTraceCandidates,
  explainRoznamchaInclusion,
  inferRoznamchaCandidateSource,
  roznamchaRowMatchesQuery,
  roznamchaSourcePriority,
} from './roznamchaTraceDiagnostics';

const base = {
  id: 'rp-abc',
  date: '2026-06-04',
  ref: 'HQ-RCV-0006',
  details: 'Rental remaining payment — Inayat',
  direction: 'IN' as const,
  amount: 10000,
  accountLabel: 'Cash',
  accountType: 'cash' as const,
  sourceRentalPaymentId: 'rp-abc',
  sourceJournalEntryId: 'je-12',
  journalEntryNo: 'JE-0012',
};

test('roznamchaRowMatchesQuery matches ref and journal subtitle', () => {
  assert.equal(roznamchaRowMatchesQuery(base, 'HQ-RCV-0006'), true);
  assert.equal(roznamchaRowMatchesQuery(base, 'JE-0012'), true);
  assert.equal(roznamchaRowMatchesQuery(base, 'RCV-9999'), false);
});

test('inferRoznamchaCandidateSource detects rental_payments', () => {
  assert.equal(inferRoznamchaCandidateSource(base), 'rental_payments');
  assert.equal(
    inferRoznamchaCandidateSource({ id: 'pay-1', sourcePaymentId: 'pay-1' }),
    'payments'
  );
  assert.equal(
    inferRoznamchaCandidateSource({ id: 'jel-1', sourceJournalEntryId: 'je-1' }),
    'journal'
  );
});

test('explainRoznamchaInclusion marks direct survivor as included', () => {
  const out = explainRoznamchaInclusion(base, [base]);
  assert.equal(out.included, true);
});

test('explainRoznamchaInclusion marks loser merged into payment stream', () => {
  const paymentWinner = {
    ...base,
    id: 'pay-6',
    ref: 'HQ-RCV-0006',
    sourcePaymentId: 'pay-6',
    sourceRentalPaymentId: null,
  };
  const journalLoser = {
    ...base,
    id: 'jel-99',
    sourcePaymentId: null,
    sourceJournalEntryId: 'je-12',
  };
  const post = [paymentWinner];
  const out = explainRoznamchaInclusion(journalLoser, post);
  assert.equal(out.included, false);
  assert.match(out.reason, /merged/i);
});

test('buildRoznamchaTraceCandidates filters by query', () => {
  const pre = [
    base,
    { ...base, id: 'rp-other', ref: 'HQ-RCV-0005', sourceRentalPaymentId: 'rp-other' },
  ];
  const views = buildRoznamchaTraceCandidates(pre, pre, 'HQ-RCV-0006');
  assert.equal(views.length, 1);
  assert.equal(views[0].ref, 'HQ-RCV-0006');
  assert.equal(views[0].sourcePriority, roznamchaSourcePriority(base));
});
