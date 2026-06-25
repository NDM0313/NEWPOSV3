import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffLedgerRows } from './unifiedLedgerCompareDiff';
import {
  roznamchaRowKey,
  roznamchaToCompareSummary,
  unifiedCashBankRowKey,
  unifiedCashBankToCompareSummary,
} from './roznamchaCashBankCompareMappers';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('roznamchaRowKey prefers sourceJournalEntryId over entity id', () => {
  assert.equal(
    roznamchaRowKey({ id: 'pay:abc', sourceJournalEntryId: 'je-99' } as RoznamchaRowWithBalance),
    'je-99'
  );
  assert.equal(roznamchaRowKey({ id: 'pay:abc' } as RoznamchaRowWithBalance), 'pay:abc');
});

test('roznamchaToCompareSummary maps cash in/out to debit/credit', () => {
  const s = roznamchaToCompareSummary({
    id: 'pay:1',
    date: '2026-01-15',
    ref: 'RCV-1',
    details: 'Cash Sale',
    referenceDisplay: '',
    cashIn: 500,
    cashOut: 0,
    type: 'Cash Sale',
  } as RoznamchaRowWithBalance);
  assert.equal(s.debit, 500);
  assert.equal(s.credit, 0);
  assert.equal(s.entryDate, '2026-01-15');
});

test('unifiedCashBankRowKey prefers journal entry id for roznamcha parity', () => {
  assert.equal(
    unifiedCashBankRowKey({
      journalEntryLineId: 'jel-1',
      journalEntryId: 'je-1',
    } as UnifiedLedgerRow),
    'je-1'
  );
});

test('unifiedCashBankToCompareSummary maps unified row fields', () => {
  const s = unifiedCashBankToCompareSummary({
    journalEntryId: 'je-1',
    journalEntryLineId: 'jel-1',
    entryDate: '2026-01-15',
    entryNo: 'JE-100',
    referenceType: 'payment',
    description: 'Receipt',
    debit: 500,
    credit: 0,
    runningBalance: 500,
  } as UnifiedLedgerRow);
  assert.equal(s.debit, 500);
  assert.equal(s.entryNo, 'JE-100');
});

test('diffLedgerRows matches roznamcha JE key to unified journalEntryId', () => {
  const result = diffLedgerRows({
    oldRows: [
      {
        id: 'pay:81',
        sourceJournalEntryId: '11278e1d-7832-458d-8863-641697cffc5d',
        date: '2025-12-01',
        ref: 'RCV-0050',
        details: 'LAL MOHAMMAD',
        cashIn: 170000,
        cashOut: 0,
        type: 'Customer Payment',
      } as RoznamchaRowWithBalance,
    ],
    newRows: [
      {
        journalEntryId: '11278e1d-7832-458d-8863-641697cffc5d',
        journalEntryLineId: 'jel-cash-line',
        entryDate: '2025-12-01',
        entryNo: 'RCV-0050',
        referenceType: 'payment',
        description: 'Receipt',
        debit: 170000,
        credit: 0,
      } as UnifiedLedgerRow,
    ],
    oldKey: roznamchaRowKey,
    newKey: unifiedCashBankRowKey,
    oldToSummary: roznamchaToCompareSummary,
    newToSummary: unifiedCashBankToCompareSummary,
  });
  assert.equal(result.missingInNew.length, 0);
  assert.equal(result.extraInNew.length, 0);
});
