import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeStockMovements } from './stockLedgerSummary';

describe('stockLedgerSummary — rentals', () => {
  it('separates rent out, rental returns, and currently out', () => {
    const s = summarizeStockMovements([
      { movement_type: 'rental_out', quantity: -2 },
      { movement_type: 'rental_out', quantity: -1 },
      { movement_type: 'rental_in', quantity: 1 },
      { movement_type: 'sale', quantity: -5 },
      { movement_type: 'sale_return', quantity: 1 },
    ]);
    assert.equal(s.rentOutGross, 3);
    assert.equal(s.rentalReturnsGross, 1);
    assert.equal(s.currentlyOutOnRent, 2);
    assert.equal(s.totalSold, 5);
    assert.equal(s.totalSaleReturns, 1);
    assert.equal(s.totalRented, 3); // alias
  });

  it('does not treat rental_in as Other-equivalent missing return', () => {
    const s = summarizeStockMovements([{ movement_type: 'rental_in', quantity: 2 }]);
    assert.equal(s.rentalReturnsGross, 2);
    assert.equal(s.rentOutGross, 0);
    assert.equal(s.currentlyOutOnRent, 0);
  });

  it('keeps purchase returns distinct from sale returns', () => {
    const s = summarizeStockMovements([
      { movement_type: 'purchase_return', quantity: -3 },
      { movement_type: 'sale_return', quantity: 2 },
    ]);
    assert.equal(s.totalPurchaseReturns, 3);
    assert.equal(s.totalSaleReturns, 2);
  });

  it('period gross rent is not the same as currently out when filter omits returns', () => {
    const periodOnly = summarizeStockMovements([
      { movement_type: 'rental_out', quantity: -5 },
    ]);
    assert.equal(periodOnly.rentOutGross, 5);
    assert.equal(periodOnly.currentlyOutOnRent, 5);
    const fullHistory = summarizeStockMovements([
      { movement_type: 'rental_out', quantity: -5 },
      { movement_type: 'rental_in', quantity: 4 },
    ]);
    assert.equal(fullHistory.currentlyOutOnRent, 1);
    assert.notEqual(periodOnly.currentlyOutOnRent, fullHistory.currentlyOutOnRent);
  });
});
