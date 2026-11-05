import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildTrialBalancePreviewRpcScope,
  legacyTrialBalanceCompareDateFrom,
  normalizeTrialBalancePreviewBranch,
  trialBalancePreviewAsOfDate,
} from './trialBalanceUnifiedPreviewScope';

test('normalizeTrialBalancePreviewBranch maps undefined and all to null', () => {
  assert.equal(normalizeTrialBalancePreviewBranch(undefined), null);
  assert.equal(normalizeTrialBalancePreviewBranch('all'), null);
  assert.equal(normalizeTrialBalancePreviewBranch('branch-1'), 'branch-1');
});

test('trialBalancePreviewAsOfDate uses end date', () => {
  assert.equal(trialBalancePreviewAsOfDate('2026-03-31'), '2026-03-31');
});

test('legacyTrialBalanceCompareDateFrom uses lifetime start for as-of parity', () => {
  assert.equal(legacyTrialBalanceCompareDateFrom('2025-12-01'), '1900-01-01');
});

test('buildTrialBalancePreviewRpcScope passes branch null and asOfDate endDate', () => {
  const scope = buildTrialBalancePreviewRpcScope({
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    branchId: undefined,
  });
  assert.equal(scope.branchId, null);
  assert.equal(scope.asOfDate, '2026-03-31');
  assert.equal(scope.legacyPeriodFrom, '2026-01-01');
  assert.equal(scope.legacyPeriodTo, '2026-03-31');
});

test('buildTrialBalancePreviewRpcScope preserves single branch', () => {
  const scope = buildTrialBalancePreviewRpcScope({
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    branchId: 'b-99',
  });
  assert.equal(scope.branchId, 'b-99');
});
