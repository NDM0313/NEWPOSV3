/**
 * Documents list/detail Business GL parity expectations (pure).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeSupplierBusinessHistoryTotals,
  splitSupplierBusinessHistoryRows,
  supplierBusinessListBalance,
} from './supplierBusinessGl.ts';
import { resolveContactListBalance } from './contactBalancesRpc.ts';

describe('supplier list/detail parity', () => {
  it('ARIF all-time Business closing matches list businessNet', () => {
    const rows = [
      { date: '2024-06-01', debit: 1624000, credit: 0, journal_line_id: '1' },
      { date: '2024-06-02', debit: 0, credit: 1663937, journal_line_id: '2' },
    ];
    // all-time: no start → all period
    const { openingRows, periodRows } = splitSupplierBusinessHistoryRows(rows, null, '2026-09-23');
    const totals = computeSupplierBusinessHistoryTotals(openingRows, periodRows);
    assert.equal(totals.closing, 39937);
    assert.equal(supplierBusinessListBalance({ businessNet: 39937, officialApNet: 0, businessLineCount: 2, officialApLineCount: 0 }), totals.closing);
  });

  it('Official AP resolve must NOT be used as Business list truth for class-B suppliers', () => {
    // Simulates PartyLedgerReport bug before fix: opening already Business 39937,
    // but Official AP gl slice is 0 → resolve returns 0.
    const wiped = resolveContactListBalance({
      opening: 39937,
      contactType: 'supplier',
      listRole: 'supplier',
      glOk: true,
      glSlice: { glArReceivable: 0, glApPayable: 0, glWorkerPayable: 0 },
      opRow: { receivables: 0, payables: 0 },
    });
    assert.equal(wiped, 0);
    // After fix: Supplier list uses Contact.balance from Business overlay directly.
    const listBalance = 39937;
    assert.notEqual(listBalance, wiped);
  });
});
