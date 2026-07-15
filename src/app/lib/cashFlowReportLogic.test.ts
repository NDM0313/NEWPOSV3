import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertUniqueCashFlowSourceKeys,
  buildCashFlowCsvRows,
  cashFlowFiltersAffectRunningBalance,
  cashFlowDateRangeSpanDays,
  cashFlowHeaderRangeExceedsSafeDays,
  CASH_FLOW_SAFE_RANGE_DAYS,
  cashFlowRowMatchesSelectedAccount,
  cashFlowRunningBalanceNote,
  cashFlowStatusBadges,
  computeCashFlowSummary,
  includeCashFlowRowInNormalMode,
  inferCashFlowSourceModule,
  recomputeCashFlowRunningBalance,
  resolveCashFlowRowStatus,
  shouldIncludeInGlCashFlowEntry,
  glCashFlowModeNote,
  computeCashFlowTieOut,
  buildCashFlowTieOutDiagnosticHints,
  CASH_FLOW_TIEOUT_EXPLANATION,
  resolveCashFlowPartyDisplay,
} from './cashFlowReportLogic';

test('normal mode excludes JE-0168-class correction_reversal rows', () => {
  assert.equal(
    includeCashFlowRowInNormalMode({
      id: 'jel-1',
      details: 'Reversal of Receipt',
      rowType: 'Payment',
      referenceType: 'correction_reversal',
    }),
    false
  );
});

test('audit mode includes reversal rows with reversed status label', () => {
  const status = resolveCashFlowRowStatus({
    id: 'jel-1',
    details: 'Reversal of Receipt HQ-SL-0004 (Reversal — audit)',
    rowType: 'Payment',
    referenceType: 'correction_reversal',
  });
  assert.equal(status, 'reversed');
});

test('cash in/out and net movement summary', () => {
  const summary = computeCashFlowSummary(
    [
      { cashIn: 1000, cashOut: 0 },
      { cashIn: 0, cashOut: 300 },
      { cashIn: 50, cashOut: 0 },
    ],
    500
  );
  assert.equal(summary.opening, 500);
  assert.equal(summary.cashIn, 1050);
  assert.equal(summary.cashOut, 300);
  assert.equal(summary.netMovement, 750);
  assert.equal(summary.closing, 1250);
});

test('running balance recomputed for filtered account rows', () => {
  const rows = recomputeCashFlowRunningBalance(
    [
      { id: '1', cashIn: 100, cashOut: 0, runningBalance: 0 },
      { id: '2', cashIn: 0, cashOut: 40, runningBalance: 0 },
    ],
    1000
  );
  assert.equal(rows[0].runningBalance, 1100);
  assert.equal(rows[1].runningBalance, 1060);
});

test('voided payments excluded from normal mode gate', () => {
  assert.equal(
    includeCashFlowRowInNormalMode({
      id: 'pay-1',
      details: 'Customer Payment',
      rowType: 'Customer Payment',
      referenceType: 'sale',
      paymentVoidedAt: '2026-01-01T00:00:00Z',
    }),
    false
  );
});

test('no double count when payment and JE share same source payment id', () => {
  const unique = assertUniqueCashFlowSourceKeys([
    { id: 'a', sourcePaymentId: 'p1', sourceJournalEntryId: null, sourceRentalPaymentId: null },
    { id: 'b', sourcePaymentId: 'p2', sourceJournalEntryId: null, sourceRentalPaymentId: null },
  ]);
  assert.equal(unique, true);
  const dup = assertUniqueCashFlowSourceKeys([
    { id: 'a', sourcePaymentId: 'p1', sourceJournalEntryId: null, sourceRentalPaymentId: null },
    { id: 'b', sourcePaymentId: 'p1', sourceJournalEntryId: null, sourceRentalPaymentId: null },
  ]);
  assert.equal(dup, false);
});

test('source module inference for expense payment', () => {
  assert.equal(
    inferCashFlowSourceModule({ rowType: 'Shop Expense', referenceType: 'expense', rowId: 'pay-x' }),
    'expenses'
  );
  assert.equal(
    inferCashFlowSourceModule({ rowType: 'Internal transfer', referenceType: 'transfer', rowId: 'jel-x' }),
    'transfers'
  );
});

test('status badges include Audit tag for reversal rows in audit mode', () => {
  assert.deepEqual(cashFlowStatusBadges('reversed', true), ['Reversed', 'Audit']);
  assert.deepEqual(cashFlowStatusBadges('live', true), ['Live']);
});

