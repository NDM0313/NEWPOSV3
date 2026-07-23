import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildExcludedRentalPaymentCandidate,
  mergeStatementCandidates,
  statementRowMatchesQuery,
  mapStatementTransactionToCandidate,
} from './statementTraceDiagnostics';

test('statementRowMatchesQuery matches reference and notes', () => {
  assert.equal(
    statementRowMatchesQuery(
      { referenceNo: 'HQ-RCV-0006', description: 'Receipt', notes: '', documentType: 'Payment' },
      'HQ-RCV'
    ),
    true
  );
  assert.equal(
    statementRowMatchesQuery(
      { referenceNo: 'SL-0001', description: 'Sale', notes: '', documentType: 'Sale' },
      'HQ-RCV'
    ),
    false
  );
});

test('mapStatementTransactionToCandidate marks included statement row', () => {
  const c = mapStatementTransactionToCandidate(
    {
      id: 'p1',
      date: '2026-06-04',
      referenceNo: 'HQ-RCV-0006',
      documentType: 'Payment',
      description: 'Rental receipt',
      paymentAccount: 'cash',
      notes: '',
      debit: 0,
      credit: 10000,
      runningBalance: 0,
    },
    'contact-1',
    'Inayat'
  );
  assert.equal(c.included, true);
  assert.equal(c.ref, 'HQ-RCV-0006');
});

test('buildExcludedRentalPaymentCandidate explains journal skip', () => {
  const c = buildExcludedRentalPaymentCandidate({
    id: 'rp1',
    ref: 'HQ-RCV-0006',
    date: '2026-06-04',
    amount: 10000,
    contactId: 'c1',
    contactName: 'Test',
    journalEntryId: 'je-1',
    inDateRange: true,
  });
  assert.equal(c.included, false);
  assert.match(c.reason, /journal_entry_id/i);
});

test('mergeStatementCandidates dedupes overlapping keys', () => {
  const merged = mergeStatementCandidates(
    [
      {
        rowId: 'a',
        source: 'statement_row',
        ref: 'HQ-RCV-0006',
        date: '2026-06-04',
        documentType: 'Payment',
        debit: 0,
        credit: 10000,
        included: true,
        reason: 'included',
      },
    ],
    [
      {
        rowId: 'b',
        source: 'excluded_probe',
        ref: 'HQ-RCV-0006',
        date: '2026-06-04',
        documentType: 'Rental Payment (probe)',
        debit: 0,
        credit: 10000,
        included: false,
        reason: 'excluded',
      },
    ]
  );
  assert.equal(merged.length, 1);
});
