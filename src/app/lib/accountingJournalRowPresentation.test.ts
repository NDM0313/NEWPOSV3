import '../test/domEventPolyfill.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { journalRowPresentation } from './accountingJournalRowPresentation.ts';
import type { AccountingEntry } from '../context/AccountingContext.tsx';

function paymentEntry(referenceType: string, paymentId?: string): AccountingEntry {
  return {
    id: 'je-1',
    date: '2026-07-09',
    description: 'Receipt',
    amount: 50_000,
    module: 'Payments',
    source: 'Payment',
    metadata: {
      referenceType,
      paymentId,
    },
  } as AccountingEntry;
}

test('journalRowPresentation labels on_account received payment as Customer receipt', () => {
  const pres = journalRowPresentation(paymentEntry('on_account', 'pay-123'));
  assert.equal(pres.typeLabel, 'Customer receipt');
});

test('journalRowPresentation keeps manual_receipt as Customer receipt', () => {
  const pres = journalRowPresentation(paymentEntry('manual_receipt', 'pay-456'));
  assert.equal(pres.typeLabel, 'Customer receipt');
});

test('journalRowPresentation generic payment without on_account stays Payment', () => {
  const pres = journalRowPresentation(paymentEntry('payment', 'pay-789'));
  assert.equal(pres.typeLabel, 'Payment');
});
