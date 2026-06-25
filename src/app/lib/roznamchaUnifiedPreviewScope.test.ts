import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accountFilterToLiquidity,
  buildRoznamchaPreviewRpcScope,
  defaultUnifiedBasisForRoznamcha,
  filterUnifiedRowsByPaymentAccount,
  normalizeRoznamchaPreviewBranch,
} from './roznamchaUnifiedPreviewScope';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('normalizeRoznamchaPreviewBranch maps all to null', () => {
  assert.equal(normalizeRoznamchaPreviewBranch(null), null);
  assert.equal(normalizeRoznamchaPreviewBranch('all'), null);
  assert.equal(normalizeRoznamchaPreviewBranch('b-1'), 'b-1');
});

test('accountFilterToLiquidity passes through filter', () => {
  assert.equal(accountFilterToLiquidity('bank'), 'bank');
  assert.equal(accountFilterToLiquidity('all'), 'all');
});

test('defaultUnifiedBasisForRoznamcha maps voided toggle to basis', () => {
  assert.equal(defaultUnifiedBasisForRoznamcha(false), 'effective_party');
  assert.equal(defaultUnifiedBasisForRoznamcha(true), 'audit_full_history');
});

test('buildRoznamchaPreviewRpcScope passes dates and liquidity', () => {
  const scope = buildRoznamchaPreviewRpcScope({
    branchId: null,
    dateFrom: '2026-01-01',
    dateTo: '2026-03-31',
    accountFilter: 'cash',
    includeVoidedReversed: false,
  });
  assert.equal(scope.dateFrom, '2026-01-01');
  assert.equal(scope.dateTo, '2026-03-31');
  assert.equal(scope.liquidity, 'cash');
  assert.equal(scope.basis, 'effective_party');
});

test('filterUnifiedRowsByPaymentAccount filters by account code in label', () => {
  const rows = [
    { accountCode: '1010', accountName: 'HBL Main' },
    { accountCode: '1000', accountName: 'Cash' },
  ] as UnifiedLedgerRow[];
  const filtered = filterUnifiedRowsByPaymentAccount(rows, 'acc-1', [
    { id: 'acc-1', label: '1010 — HBL Main' },
  ]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].accountCode, '1010');
});
