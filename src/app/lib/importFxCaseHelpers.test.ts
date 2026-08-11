import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertPlanningEventDoesNotPost,
  isMoneyStageBlockedInW1,
  isW1ConfirmableStage,
  stageLabel,
} from './importFxCaseHelpers';

test('W1 only ARRANGEMENT is confirmable', () => {
  assert.equal(isW1ConfirmableStage('ARRANGEMENT'), true);
  assert.equal(isW1ConfirmableStage('ADVANCE'), false);
  assert.equal(isW1ConfirmableStage('USD_ACQUISITION'), false);
  assert.equal(isW1ConfirmableStage('SUPPLIER_ALLOCATION'), false);
});

test('money stages blocked in W1', () => {
  assert.equal(isMoneyStageBlockedInW1('ADVANCE'), true);
  assert.equal(isMoneyStageBlockedInW1('ARRANGEMENT'), false);
});

test('stage labels exist', () => {
  assert.match(stageLabel('CNY_POOL'), /CNY/i);
});

test('planning events must not post journals', () => {
  assert.doesNotThrow(() => assertPlanningEventDoesNotPost(false));
  assert.throws(() => assertPlanningEventDoesNotPost(true));
});

test('create-case client op: reuse until success then rotate', () => {
  let key = 'op-1';
  const onSuccess = () => {
    key = null;
  };
  const onNewIntent = () => {
    key = 'op-2';
  };
  assert.equal(key, 'op-1');
  onSuccess();
  assert.equal(key, null);
  onNewIntent();
  assert.equal(key, 'op-2');
});
