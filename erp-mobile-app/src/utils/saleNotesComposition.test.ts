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

test('composeSalePaymentNotes includeAuto false keeps add-on and trace only', () => {
  const out = composeSalePaymentNotes({
    autoNotes: 'Customer receipt from SHOP A8.',
    userNotes: 'From: NADEEM\nTo: SKAD',
    bankTraceId: '434570',
    includeAuto: false,
  });
  assert.equal(out, 'From: NADEEM\nTo: SKAD | Bank Trace ID: 434570');
  assert.doesNotMatch(out, /Customer receipt/);
});

test('composeSalePaymentNotes includeAuto false with empty add-on is trace only', () => {
  assert.equal(
    composeSalePaymentNotes({
      autoNotes: 'Customer receipt from X.',
      userNotes: '',
      bankTraceId: 'T9',
      includeAuto: false,
    }),
    'Bank Trace ID: T9',
  );
});
