import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BILL_REF_NOTE_PREFIX,
  buildCustomerSalePaymentAutoNotes,
  composeSalePaymentNotes,
  mergeCustomerBillRefIntoNotes,
  stripCustomerBillRefLine,
} from './saleNotesComposition';

test('mergeCustomerBillRefIntoNotes adds Bill/REF line', () => {
  assert.equal(mergeCustomerBillRefIntoNotes('N226', ''), `${BILL_REF_NOTE_PREFIX} N226`);
});

test('mergeCustomerBillRefIntoNotes preserves user text', () => {
  assert.equal(
    mergeCustomerBillRefIntoNotes('N226', 'Rush order'),
    `${BILL_REF_NOTE_PREFIX} N226\nRush order`,
  );
});

test('mergeCustomerBillRefIntoNotes replaces prior Bill/REF line', () => {
  const merged = mergeCustomerBillRefIntoNotes('N227', `${BILL_REF_NOTE_PREFIX} N226\nKeep me`);
  assert.equal(merged, `${BILL_REF_NOTE_PREFIX} N227\nKeep me`);
});

test('mergeCustomerBillRefIntoNotes clears Bill/REF when ref empty', () => {
  assert.equal(
    mergeCustomerBillRefIntoNotes('', `${BILL_REF_NOTE_PREFIX} N226\nOther`),
    'Other',
  );
});

test('stripCustomerBillRefLine removes managed prefix only', () => {
  assert.equal(stripCustomerBillRefLine(`${BILL_REF_NOTE_PREFIX} N226\nNotes`), 'Notes');
});

test('buildCustomerSalePaymentAutoNotes includes bill ref and account name', () => {
  const auto = buildCustomerSalePaymentAutoNotes({
    partyName: 'Ali',
    invoiceRef: 'SL-001',
    customerBillRef: 'N226',
    paymentAccountName: 'FHD MZ',
  });
  assert.match(auto, /Customer receipt from Ali/);
  assert.match(auto, /Invoice: SL-001/);
  assert.match(auto, /Bill\/REF: N226/);
  assert.match(auto, /Account: FHD MZ/);
  assert.doesNotMatch(auto, /Amount:/);
  assert.doesNotMatch(auto, /Method:/);
});

test('buildCustomerSalePaymentAutoNotes falls back to method when no account name', () => {
  const auto = buildCustomerSalePaymentAutoNotes({
    partyName: 'Ali',
    paymentMethod: 'Cash',
  });
  assert.match(auto, /Method: Cash/);
  assert.doesNotMatch(auto, /Account:/);
});

test('composeSalePaymentNotes appends bank trace', () => {
  assert.equal(
    composeSalePaymentNotes({
      autoNotes: 'Auto line',
      userNotes: 'Extra',
      bankTraceId: 'CHQ-99',
    }),
    'Auto line\n\nExtra | Bank Trace ID: CHQ-99',
  );
});
