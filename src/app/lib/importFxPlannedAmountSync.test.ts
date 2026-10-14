import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PLANNED_CURRENCY_NO_CONVERT_COPY,
  PLANNED_CURRENCY_PURCHASE_COPY,
  pickSyncedAmountsToApply,
  syncPlannedAmounts,
} from './importFxPlannedAmountSync';

test('USD driver fills CNY and PKR from rates', () => {
  const sync = syncPlannedAmounts({
    sourceCurrency: 'USD',
    settlementCurrency: 'CNY',
    driver: 'usd',
    plannedUsd: 1000,
    expectedCny: null,
    advancePkr: null,
    pkrPerUsd: 280,
    cnyPerUsd: 7.2,
  });
  assert.equal(sync.plannedUsd, null);
  assert.equal(Number(sync.expectedCny), 7200);
  assert.equal(Number(sync.advancePkr), 280000);
});

test('CNY driver fills USD and PKR', () => {
  const sync = syncPlannedAmounts({
    sourceCurrency: 'CNY',
    settlementCurrency: 'USD',
    driver: 'cny',
    plannedUsd: null,
    expectedCny: 7200,
    advancePkr: null,
    pkrPerUsd: 280,
    cnyPerUsd: 7.2,
  });
  assert.equal(Number(sync.plannedUsd), 1000);
  assert.equal(sync.expectedCny, null);
  assert.equal(Number(sync.advancePkr), 280000);
});

test('PKR driver fills USD and CNY', () => {
  const sync = syncPlannedAmounts({
    sourceCurrency: 'USD',
    settlementCurrency: 'CNY',
    driver: 'pkr',
    plannedUsd: null,
    expectedCny: null,
    advancePkr: 280000,
    pkrPerUsd: 280,
    cnyPerUsd: 7.2,
  });
  assert.equal(Number(sync.plannedUsd), 1000);
  assert.equal(Number(sync.expectedCny), 7200);
  assert.equal(sync.advancePkr, null);
});

test('missing rate does not invent counterpart amounts', () => {
  const sync = syncPlannedAmounts({
    sourceCurrency: 'USD',
    settlementCurrency: 'CNY',
    driver: 'usd',
    plannedUsd: 1000,
    expectedCny: null,
    advancePkr: null,
    pkrPerUsd: null,
    cnyPerUsd: null,
  });
  assert.equal(sync.expectedCny, null);
  assert.equal(sync.advancePkr, null);
});

test('settle equals source still derives planning counterparts when rates exist', () => {
  const sync = syncPlannedAmounts({
    sourceCurrency: 'USD',
    settlementCurrency: 'USD',
    driver: 'usd',
    plannedUsd: 500,
    expectedCny: null,
    advancePkr: null,
    pkrPerUsd: 280,
    cnyPerUsd: 7.2,
  });
  assert.equal(Number(sync.expectedCny), 3600);
  assert.equal(Number(sync.advancePkr), 140000);
});

test('dirty guard skips locked fields unless forceReplace', () => {
  const sync = syncPlannedAmounts({
    sourceCurrency: 'USD',
    settlementCurrency: 'CNY',
    driver: 'usd',
    plannedUsd: 1000,
    expectedCny: null,
    advancePkr: null,
    pkrPerUsd: 280,
    cnyPerUsd: 7.2,
  });
  const soft = pickSyncedAmountsToApply({
    sync,
    driver: 'usd',
    dirtyUsd: false,
    dirtyCny: true,
    dirtyPkr: false,
    forceReplace: false,
  });
  assert.equal(soft.plannedUsd, null);
  assert.equal(soft.expectedCny, null);
  assert.ok(soft.advancePkr);

  const hard = pickSyncedAmountsToApply({
    sync,
    driver: 'usd',
    dirtyUsd: false,
    dirtyCny: true,
    dirtyPkr: true,
    forceReplace: true,
  });
  assert.equal(hard.plannedUsd, null);
  assert.ok(hard.expectedCny);
  assert.ok(hard.advancePkr);
});

test('planning copy stays non-posted', () => {
  assert.match(PLANNED_CURRENCY_PURCHASE_COPY, /not financially posted/i);
  assert.match(PLANNED_CURRENCY_NO_CONVERT_COPY, /No conversion/i);
});
