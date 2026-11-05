/**
 * Supplier Business GL pure helpers (no DB).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeSupplierBusinessHistoryTotals,
  dedupeAttributedRowsByJournalLineId,
  filterSupplierBusinessAttributedRows,
  isSupplierBusinessContactType,
  mapSupplierBusinessNetToDueAdvance,
  splitSupplierBusinessHistoryRows,
} from './supplierBusinessGl.ts';

describe('supplierBusinessGl', () => {
  it('excludes worker and courier roles', () => {
    assert.equal(isSupplierBusinessContactType('supplier'), true);
    assert.equal(isSupplierBusinessContactType('both'), true);
    assert.equal(isSupplierBusinessContactType('money_exchange'), true);
    assert.equal(isSupplierBusinessContactType('worker'), false);
    assert.equal(isSupplierBusinessContactType('courier'), false);
    assert.equal(isSupplierBusinessContactType('customer'), false);
  });

  it('maps liability Cr-Dr net to Due/Advance', () => {
    assert.deepEqual(mapSupplierBusinessNetToDueAdvance(39937), { due: 39937, advanceGl: 0 });
    assert.deepEqual(mapSupplierBusinessNetToDueAdvance(-1200), { due: 0, advanceGl: 1200 });
    assert.deepEqual(mapSupplierBusinessNetToDueAdvance(0), { due: 0, advanceGl: 0 });
  });

  it('filters to AP-2000 + legacy 2090/210xxx components', () => {
    const rows = [
      { date: '2025-01-01', notes: 'gl_component:ap_2000', debit: 0, credit: 1 },
      { date: '2025-01-01', notes: 'gl_component:legacy_2090', debit: 0, credit: 2 },
      { date: '2025-01-01', notes: 'gl_component:ar_1100', debit: 3, credit: 0 },
      { date: '2025-01-01', notes: 'gl_component:worker_2010', debit: 4, credit: 0 },
      { date: '2025-01-01', notes: null, gl_account_code: '210017', debit: 0, credit: 5 },
    ] as any[];
    const filtered = filterSupplierBusinessAttributedRows(rows);
    assert.equal(filtered.length, 3);
  });

  it('ARIF-shaped closing identity matches 39937 fixture math', () => {
    // Synthetic: opening credit 50000, period debit 10063 → closing 39937
    const openingRows = [{ journal_line_id: 'o', date: '2020-01-01', debit: 0, credit: 50000 }];
    const periodRows = [{ journal_line_id: 'p', date: '2025-01-01', debit: 10063, credit: 0 }];
    const totals = computeSupplierBusinessHistoryTotals(openingRows, periodRows);
    assert.equal(totals.closing, 39937);
  });

  it('dedupes and splits opening vs period', () => {
    const rows = [
      { journal_line_id: 'a', date: '2024-01-01', debit: 0, credit: 10 },
      { journal_line_id: 'a', date: '2024-01-01', debit: 0, credit: 10 },
      { journal_line_id: 'b', date: '2025-06-01', debit: 3, credit: 0 },
    ];
    assert.equal(dedupeAttributedRowsByJournalLineId(rows).length, 2);
    const { openingRows, periodRows } = splitSupplierBusinessHistoryRows(rows, '2025-01-01', '2025-12-31');
    assert.equal(openingRows.length, 1);
    assert.equal(periodRows.length, 1);
  });
});
