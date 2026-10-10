import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  effectivePartyRowKey,
  effectivePartyToCompareSummary,
} from './effectivePartyLedgerCompareMappers';
import type { EffectiveLedgerRow } from '@/app/services/effectivePartyLedgerService';

test('effectivePartyRowKey uses row id', () => {
  assert.equal(effectivePartyRowKey({ id: 'sale:abc' } as EffectiveLedgerRow), 'sale:abc');
});

test('effectivePartyToCompareSummary maps debit credit', () => {
  const s = effectivePartyToCompareSummary({
    id: 'pay:1',
    date: '2026-02-01',
    referenceNo: 'RCV-1',
    type: 'receipt',
    typeLabel: 'Receipt',
    description: 'Payment',
    debit: 0,
    credit: 500,
  } as EffectiveLedgerRow);
  assert.equal(s.credit, 500);
  assert.equal(s.entryDate, '2026-02-01');
});
