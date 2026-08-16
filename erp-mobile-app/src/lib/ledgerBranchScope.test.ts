import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCOUNT_LEDGER_ALL_BRANCHES } from './ledgerBranchScope.ts';
import { isOpeningOnlyPeriod, isTrulyEmptyLedger } from '../components/accounts/reports/_shared/LedgerPeriodEmptyCard.tsx';

test('ACCOUNT_LEDGER_ALL_BRANCHES matches web statement null scope', () => {
  assert.equal(ACCOUNT_LEDGER_ALL_BRANCHES, null);
});

test('opening-only uses raw line count (not net-presented)', () => {
  assert.equal(isOpeningOnlyPeriod(0, 2900000), true);
  assert.equal(isOpeningOnlyPeriod(81, 2900000), false);
  assert.equal(isTrulyEmptyLedger(0, 0), true);
  assert.equal(isTrulyEmptyLedger(0, 2900000), false);
});