test('CSV export rows include status and branch columns', () => {
  const rows = buildCashFlowCsvRows([
    {
      dateTime: '2026-01-01 10:00',
      reference: 'RCV-0001',
      party: 'Walk-in',
      sourceModuleLabel: 'Sales receipts',
      cashAccount: 'Cash',
      cashIn: 100,
      cashOut: 0,
      runningBalance: 1100,
      status: 'live',
      branchName: 'HQ',
      auditMode: false,
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][8], 'Live');
  assert.equal(rows[0][9], 'HQ');
});

test('cashFlowDateRangeSpanDays and safe-range guard', () => {
  assert.equal(cashFlowDateRangeSpanDays('2026-01-01', '2026-01-01'), 1);
  assert.equal(cashFlowDateRangeSpanDays('2026-01-01', '2026-04-02'), 92);
  assert.equal(cashFlowHeaderRangeExceedsSafeDays('2026-01-01', '2026-04-02'), false);
  assert.equal(cashFlowHeaderRangeExceedsSafeDays('2026-01-01', '2026-04-03'), true);
  assert.equal(CASH_FLOW_SAFE_RANGE_DAYS, 92);
});

test('cashFlowRowMatchesSelectedAccount matches name and code parts', () => {
  const opt = { id: 'a1', label: '1010 — HBL Main' };
  assert.equal(cashFlowRowMatchesSelectedAccount('HBL Main', opt), true);
  assert.equal(cashFlowRowMatchesSelectedAccount('1010 HBL', opt), true);
  assert.equal(cashFlowRowMatchesSelectedAccount('Cash In Hand', opt), false);
  assert.equal(cashFlowRowMatchesSelectedAccount('HBL Main', undefined), false);
});

test('running balance note when filters active', () => {
  assert.equal(
    cashFlowRunningBalanceNote(
      cashFlowFiltersAffectRunningBalance({
        sourceModuleFilter: 'expenses',
        paymentLedgerAccountId: '',
        accountFilter: 'all',
        searchTerm: '',
      })
    ),
    'Running balance is calculated on the filtered rows.'
  );
  assert.equal(
    cashFlowRunningBalanceNote(
      cashFlowFiltersAffectRunningBalance({
        sourceModuleFilter: 'all',
        paymentLedgerAccountId: '',
        accountFilter: 'all',
        searchTerm: '',
      })
    ),
    null
  );
});

test('GL cash flow official basis includes correction_reversal entries', () => {
  assert.equal(shouldIncludeInGlCashFlowEntry('correction_reversal', 'official_gl'), true);
  assert.equal(shouldIncludeInGlCashFlowEntry('correction_reversal', 'effective_party'), false);
  assert.equal(shouldIncludeInGlCashFlowEntry('correction_reversal', true), true);
  assert.equal(shouldIncludeInGlCashFlowEntry('expense', 'effective_party'), true);
});

test('GL cash flow mode note by basis', () => {
  assert.match(glCashFlowModeNote(false, 'effective_party'), /excludes correction/i);
  assert.match(glCashFlowModeNote(false, 'official_gl'), /includes all non-void/i);
  assert.match(glCashFlowModeNote(true, 'official_gl'), /includes all non-void/i);
});

test('Cash Flow tie-out difference is operational minus GL net', () => {
  const tie = computeCashFlowTieOut(1500, 1200);
  assert.equal(tie.operationalNetMovement, 1500);
  assert.equal(tie.glNetMovement, 1200);
  assert.equal(tie.difference, 300);
});

test('Cash Flow tie-out diagnostic hints count manual and reversal rows', () => {
  const hints = buildCashFlowTieOutDiagnosticHints([
    { sourceModule: 'manual_je', status: 'live', referenceType: 'journal', party: 'A', branchName: 'HQ' },
    { sourceModule: 'other', status: 'reversed', referenceType: 'correction_reversal', party: null, branchName: 'HQ' },
  ]);
  assert.ok(hints.some((h) => h.code === 'manual_cash_je'));
  assert.ok(hints.some((h) => h.code === 'reversal_audit'));
  assert.match(CASH_FLOW_TIEOUT_EXPLANATION, /Operational grid/i);
});

test('resolveCashFlowPartyDisplay prefers customer name', () => {
  assert.equal(
    resolveCashFlowPartyDisplay({
      party: 'PARVAISE MARDAN',
      details: 'PARVAISE MARDAN',
    }),
    'PARVAISE MARDAN',
  );
});

test('resolveCashFlowPartyDisplay uses GL account from details', () => {
  assert.equal(
    resolveCashFlowPartyDisplay({
      party: null,
      details: 'Shop Expense (5100)',
    }),
    'Shop Expense (5100)',
  );
});

test('resolveCashFlowPartyDisplay returns null for generic label only', () => {
  assert.equal(
    resolveCashFlowPartyDisplay({
      party: null,
      details: 'Customer Receipt',
    }),
    null,
  );
});
