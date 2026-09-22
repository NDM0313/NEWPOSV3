/**
 * ARIF Business History opening/period split + liability closing identity.
 * Pure unit tests (no DB).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARIF_PILOT_COMPANY_ID,
  ARIF_PILOT_CONTACT_ID,
  computeArifBusinessHistoryTotals,
  dedupeAttributedRowsByJournalLineId,
  isArifSupplierBusinessPilot,
  splitArifBusinessHistoryRows,
} from './arifSupplierBusinessStatementPilot.ts';

describe('ARIF supplier business statement pilot', () => {
  it('gates only DIN COLLECTION + ARIF contact UUID', () => {
    assert.equal(isArifSupplierBusinessPilot(ARIF_PILOT_COMPANY_ID, ARIF_PILOT_CONTACT_ID), true);
    assert.equal(isArifSupplierBusinessPilot(ARIF_PILOT_COMPANY_ID, 'other'), false);
    assert.equal(isArifSupplierBusinessPilot('other-company', ARIF_PILOT_CONTACT_ID), false);
  });

  it('dedupes by journal_line_id before totals', () => {
    const rows = [
      { journal_line_id: 'a', date: '2025-01-01', debit: 10, credit: 0 },
      { journal_line_id: 'a', date: '2025-01-01', debit: 10, credit: 0 },
      { journal_line_id: 'b', date: '2025-02-01', debit: 0, credit: 5 },
      { journal_line_id: null, date: '2025-02-02', debit: 1, credit: 0 },
      { journal_line_id: null, date: '2025-02-03', debit: 2, credit: 0 },
    ];
    const deduped = dedupeAttributedRowsByJournalLineId(rows);
    assert.equal(deduped.length, 4);
    assert.equal(deduped.filter((r) => r.journal_line_id === 'a').length, 1);
  });

  it('splits opening vs period from unfiltered-by-start attributed set', () => {
    const rows = [
      { journal_line_id: 'o1', date: '2024-12-31', debit: 0, credit: 100 },
      { journal_line_id: 'o2', date: '2025-01-01', debit: 40, credit: 0 },
      { journal_line_id: 'p1', date: '2025-01-15', debit: 10, credit: 0 },
      { journal_line_id: 'p2', date: '2025-01-20', debit: 0, credit: 70 },
      { journal_line_id: 'after', date: '2025-02-01', debit: 0, credit: 999 },
      { journal_line_id: 'dup', date: '2025-01-18', debit: 5, credit: 0 },
      { journal_line_id: 'dup', date: '2025-01-18', debit: 5, credit: 0 },
    ];
    const { openingRows, periodRows } = splitArifBusinessHistoryRows(rows, '2025-01-10', '2025-01-31');
    assert.deepEqual(
      openingRows.map((r) => r.journal_line_id),
      ['o1', 'o2'],
    );
    assert.deepEqual(
      periodRows.map((r) => r.journal_line_id),
      ['p1', 'p2', 'dup'],
    );
  });

  it('proves opening + periodCredit - periodDebit = closing (liability style)', () => {
    const openingRows = [
      { journal_line_id: 'o1', date: '2024-06-01', debit: 1000, credit: 5000 },
      { journal_line_id: 'o2', date: '2024-12-01', debit: 200, credit: 0 },
    ];
    const periodRows = [
      { journal_line_id: 'p1', date: '2025-03-01', debit: 500, credit: 0 },
      { journal_line_id: 'p2', date: '2025-03-15', debit: 0, credit: 1500 },
      { journal_line_id: 'p3', date: '2025-03-20', debit: 100, credit: 50 },
    ];
    const totals = computeArifBusinessHistoryTotals(openingRows, periodRows);
    // opening = (5000-1000) + (0-200) = 3800
    assert.equal(totals.opening, 3800);
    assert.equal(totals.periodDebit, 600);
    assert.equal(totals.periodCredit, 1550);
    assert.equal(totals.closing, totals.opening + totals.periodCredit - totals.periodDebit);
    assert.equal(totals.closing, 4750);
  });

  it('does not treat period-only filtered set as a valid opening source', () => {
    // If startDate had already filtered the dataset, openingRows would be empty — wrong.
    const alreadyFilteredByStart = [
      { journal_line_id: 'p1', date: '2025-01-15', debit: 10, credit: 100 },
    ];
    const { openingRows, periodRows } = splitArifBusinessHistoryRows(
      alreadyFilteredByStart,
      '2025-01-10',
      '2025-01-31',
    );
    assert.equal(openingRows.length, 0);
    assert.equal(periodRows.length, 1);
    const totals = computeArifBusinessHistoryTotals(openingRows, periodRows);
    assert.equal(totals.opening, 0);
    // Identity still holds, but opening is incorrectly zero — documents why we omit startDate on the read.
    assert.equal(totals.closing, totals.opening + totals.periodCredit - totals.periodDebit);
  });
});
