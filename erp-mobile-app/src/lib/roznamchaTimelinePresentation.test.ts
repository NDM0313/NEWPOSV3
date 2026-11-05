import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RoznamchaRowWithBalance } from '../api/roznamcha';
import { resolveRoznamchaRowPresentation } from './roznamchaTimelinePresentation';

function baseRow(overrides: Partial<RoznamchaRowWithBalance> = {}): RoznamchaRowWithBalance {
  return {
    id: 'pay-1',
    date: '2026-04-30',
    time: '14:30',
    ref: 'PAY-001',
    details: 'WALI T/T',
    referenceDisplay: 'JE-0010',
    createdBy: null,
    partyLine: null,
    journalEntryNo: 'JE-0010',
    cashIn: 0,
    cashOut: 900000,
    direction: 'OUT',
    amount: 900000,
    accountType: 'bank',
    accountLabel: 'Bank',
    accountName: 'FHD MZ',
    branchId: null,
    type: 'Manual Payment',
    runningBalance: 1000000,
    ...overrides,
  };
}

describe('roznamchaTimelinePresentation', () => {
  it('COA transfer OUT titles destination account (FHD → WALI)', () => {
    const pres = resolveRoznamchaRowPresentation(baseRow());
    assert.equal(pres.useLiquidityPresentation, true);
    assert.equal(pres.title, 'WALI T/T');
    assert.equal(pres.from, 'FHD MZ');
    assert.equal(pres.to, 'WALI T/T');
    assert.equal(pres.signPrefix, '−');
  });

  it('COA transfer IN titles destination account', () => {
    const pres = resolveRoznamchaRowPresentation(
      baseRow({
        direction: 'IN',
        cashIn: 1100000,
        cashOut: 0,
        accountName: 'WALI T/T',
        details: 'FHD MZ',
        type: 'Manual Receipt',
      }),
    );
    assert.equal(pres.title, 'WALI T/T');
    assert.equal(pres.from, 'FHD MZ');
    assert.equal(pres.to, 'WALI T/T');
    assert.equal(pres.signPrefix, '+');
  });

  it('customer receipt keeps party name as title', () => {
    const pres = resolveRoznamchaRowPresentation(
      baseRow({
        direction: 'IN',
        cashIn: 50000,
        cashOut: 0,
        accountName: 'WALI T/T',
        details: 'HASSAN MARDAN',
        type: 'Customer Receipt',
        amount: 50000,
      }),
    );
    assert.equal(pres.title, 'HASSAN MARDAN');
    assert.equal(pres.signPrefix, '+');
  });
});
