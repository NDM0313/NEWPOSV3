import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BILL_REF_NOTE_PREFIX,
  buildCustomerSalePaymentAutoNotes,
  composeSalePaymentNotes,
  mergeCustomerBillRefIntoNotes,
} from './saleNotesComposition';

test('mergeCustomerBillRefIntoNotes adds Bill/REF line', () => {
  assert.equal(mergeCustomerBillRefIntoNotes('N226', ''), `${BILL_REF_NOTE_PREFIX} N226`);
});

test('buildCustomerSalePaymentAutoNotes includes bill ref and account name', () => {
  const auto = buildCustomerSalePaymentAutoNotes({
    partyName: 'Ali',
    customerBillRef: 'N226',
    paymentAccountName: 'FHD MZ',
  });
  assert.match(auto, /Bill\/REF: N226/);
  assert.match(auto, /Account: FHD MZ/);
  assert.doesNotMatch(auto, /Amount:/);
  assert.doesNotMatch(auto, /Method:/);
});

test('composeSalePaymentNotes appends bank trace', () => {
  assert.equal(
    composeSalePaymentNotes({ autoNotes: 'Auto', bankTraceId: 'T1' }),
    'Auto | Bank Trace ID: T1',
  );
});
