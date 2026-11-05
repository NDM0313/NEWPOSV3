import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildGeneralEntrySeedFromJournalLines,
  buildTransferSeedFromJournalLines,
  duplicateViewForSourceKind,
} from './duplicateEntryRouting.ts';

test('duplicateViewForSourceKind routes by sourceKind not coarse type', () => {
  assert.equal(duplicateViewForSourceKind('payment_customer'), 'client-payment');
  assert.equal(duplicateViewForSourceKind('payment_supplier'), 'supplier-payment');
  assert.equal(duplicateViewForSourceKind('journal_manual'), 'general-entry');
  assert.equal(duplicateViewForSourceKind('general'), 'general-entry');
  assert.equal(duplicateViewForSourceKind('transfer'), 'account-transfer');
  assert.equal(duplicateViewForSourceKind('sale'), null);
});

test('buildGeneralEntrySeedFromJournalLines maps debit/credit lines', () => {
  const seed = buildGeneralEntrySeedFromJournalLines(
    [
      { account_id: 'a1', debit: 1000, credit: 0, account: { name: 'Cash' } },
      { account_id: 'a2', debit: 0, credit: 1000, account: { name: 'Revenue' } },
    ],
    { amount: 1000 },
  );
  assert.ok(seed);
  assert.equal(seed!.debitAccountId, 'a1');
  assert.equal(seed!.creditAccountId, 'a2');
  assert.equal(seed!.amount, 1000);
  assert.equal(seed!.startAtDetails, true);
});

test('buildTransferSeedFromJournalLines swaps credit→from debit→to', () => {
  const seed = buildTransferSeedFromJournalLines([
    { account_id: 'to', debit: 500, credit: 0, account: { name: 'Bank B' } },
    { account_id: 'from', debit: 0, credit: 500, account: { name: 'Bank A' } },
  ]);
  assert.ok(seed);
  assert.equal(seed!.fromAccountId, 'from');
  assert.equal(seed!.toAccountId, 'to');
});
