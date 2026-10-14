import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allocateAdvancesFifo,
  buildAdvanceJournalPreview,
  buildUsdAcquisitionJournalPreview,
  computeUsdCarryingPkr,
  isEligibleClearingAccountCandidate,
  isPostW3MoneyStageBlocked,
  isW3MoneyStage,
  splitFundingAmounts,
} from './importFxCaseW3Helpers.ts';
import { isMoneyStageBlockedInW2 } from './importFxCaseHelpers.ts';

test('W3 stages are ADVANCE and USD_ACQUISITION only', () => {
  assert.equal(isW3MoneyStage('ADVANCE'), true);
  assert.equal(isW3MoneyStage('USD_ACQUISITION'), true);
  assert.equal(isW3MoneyStage('CHINA_USD_TRANSFER'), false);
  assert.equal(isMoneyStageBlockedInW2('ADVANCE'), false);
  assert.equal(isMoneyStageBlockedInW2('CHINA_USD_TRANSFER'), true);
  assert.equal(isPostW3MoneyStageBlocked('CNY_POOL'), true);
});

test('carrying and funding splits', () => {
  assert.equal(computeUsdCarryingPkr(10, 287.5), 2875);
  assert.deepEqual(splitFundingAmounts('CREDIT', 2875), {
    advanceAppliedPkr: 0,
    agentApCreatedPkr: 2875,
  });
  assert.deepEqual(splitFundingAmounts('ADVANCE', 2875), {
    advanceAppliedPkr: 2875,
    agentApCreatedPkr: 0,
  });
  assert.deepEqual(splitFundingAmounts('MIXED', 2875, 1000), {
    advanceAppliedPkr: 1000,
    agentApCreatedPkr: 1875,
  });
});

test('FIFO advance allocation oldest first', () => {
  const rows = [
    { id: 'b', remaining_unapplied_pkr: 500, posted_at: '2026-08-02T00:00:00Z' },
    { id: 'a', remaining_unapplied_pkr: 1000, posted_at: '2026-08-01T00:00:00Z' },
  ];
  assert.deepEqual(allocateAdvancesFifo(rows, 1200), [
    { advance_id: 'a', applied_pkr: 1000 },
    { advance_id: 'b', applied_pkr: 200 },
  ]);
});

test('journal previews balance', () => {
  const a = buildAdvanceJournalPreview({
    clearingLabel: 'Clearing',
    paymentSourceLabel: 'Bank',
    amountPkr: 1000,
  });
  assert.equal(a.balanced, true);
  const u = buildUsdAcquisitionJournalPreview({
    walletLabel: 'USD',
    clearingLabel: 'Clearing',
    agentApLabel: 'AP',
    carryingPkr: 2875,
    advanceAppliedPkr: 1000,
    agentApCreatedPkr: 1875,
  });
  assert.equal(u.balanced, true);
  assert.equal(u.lines.length, 3);
});

test('clearing candidate rejects worker advance and groups', () => {
  assert.equal(
    isEligibleClearingAccountCandidate({
      id: '1',
      code: '1180',
      type: 'asset',
      is_group: false,
      is_active: true,
    }),
    false
  );
  assert.equal(
    isEligibleClearingAccountCandidate({
      id: '2',
      code: '1235',
      type: 'asset',
      is_group: false,
      is_active: true,
      name: 'Agent FX Advance Clearing',
    }),
    true
  );
});
