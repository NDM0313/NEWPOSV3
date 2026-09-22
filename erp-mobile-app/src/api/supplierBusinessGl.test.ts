/**
 * Supplier Business GL pure helpers (no DB) — mobile parity with web golden.
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
  supplierBusinessListBalance,
} from './supplierBusinessGl.ts';
import { classifyJournalGlComponent } from '../lib/journalPartyAttribution.ts';

describe('supplierBusinessGl (mobile)', () => {
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
      { date: '2025-01-01', notes: 'gl_component:ap_2000', debit: 0, credit: 1, gl_account_code: 'AP-X' },
      { date: '2025-01-01', notes: 'gl_component:legacy_2090', debit: 0, credit: 2, gl_account_code: '210017' },
      { date: '2025-01-01', notes: 'gl_component:ar_1100', debit: 3, credit: 0, gl_account_code: 'AR-X' },
      { date: '2025-01-01', notes: 'gl_component:worker_2010', debit: 4, credit: 0, gl_account_code: 'WP-X' },
      { date: '2025-01-01', notes: null, gl_account_code: '210017', debit: 0, credit: 5 },
    ] as any[];
    const filtered = filterSupplierBusinessAttributedRows(rows);
    assert.equal(filtered.length, 3);
  });

  it('dedupes by journal_line_id', () => {
    const rows = [
      { journal_line_id: 'a', date: '2025-01-01', debit: 0, credit: 1 },
      { journal_line_id: 'a', date: '2025-01-01', debit: 0, credit: 99 },
      { journal_line_id: 'b', date: '2025-01-02', debit: 0, credit: 2 },
    ];
    const d = dedupeAttributedRowsByJournalLineId(rows);
    assert.equal(d.length, 2);
    assert.equal(d[0].credit, 1);
  });

  it('splits opening vs period and computes ARIF-like closing', () => {
    const rows = [
      { date: '2024-01-01', debit: 100, credit: 0, journal_line_id: '1' },
      { date: '2025-06-01', debit: 1624000, credit: 0, journal_line_id: '2' },
      { date: '2025-06-02', debit: 0, credit: 1663937, journal_line_id: '3' },
    ];
    const { openingRows, periodRows } = splitSupplierBusinessHistoryRows(
      rows,
      '2025-01-01',
      '2026-09-23',
    );
    assert.equal(openingRows.length, 1);
    assert.equal(periodRows.length, 2);
    const totals = computeSupplierBusinessHistoryTotals(openingRows, periodRows);
    // opening = 0-100 = -100; closing = -100 + 1663937 - 1624000 = 39837
    assert.equal(totals.opening, -100);
    assert.equal(totals.periodDebit, 1624000);
    assert.equal(totals.periodCredit, 1663937);
    assert.equal(totals.closing, -100 + 1663937 - 1624000);
  });

  it('classifies 210017 as legacy_2090 and AP- as ap_2000', () => {
    assert.equal(classifyJournalGlComponent({ id: '1', code: '210017' }), 'legacy_2090');
    assert.equal(classifyJournalGlComponent({ id: '2', code: 'AP-SUPX' }), 'ap_2000');
    assert.equal(classifyJournalGlComponent({ id: '3', code: 'WP-X' }), 'worker_2010');
  });

  it('list balance uses signed businessNet', () => {
    assert.equal(supplierBusinessListBalance({ businessNet: 39937, officialApNet: 0, businessLineCount: 24, officialApLineCount: 0 }), 39937);
    assert.equal(supplierBusinessListBalance(undefined), 0);
  });
});
