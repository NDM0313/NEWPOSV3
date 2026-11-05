import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DIN_CHINA_COMPANY_ID,
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
  CLONE_REFERENCE,
  GATE_A_STATUS,
  TIEOUT_STATUS,
  balanceMatchesGolden,
  PILOT_BATCH_BASES,
  PILOT_BATCH_BRANCH_SCOPES,
} from './unifiedLedgerGoldenFixtures';

test('golden fixture constants are set', () => {
  assert.equal(DIN_CHINA_COMPANY_ID, '30bd8592-3384-4f34-899a-f3907e336485');
  assert.equal(MR_JALIL_CONTACT_ID, 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93');
  assert.equal(MR_JALIL_EXPECTED_BALANCE, 116_299);
  assert.equal(CLONE_REFERENCE, 'ledger_stage_20260625_prodcheck');
  assert.equal(GATE_A_STATUS, 'PASS 3/3');
  assert.equal(TIEOUT_STATUS, 'PASS 9/9');
});

test('pilot batch matrix is 9 comparisons', () => {
  assert.equal(PILOT_BATCH_BRANCH_SCOPES.length * PILOT_BATCH_BASES.length, 9);
});

test('balanceMatchesGolden for MR JALIL', () => {
  assert.equal(balanceMatchesGolden(216_300, 216_300), true);
  assert.equal(balanceMatchesGolden(216_300, 216_300 + 0.01), true);
  assert.equal(balanceMatchesGolden(216_300, 216_301), false);
});
