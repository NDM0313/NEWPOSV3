import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  customerReceiptLedgerDescription,
  resolvePartyLedgerReference,
} from './partyLedgerReference.ts';

describe('party ledger reference', () => {
  it('uses RCV for rental receipt credit', () => {
    const ref = resolvePartyLedgerReference({
      lineKind: 'receipt_credit',
      rentalBookingNo: 'REN-0001',
      rentalPaymentRef: 'HQ-RCV-0006',
    });
    assert.equal(ref, 'HQ-RCV-0006');
  });

  it('uses REN for rental charge debit', () => {
    const ref = resolvePartyLedgerReference({
      lineKind: 'rental_debit',
      rentalBookingNo: 'REN-0002',
      entryNo: 'JE-0100',
    });
    assert.equal(ref, 'REN-0002');
  });

  it('labels non-final sale receipt as advance', () => {
    assert.equal(
      customerReceiptLedgerDescription({ saleStatus: 'order', base: 'Payment' }),
      'Advance receipt'
    );
    assert.equal(
      customerReceiptLedgerDescription({ saleStatus: 'final', base: 'Payment' }),
      'Payment'
    );
  });
});
