import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  W21_HISTORICAL_MISSING_AGENT_WARNING,
  W21_PATH_CLARITY_AGENT_FX_COPY,
  W21_PATH_CLARITY_CASE_COPY,
  W21_RATE_LABEL_CNY_PER_USD,
  W21_WALLET_SOURCE_GUIDANCE,
  arrangementTypeRequiresAgent,
  buildFundingSummaryView,
  computeExpectedTotalPkr,
  formatW21RateLabel,
  isAssignmentOverdue,
  isHistoricalConfirmedMissingAgent,
  normalizeAdvanceForFundingMode,
  validateW21ArrangementPlanning,
} from './importFxCaseW21Helpers';
import { formatIndicativeRateLabel } from './importFxIndicativeRates';
import {
  isArrangementLocked,
  validateArrangementPlanning,
  workspaceActions,
} from './importFxCaseWorkspaceView';
import { isMoneyStageBlockedInW2, W2_MONEY_STAGE_BLOCKED_COPY } from './importFxCaseHelpers';

test('W2.1 agent matrix: all shipped arrangement types require agent', () => {
  assert.equal(arrangementTypeRequiresAgent('POOLED_USD_CNY'), true);
  assert.equal(arrangementTypeRequiresAgent('PATH_21_AGENT_DUAL_CREDIT'), true);
  assert.equal(arrangementTypeRequiresAgent('AGENT_PREPAID'), true);
  assert.equal(arrangementTypeRequiresAgent('UNKNOWN'), false);
});

test('W2.1 blank agent rejected on confirm validation', () => {
  const errs = validateW21ArrangementPlanning({
    arrangementType: 'POOLED_USD_CNY',
    agentId: '',
    requireAgentIfNeeded: true,
  });
  assert.ok(errs.some((e) => /Money exchange agent is required/i.test(e)));
});

test('W2.1 same agent/third-party rejected', () => {
  const errs = validateArrangementPlanning({
    agentId: 'a1',
    thirdPartyId: 'a1',
    arrangementType: 'POOLED_USD_CNY',
  });
  assert.deepEqual(errs, ['Agent and third party must be different contacts.']);
});

test('W2.1 CREDIT clears planned advance and hides it in summary', () => {
  assert.equal(normalizeAdvanceForFundingMode('CREDIT', 5000), null);
  const summary = buildFundingSummaryView({
    fundingMode: 'CREDIT',
    plannedUsd: 30000,
    pkrPerUsd: 287.5,
    feesPkr: 0,
    advancePkr: 5000,
  });
  assert.equal(summary.showPlannedAdvance, false);
  assert.equal(summary.plannedAdvancePkr, null);
  assert.equal(summary.showExpectedAgentCredit, true);
  assert.equal(summary.expectedTotalPkr, 30000 * 287.5);
  assert.equal(summary.expectedAgentCreditPkr, 30000 * 287.5);
  assert.equal(summary.notFinanciallyPosted, true);
});

test('W2.1 ADVANCE summary shows advance and zero credit', () => {
  const summary = buildFundingSummaryView({
    fundingMode: 'ADVANCE',
    plannedUsd: 1000,
    pkrPerUsd: 280,
    advancePkr: 280000,
  });
  assert.equal(summary.showPlannedAdvance, true);
  assert.equal(summary.plannedAdvancePkr, 280000);
  assert.equal(summary.expectedAgentCreditPkr, 0);
  assert.equal(summary.showExpectedAgentCredit, false);
});

test('W2.1 MIXED calculation and excess advance rejection', () => {
  const total = computeExpectedTotalPkr({ plannedUsd: 100, pkrPerUsd: 280, feesPkr: 20 });
  assert.equal(total, 100 * 280 + 20);
  const summary = buildFundingSummaryView({
    fundingMode: 'MIXED',
    plannedUsd: 100,
    pkrPerUsd: 280,
    feesPkr: 20,
    advancePkr: 10000,
  });
  assert.equal(summary.expectedAgentCreditPkr, total! - 10000);
  const errs = validateW21ArrangementPlanning({
    fundingMode: 'MIXED',
    plannedUsd: '100',
    expectedPkrPerUsd: '280',
    expectedFeesPkr: '20',
    expectedAdvanceAmountPkr: '999999',
  });
  assert.ok(errs.some((e) => /cannot exceed expected total/i.test(e)));
});

test('W2.1 explicit rate-direction labels', () => {
  assert.equal(formatW21RateLabel('cny_per_usd'), W21_RATE_LABEL_CNY_PER_USD);
  assert.equal(formatW21RateLabel('cny_per_usd'), 'CNY received per 1 USD');
  assert.equal(formatIndicativeRateLabel('PKR', 'USD'), 'Indicative PKR per 1 USD');
  assert.equal(formatIndicativeRateLabel('PKR', 'CNY'), 'Indicative PKR per 1 CNY');
  assert.equal(formatIndicativeRateLabel('USD', 'CNY'), 'Indicative USD required per 1 CNY');
  // Screenshot-style: 202383 / 30000 ≈ 6.7461 CNY per USD
  assert.equal(Math.round((202383 / 30000) * 10000) / 10000, 6.7461);
});

test('W2.1 UI locked after confirmation', () => {
  assert.equal(
    isArrangementLocked({
      arrangementConfirmedAt: '2026-08-13T00:00:00Z',
      operationalStatus: 'ARRANGED',
      arrangementStageStatus: 'COMPLETED',
    }),
    true
  );
  const actions = workspaceActions({
    mode: 'confirmed',
    busy: false,
    accountingStatus: 'NOT_POSTED',
    operationalStatus: 'ARRANGED',
  });
  assert.equal(actions.showSaveDraft, false);
  assert.equal(actions.showConfirmArrangement, false);
  assert.equal(actions.fieldsLocked, true);
});

test('W2.1 historical NULL-agent confirmed case remains readable with warning flag', () => {
  assert.equal(
    isHistoricalConfirmedMissingAgent({
      arrangementConfirmedAt: '2026-08-01T00:00:00Z',
      operationalStatus: 'ARRANGED',
      arrangementType: 'POOLED_USD_CNY',
      agentContactId: null,
    }),
    true
  );
  assert.match(W21_HISTORICAL_MISSING_AGENT_WARNING, /no money-exchange agent/i);
});

test('W2.1 assignment overdue and status helpers', () => {
  assert.equal(
    isAssignmentOverdue({ dueAt: '2020-01-01T00:00:00Z', status: 'WAITING_AGENT' }),
    true
  );
  assert.equal(isAssignmentOverdue({ dueAt: '2020-01-01T00:00:00Z', status: 'DONE' }), false);
});

test('W2.1 money stages remain blocked; Path clarity copy present', () => {
  assert.equal(isMoneyStageBlockedInW2('USD_ACQUISITION'), true);
  assert.equal(isMoneyStageBlockedInW2('ARRANGEMENT'), false);
  assert.match(W2_MONEY_STAGE_BLOCKED_COPY, /W3\+/);
  assert.match(W21_PATH_CLARITY_CASE_COPY, /no wallet or accounting posting/i);
  assert.match(W21_PATH_CLARITY_AGENT_FX_COPY, /money-posting/i);
  assert.match(W21_WALLET_SOURCE_GUIDANCE, /never creates a TT\/USD wallet/i);
});

test('W2.1 draft validation still allows blank agent until confirm', () => {
  const draft = validateArrangementPlanning({
    arrangementType: 'POOLED_USD_CNY',
    agentId: '',
    requireAgentIfNeeded: false,
  });
  assert.deepEqual(draft, []);
});
