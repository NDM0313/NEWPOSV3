import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isRentalPaymentReferenceNumber,
  shouldExcludePaymentFromSaleHistory,
} from './salePaymentHistoryFilter';

test('isRentalPaymentReferenceNumber matches REN booking PAY refs', () => {
  assert.equal(isRentalPaymentReferenceNumber('REN-0002-PAY'), true);
  assert.equal(isRentalPaymentReferenceNumber('HQ-RCV-0006'), false);
});

test('shouldExcludePaymentFromSaleHistory excludes rental types and REN refs', () => {
  assert.equal(
    shouldExcludePaymentFromSaleHistory({
      reference_type: 'rental',
      reference_number: 'HQ-RCV-0006',
    }),
    true,
  );
  assert.equal(
    shouldExcludePaymentFromSaleHistory({
      reference_type: 'manual_receipt',
      reference_number: 'REN-0002-PAY',
    }),
    true,
  );
  assert.equal(
    shouldExcludePaymentFromSaleHistory({
      reference_type: 'sale',
      reference_number: 'HQ-RCV-0006',
    }),
    false,
  );
});
