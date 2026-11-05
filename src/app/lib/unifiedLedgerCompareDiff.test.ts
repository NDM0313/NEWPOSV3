import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  balancePasses,
  closingBalanceFromLegacyRows,
  compareTrialBalancePayloads,
  diffLedgerRows,
  diffTrialBalanceAccounts,
  legacyAccountRowKey,
  legacyPartyCompareRowKey,
  legacyToCompareSummary,
  round2,
} from './unifiedLedgerCompareDiff';

test('balancePasses within tolerance', () => {
  assert.equal(balancePasses(0), true);
  assert.equal(balancePasses(0.01), true);
  assert.equal(balancePasses(0.02), false);
});

test('diffLedgerRows finds missing and extra rows', () => {
  const result = diffLedgerRows({
    oldRows: [{ id: 'a1', je: 'je1' }],
    newRows: [{ id: 'b1', je: 'je2' }],
    oldKey: (r) => r.id,
    newKey: (r) => r.id,
    oldToSummary: (r) => ({
      journalEntryId: r.je,
      entryNo: null,
      entryDate: '2026-01-01',
      referenceType: null,
      debit: 100,
      credit: 0,
      description: 'old',
    }),
    newToSummary: (r) => ({
      journalEntryId: r.je,
      entryNo: null,
      entryDate: '2026-01-01',
      referenceType: null,
      debit: 50,
      credit: 0,
      description: 'new',
    }),
  });
  assert.equal(result.missingInNew.length, 1);
  assert.equal(result.extraInNew.length, 1);
});

test('diffTrialBalanceAccounts detects net mismatch', () => {
  const diffs = diffTrialBalanceAccounts(
    [
      {
        account_id: 'acc-1',
        account_code: '1100',
        account_name: 'AR',
        account_type: 'asset',
        debit: 100,
        credit: 0,
        balance: 100,
      },
    ],
    [
      {
        accountId: 'acc-1',
        accountCode: '1100',
        accountName: 'AR',
        accountType: 'asset',
        totalDebit: 100,
        totalCredit: 0,
        netBalance: 99,
      },
    ]
  );
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].kind, 'net_mismatch');
  assert.equal(round2(diffs[0].difference), 1);
});

test('diffTrialBalanceAccounts passes when nets match', () => {
  const diffs = diffTrialBalanceAccounts(
    [
      {
        account_id: 'acc-1',
        account_code: '1100',
        account_name: 'AR',
        account_type: 'asset',
        debit: 216300,
        credit: 0,
        balance: 216300,
      },
    ],
    [
      {
        accountId: 'acc-1',
        accountCode: '1100',
        accountName: 'AR',
        accountType: 'asset',
        totalDebit: 216300,
        totalCredit: 0,
        netBalance: 216300,
      },
    ]
  );
  assert.equal(diffs.length, 0);
});

test('closingBalanceFromLegacyRows uses running_balance', () => {
  const bal = closingBalanceFromLegacyRows([
    {
      date: '2026-01-01',
      reference_number: 'JE-1',
      description: 'x',
      debit: 100,
      credit: 0,
      running_balance: 216300,
      source_module: 'Accounting',
      journal_entry_id: 'je-1',
    },
  ]);
  assert.equal(bal, 216300);
});

test('closingBalanceFromLegacyRows returns 0 for empty rows', () => {
  assert.equal(closingBalanceFromLegacyRows([]), 0);
});

test('legacyPartyCompareRowKey prefers journal_line_id over journal_entry_id', () => {
  const key = legacyPartyCompareRowKey({
    date: '2026-01-01',
    reference_number: 'P-1',
    description: 'pay',
    debit: 100,
    credit: 0,
    running_balance: 100,
    source_module: 'Payment',
    journal_entry_id: 'je-1',
    journal_line_id: 'jel-99',
  });
  assert.equal(key, 'jel-99');
});

test('legacyToCompareSummary maps je_reference_type when reference_type absent', () => {
  const s = legacyToCompareSummary({
    date: '2026-01-01',
    reference_number: 'P-1',
    description: 'pay',
    debit: 100,
    credit: 0,
    running_balance: 100,
    source_module: 'Payment',
    journal_entry_id: 'je-1',
    je_reference_type: 'payment',
  });
  assert.equal(s.referenceType, 'payment');
});

test('diffLedgerRows matches same economic row when keys align on journal_line_id', () => {
  const result = diffLedgerRows({
    oldRows: [
      {
        journal_line_id: 'jel-99',
        journal_entry_id: 'je-1',
        date: '2026-01-01',
        reference_number: 'P-1',
        description: 'pay',
        debit: 100,
        credit: 0,
        running_balance: 100,
        source_module: 'Payment',
        je_reference_type: 'payment',
      },
    ],
    newRows: [
      {
        journalEntryLineId: 'jel-99',
        journalEntryId: 'je-1',
        entryDate: '2026-01-01',
        entryNo: 'P-1',
        description: 'pay',
        debit: 100,
        credit: 0,
        referenceType: 'payment',
      },
    ],
    oldKey: legacyPartyCompareRowKey,
    newKey: (r) => r.journalEntryLineId || r.journalEntryId,
    oldToSummary: legacyToCompareSummary,
    newToSummary: (r) => ({
      journalEntryId: r.journalEntryId,
      entryNo: r.entryNo,
      entryDate: r.entryDate,
      referenceType: r.referenceType,
      debit: r.debit,
      credit: r.credit,
      description: r.description,
    }),
  });
  assert.equal(result.missingInNew.length, 0);
  assert.equal(result.extraInNew.length, 0);
  assert.equal(result.amountMismatches.length, 0);
});

test('legacyAccountRowKey matches transfer rows with blank old type vs new transfer type', () => {
  const oldKey = legacyAccountRowKey({
    date: '2026-02-01',
    reference_number: 'JE-T1',
    description: 'transfer',
    debit: 5211200,
    credit: 0,
    running_balance: 5211200,
    source_module: 'Accounting',
    journal_entry_id: 'je-t1',
    journal_line_id: 'jel-transfer',
    je_reference_type: 'transfer',
  });
  const newKey = 'jel-transfer';
  assert.equal(oldKey, newKey);
});

test('compareTrialBalancePayloads passes when totals and accounts match', () => {
  const result = compareTrialBalancePayloads({
    oldRows: [
      {
        account_id: 'a1',
        account_code: '1100',
        account_name: 'AR',
        balance: 100,
        debit: 100,
        credit: 0,
      },
    ],
    newAccounts: [
      {
        accountId: 'a1',
        accountCode: '1100',
        accountName: 'AR',
        netBalance: 100,
        totalDebit: 100,
        totalCredit: 0,
      },
    ],
    oldTotals: { totalDebit: 100, totalCredit: 100, difference: 0 },
    newTotals: { totalDebit: 100, totalCredit: 100, difference: 0 },
  });
  assert.equal(result.accountDiffCount, 0);
  assert.equal(result.totalsPass, true);
});
