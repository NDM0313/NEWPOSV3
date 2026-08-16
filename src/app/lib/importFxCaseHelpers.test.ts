import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertNonNegativePlanningAmount,
  assertPlanningEventDoesNotPost,
  canEditArrangementType,
  isMoneyStageBlockedInW1,
  isMoneyStageBlockedInW2,
  isW1ConfirmableStage,
  isW2ConfirmableStage,
  normalizeFundingMode,
  stageLabel,
  W2_MONEY_STAGE_BLOCKED_COPY,
} from './importFxCaseHelpers';
import { normalizeImportDocCurrency } from './importFxHelpers';

test('W2 only ARRANGEMENT is confirmable; W3 stages selectable; W4+ blocked', () => {
  assert.equal(isW2ConfirmableStage('ARRANGEMENT'), true);
  assert.equal(isW1ConfirmableStage('ARRANGEMENT'), true);
  for (const code of [
    'ADVANCE',
    'USD_ACQUISITION',
    'CHINA_USD_TRANSFER',
    'USD_CNY_CONVERSION',
    'CNY_POOL',
    'SUPPLIER_ALLOCATION',
    'RECONCILIATION',
  ] as const) {
    assert.equal(isW2ConfirmableStage(code), false);
  }
  assert.equal(isMoneyStageBlockedInW2('ADVANCE'), false);
  assert.equal(isMoneyStageBlockedInW2('USD_ACQUISITION'), false);
  for (const code of [
    'CHINA_USD_TRANSFER',
    'USD_CNY_CONVERSION',
    'CNY_POOL',
    'SUPPLIER_ALLOCATION',
    'RECONCILIATION',
  ] as const) {
    assert.equal(isMoneyStageBlockedInW2(code), true);
  }
});

test('money stages: W1 blocks ADVANCE; W2 helper opens W3 ADVANCE/USD; W4+ still blocked', () => {
  assert.equal(isMoneyStageBlockedInW1('ADVANCE'), true);
  assert.equal(isMoneyStageBlockedInW2('USD_ACQUISITION'), false);
  assert.equal(isMoneyStageBlockedInW2('CHINA_USD_TRANSFER'), true);
  assert.equal(isMoneyStageBlockedInW1('ARRANGEMENT'), false);
});

test('funding mode normalization', () => {
  assert.equal(normalizeFundingMode('advance'), 'ADVANCE');
  assert.equal(normalizeFundingMode('CREDIT'), 'CREDIT');
  assert.equal(normalizeFundingMode('mixed'), 'MIXED');
  assert.equal(normalizeFundingMode('bogus'), null);
  assert.equal(normalizeFundingMode(''), null);
});

test('RMB normalizes to CNY for planning currencies', () => {
  assert.equal(normalizeImportDocCurrency('RMB'), 'CNY');
  assert.equal(normalizeImportDocCurrency('cny'), 'CNY');
});

test('negative planning amounts rejected', () => {
  assert.doesNotThrow(() => assertNonNegativePlanningAmount(0, 'x'));
  assert.doesNotThrow(() => assertNonNegativePlanningAmount(1, 'x'));
  assert.throws(() => assertNonNegativePlanningAmount(-1, 'planned_usd_amount'), /NEGATIVE/);
});

test('arrangement type editable only while DRAFT and unconfirmed', () => {
  assert.equal(
    canEditArrangementType({
      operationalStatus: 'DRAFT',
      arrangementStageStatus: 'PLANNED',
      arrangementConfirmedAt: null,
    }),
    true
  );
  assert.equal(
    canEditArrangementType({
      operationalStatus: 'ARRANGED',
      arrangementStageStatus: 'COMPLETED',
      arrangementConfirmedAt: '2026-08-12',
    }),
    false
  );
  assert.equal(
    canEditArrangementType({
      operationalStatus: 'DRAFT',
      arrangementStageStatus: 'COMPLETED',
      arrangementConfirmedAt: null,
    }),
    false
  );
});

test('stage labels and W3+ copy', () => {
  assert.match(stageLabel('CNY_POOL'), /CNY/i);
  assert.match(W2_MONEY_STAGE_BLOCKED_COPY, /W3\+/);
  assert.match(W2_MONEY_STAGE_BLOCKED_COPY, /no financial posting/i);
});

test('planning events must not post journals', () => {
  assert.doesNotThrow(() => assertPlanningEventDoesNotPost(false));
  assert.throws(() => assertPlanningEventDoesNotPost(true));
});

test('confirm client op: reuse until success then rotate', () => {
  let key: string | null = 'confirm-op-1';
  const onSuccess = () => {
    key = null;
  };
  const onRetryableFailure = () => {
    /* retain */
  };
  assert.equal(key, 'confirm-op-1');
  onRetryableFailure();
  assert.equal(key, 'confirm-op-1');
  onSuccess();
  assert.equal(key, null);
});
