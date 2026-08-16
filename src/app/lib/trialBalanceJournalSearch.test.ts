import { describe, expect, it } from 'vitest';
import type { TrialBalanceRow } from '@/app/services/accountingReportsService';
import {
  computeTrialBalanceTotals,
  filterTrialBalanceAccountRows,
  mergeTrialBalanceSearchResults,
  trialBalanceRowMatchesAccountSearch,
} from './trialBalanceJournalSearch';

const sampleRow = (overrides: Partial<TrialBalanceRow> = {}): TrialBalanceRow => ({
  account_id: 'a1',
  account_code: '1100',
  account_name: 'Accounts Receivable',
  account_type: 'Asset',
  debit: 50000,
  credit: 10000,
  balance: 40000,
  ...overrides,
});

describe('trialBalanceRowMatchesAccountSearch', () => {
  it('matches account code and name', () => {
    expect(trialBalanceRowMatchesAccountSearch(sampleRow(), '1100')).toBe(true);
    expect(trialBalanceRowMatchesAccountSearch(sampleRow(), 'receivable')).toBe(true);
    expect(trialBalanceRowMatchesAccountSearch(sampleRow(), 'expense')).toBe(false);
  });

  it('matches numeric debit/credit/balance without commas', () => {
    expect(trialBalanceRowMatchesAccountSearch(sampleRow(), '50000')).toBe(true);
    expect(trialBalanceRowMatchesAccountSearch(sampleRow(), '40000')).toBe(true);
    expect(trialBalanceRowMatchesAccountSearch(sampleRow(), '-10000')).toBe(false);
  });
});

describe('filterTrialBalanceAccountRows', () => {
  it('returns all rows when query empty', () => {
    const rows = [sampleRow(), sampleRow({ account_id: 'a2', account_code: '2000' })];
    expect(filterTrialBalanceAccountRows(rows, '')).toHaveLength(2);
  });

  it('filters by code', () => {
    const rows = [
      sampleRow(),
      sampleRow({ account_id: 'a2', account_code: '2000', account_name: 'Payable' }),
    ];
    expect(filterTrialBalanceAccountRows(rows, '2000')).toHaveLength(1);
  });
});

describe('computeTrialBalanceTotals', () => {
  it('sums debit and credit from filtered rows', () => {
    const totals = computeTrialBalanceTotals([
      sampleRow({ debit: 100, credit: 20, balance: 80 }),
      sampleRow({ account_id: 'a2', debit: 50, credit: 30, balance: 20 }),
    ]);
    expect(totals.totalDebit).toBe(150);
    expect(totals.totalCredit).toBe(50);
    expect(totals.difference).toBe(100);
  });
});

describe('mergeTrialBalanceSearchResults', () => {
  it('merges account filter with journal account ids', () => {
    const rows = [
      sampleRow(),
      sampleRow({ account_id: 'a2', account_code: '4200', account_name: 'Sales', debit: 0, credit: 0, balance: 0 }),
    ];
    const merged = mergeTrialBalanceSearchResults(rows, 'JE-999', new Set(['a2']), true);
    expect(merged).toHaveLength(1);
    expect(merged[0].account_id).toBe('a2');
  });

  it('uses account filter only when journal toggle off', () => {
    const rows = [
      sampleRow(),
      sampleRow({ account_id: 'a2', account_code: '4200', account_name: 'Sales' }),
    ];
    const merged = mergeTrialBalanceSearchResults(rows, '1100', new Set(['a2']), false);
    expect(merged).toHaveLength(1);
    expect(merged[0].account_code).toBe('1100');
  });
});
