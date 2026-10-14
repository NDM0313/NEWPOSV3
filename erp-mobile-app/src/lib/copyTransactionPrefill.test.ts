import test from 'node:test';
import assert from 'node:assert/strict';
import type { TransactionRow } from '../api/transactions';
import {
  canCopyAccountingTransaction,
  canCopyAccountEntry,
  canCopyTransactionRow,
  resolveCopyPrefillFromAccountEntry,
  resolveCopyPrefillFromTransactionRow,
  resolveJournalLineAccountPair,
} from './copyTransactionPrefill';

function baseTx(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 'pay-1',
    paymentId: 'pay-1',
    createdAt: '2026-05-02T12:00:00Z',
    paymentDate: '2026-05-02',
    direction: 'received',
    referenceType: 'manual_receipt',
    referenceId: 'je-1',
    referenceNumber: 'JE-0011',
    amount: 1_000_000,
    method: 'bank',
    paymentAccountId: 'acc-in',
    paymentAccountName: 'WALI T/T',
    partyAccountId: 'acc-out',
    partyAccountName: 'FHD MZ',
    partyId: null,
    partyName: null,
    branchId: null,
    branchName: null,
    notes: null,
    journalEntryId: 'je-1',
    entryNo: 'JE-0011',
    createdBy: null,
    attachments: null,
    ...overrides,
  };
}

test('canCopyAccountingTransaction allows general journal and manual payments', () => {
  assert.equal(canCopyAccountingTransaction({ referenceType: 'general' }), true);
  assert.equal(canCopyAccountingTransaction({ referenceType: 'journal' }), true);
  assert.equal(canCopyAccountingTransaction({ referenceType: 'manual_receipt' }), true);
  assert.equal(canCopyAccountingTransaction({ referenceType: 'manual_payment' }), true);
});

test('canCopyAccountingTransaction blocks sale purchase journal docs and returns', () => {
  assert.equal(canCopyAccountingTransaction({ referenceType: 'sale' }), false);
  assert.equal(canCopyAccountingTransaction({ referenceType: 'purchase' }), false);
  assert.equal(canCopyAccountingTransaction({ referenceType: 'sale_return' }), false);
  assert.equal(canCopyAccountingTransaction({ referenceType: 'purchase_return' }), false);
  assert.equal(canCopyAccountingTransaction({ referenceType: 'expense' }), false);
});

test('resolveJournalLineAccountPair picks largest debit and credit lines', () => {
  const pair = resolveJournalLineAccountPair([
    { account_id: 'dr', debit: 1000, credit: 0 },
    { account_id: 'cr', debit: 0, credit: 1000 },
  ]);
  assert.deepEqual(pair, { debitAccountId: 'dr', creditAccountId: 'cr' });
});

test('resolveCopyPrefillFromTransactionRow maps received manual payment accounts', () => {
  const prefill = resolveCopyPrefillFromTransactionRow(baseTx());
  assert.deepEqual(prefill, { debitAccountId: 'acc-in', creditAccountId: 'acc-out' });
});

test('resolveCopyPrefillFromTransactionRow maps paid manual payment accounts', () => {
  const prefill = resolveCopyPrefillFromTransactionRow(
    baseTx({ direction: 'paid', referenceType: 'manual_payment' }),
  );
  assert.deepEqual(prefill, { debitAccountId: 'acc-out', creditAccountId: 'acc-in' });
});

test('allows customer receipt with referenceType sale (RCV voucher)', () => {
  const tx = baseTx({
    referenceType: 'sale',
    referenceNumber: 'RCV-0213',
    partyName: 'MR JALIL',
  });
  assert.equal(canCopyTransactionRow(tx), true);
  assert.deepEqual(resolveCopyPrefillFromTransactionRow(tx), {
    debitAccountId: 'acc-in',
    creditAccountId: 'acc-out',
  });
});

test('allows supplier payment with referenceType purchase (PAY voucher)', () => {
  const tx = baseTx({
    direction: 'paid',
    referenceType: 'purchase',
    referenceNumber: 'PAY-0042',
    partyName: 'Supplier ABC',
  });
  assert.equal(canCopyTransactionRow(tx), true);
  assert.deepEqual(resolveCopyPrefillFromTransactionRow(tx), {
    debitAccountId: 'acc-out',
    creditAccountId: 'acc-in',
  });
});

test('still blocks sale journal timeline row', () => {
  const tx = baseTx({
    id: 'journal-sale-1',
    referenceType: 'sale',
    referenceNumber: 'INV-2042',
  });
  assert.equal(canCopyTransactionRow(tx), false);
});

test('resolveCopyPrefillFromAccountEntry requires account ids', () => {
  const prefill = resolveCopyPrefillFromAccountEntry({
    referenceType: 'general',
    sourceKind: 'journal_manual',
    debitAccountId: 'dr',
    creditAccountId: 'cr',
  });
  assert.deepEqual(prefill, { debitAccountId: 'dr', creditAccountId: 'cr' });
  assert.equal(
    canCopyAccountEntry({
      referenceType: 'general',
      sourceKind: 'expense',
      debitAccountId: 'dr',
      creditAccountId: 'cr',
    }),
    false,
  );
});

test('blocks sale RCV row when party account id is missing', () => {
  const tx = baseTx({
    referenceType: 'sale',
    referenceNumber: 'RCV-0213',
    partyName: 'MR JALIL',
    partyAccountId: null,
    counterpartyAccountId: null,
    liquidityAccountId: 'acc-in',
  });
  assert.equal(canCopyTransactionRow(tx), false);
  assert.equal(resolveCopyPrefillFromTransactionRow(tx), null);
});

test('allows sale RCV row via counterpartyAccountId fallback', () => {
  const tx = baseTx({
    referenceType: 'sale',
    referenceNumber: 'RCV-0213',
    partyName: 'MR JALIL',
    partyAccountId: null,
    counterpartyAccountId: 'acc-out',
    liquidityAccountId: 'acc-in',
  });
  assert.equal(canCopyTransactionRow(tx), true);
  assert.deepEqual(resolveCopyPrefillFromTransactionRow(tx), {
    debitAccountId: 'acc-in',
    creditAccountId: 'acc-out',
  });
});

test('allows dashboard payment_customer and payment_supplier entries', () => {
  assert.equal(
    canCopyAccountEntry({
      referenceType: 'payment',
      sourceKind: 'payment_customer',
      paymentType: 'received',
      debitAccountId: 'bank-1',
      creditAccountId: 'ar-1',
    }),
    true,
  );
  assert.equal(
    canCopyAccountEntry({
      referenceType: 'payment',
      sourceKind: 'payment_supplier',
      paymentType: 'paid',
      debitAccountId: 'ap-1',
      creditAccountId: 'bank-1',
    }),
    true,
  );
  assert.equal(
    canCopyAccountEntry({
      referenceType: 'sale',
      sourceKind: 'sale',
      debitAccountId: 'dr',
      creditAccountId: 'cr',
    }),
    false,
  );
});
