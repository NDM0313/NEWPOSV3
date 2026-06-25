import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  roznamchaRowKey,
  roznamchaToCompareSummary,
  unifiedCashBankRowKey,
  unifiedCashBankToCompareSummary,
} from './roznamchaCashBankCompareMappers';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('roznamchaRowKey uses entity id', () => {
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

test('unifiedCashBankRowKey prefers journal line id', () => {
  assert.equal(
    unifiedCashBankRowKey({
      journalEntryLineId: 'jel-1',
      journalEntryId: 'je-1',
    } as UnifiedLedgerRow),
    'jel-1'
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
