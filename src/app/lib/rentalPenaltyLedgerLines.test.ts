import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendRentalPaymentMergeItems,
  buildRentalPenaltyMergeItems,
  isRentalPenaltyPayment,
  penaltyFullyRepresentedInLedger,
} from './rentalPenaltyLedgerLines.ts';

describe('rentalPenaltyLedgerLines', () => {
  it('detects penalty payment_type', () => {
    assert.equal(isRentalPenaltyPayment({ payment_type: 'penalty' }), true);
    assert.equal(isRentalPenaltyPayment({ reference: 'Damage/penalty' }), true);
    assert.equal(isRentalPenaltyPayment({ payment_type: 'remaining' }), false);
  });

  it('builds debit charge then credit receipt', () => {
    const rows = buildRentalPenaltyMergeItems({
      payment: {
        rental_id: 'rent-1',
        amount: 3500,
        payment_date: '2026-06-08',
        reference: 'Return penalty',
        payment_type: 'penalty',
        method: 'cash',
      },
      rental: { id: 'rent-1', booking_no: 'REN-0001', damage_charges: 3500 },
      customerDisplayName: 'Ali Khan',
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].debit, 3500);
    assert.equal(rows[0].credit, 0);
    assert.match(rows[0].description, /penalty charge/i);
    assert.equal(rows[1].debit, 0);
    assert.equal(rows[1].credit, 3500);
  });

  it('penaltyFullyRepresentedInLedger requires both sides', () => {
    const ledger = [
      { rental_id: 'r1', debit: 3500, credit: 0, description: 'Rental penalty charge' },
      { rental_id: 'r1', debit: 0, credit: 3500, description: 'Rental penalty receipt' },
    ];
    assert.equal(penaltyFullyRepresentedInLedger(ledger, 'r1', 3500), true);
    assert.equal(penaltyFullyRepresentedInLedger([ledger[1]], 'r1', 3500), false);
  });

  it('appendRentalPaymentMergeItems adds charge+credit for penalty without GL', () => {
    const items: Parameters<typeof appendRentalPaymentMergeItems>[0] = [];
    appendRentalPaymentMergeItems(items, {
      payment: {
        rental_id: 'rent-2',
        amount: 5000,
        payment_date: '2026-06-09',
        payment_type: 'penalty',
        reference: 'Damage',
      },
      rental: { booking_no: 'REN-0002', damage_charges: 5000 },
      customerDisplayName: 'Sara',
      ledgerRows: [],
    });
    assert.equal(items.length, 2);
    assert.equal(items[0].debit, 5000);
    assert.equal(items[1].credit, 5000);
  });
});
