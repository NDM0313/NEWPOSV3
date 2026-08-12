import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INDICATIVE_RATE_HELPER_COPY,
  formatIndicativeRateLabel,
  invertQuotePerBase,
  mapOpenErRatesToIndicativeBundle,
  pickIndicativeFieldsToApply,
  rateToInputString,
  fetchIndicativeRates,
} from './importFxIndicativeRates';

test('invertQuotePerBase converts quote-per-base to base-per-quote', () => {
  assert.equal(invertQuotePerBase(0.0036), Math.round((1 / 0.0036) * 100) / 100);
  assert.ok(Number.isNaN(invertQuotePerBase(0)));
});

test('PKR base maps USD and CNY planning rates', () => {
  const bundle = mapOpenErRatesToIndicativeBundle({
    baseCurrency: 'PKR',
    rates: { USD: 0.0035, CNY: 0.025, EUR: 0.0032 },
    fetchedAt: '2026-08-12T00:00:00.000Z',
  });
  assert.equal(bundle.baseCurrency, 'PKR');
  assert.ok(bundle.pkrPerUsd != null && bundle.pkrPerUsd > 200);
  assert.equal(bundle.pkrPerUsd, bundle.basePerUsd);
  assert.ok(bundle.basePerCny != null && bundle.basePerCny > 30);
  assert.ok(bundle.cnyPerUsd != null);
  assert.equal(bundle.cnyPerUsd, Math.round((0.025 / 0.0035) * 10000) / 10000);
});

test('USD base maps PKR and CNY per USD directly', () => {
  const bundle = mapOpenErRatesToIndicativeBundle({
    baseCurrency: 'USD',
    rates: { PKR: 280.5, CNY: 7.2, EUR: 0.92 },
  });
  assert.equal(bundle.baseCurrency, 'USD');
  assert.equal(bundle.basePerUsd, 1);
  assert.equal(bundle.pkrPerUsd, 280.5);
  assert.equal(bundle.cnyPerUsd, 7.2);
  assert.ok(bundle.basePerCny != null);
});

test('RMB normalizes to CNY in rate table keys', () => {
  const bundle = mapOpenErRatesToIndicativeBundle({
    baseCurrency: 'pkr',
    rates: { usd: 0.0035, rmb: 0.025 },
  });
  assert.equal(bundle.baseCurrency, 'PKR');
  assert.ok(bundle.basePerCny != null);
  assert.ok(bundle.cnyPerUsd != null);
});

test('labels are base-relative', () => {
  assert.equal(formatIndicativeRateLabel('PKR', 'USD'), 'Indicative PKR per USD');
  assert.equal(formatIndicativeRateLabel('USD', 'CNY'), 'Indicative USD per CNY');
  assert.equal(formatIndicativeRateLabel('USD', 'RMB'), 'Indicative USD per CNY');
});

test('dirty guard skips fields unless forceReplace', () => {
  const bundle = mapOpenErRatesToIndicativeBundle({
    baseCurrency: 'PKR',
    rates: { USD: 0.0035, CNY: 0.025 },
  });
  const soft = pickIndicativeFieldsToApply({
    bundle,
    dirtyPkrPerUsd: true,
    dirtyCnyPerUsd: false,
    forceReplace: false,
  });
  assert.equal(soft.pkrPerUsd, null);
  assert.ok(soft.cnyPerUsd);

  const hard = pickIndicativeFieldsToApply({
    bundle,
    dirtyPkrPerUsd: true,
    dirtyCnyPerUsd: true,
    forceReplace: true,
  });
  assert.ok(hard.pkrPerUsd);
  assert.ok(hard.cnyPerUsd);
});

test('soft fill skips non-empty fields even when not dirty', () => {
  const bundle = mapOpenErRatesToIndicativeBundle({
    baseCurrency: 'PKR',
    rates: { USD: 0.0035, CNY: 0.025 },
  });
  const soft = pickIndicativeFieldsToApply({
    bundle,
    dirtyPkrPerUsd: false,
    dirtyCnyPerUsd: false,
    forceReplace: false,
    currentPkrPerUsd: '278',
    currentCnyPerUsd: '',
  });
  assert.equal(soft.pkrPerUsd, null);
  assert.ok(soft.cnyPerUsd);
});

test('helper copy stays planning-only', () => {
  assert.match(INDICATIVE_RATE_HELPER_COPY, /not financially posted/i);
  assert.match(INDICATIVE_RATE_HELPER_COPY, /change/i);
});

test('rateToInputString formats positive rates only', () => {
  assert.equal(rateToInputString(280), '280');
  assert.equal(rateToInputString(null), '');
  assert.equal(rateToInputString(0), '');
});

test('fetchIndicativeRates uses injected fetch and maps body', async () => {
  const fakeFetch: typeof fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        result: 'success',
        base_code: 'PKR',
        rates: { USD: 0.0035, CNY: 0.025 },
      }),
    }) as Response;

  const bundle = await fetchIndicativeRates(
    { baseCurrency: 'PKR' },
    { fetchImpl: fakeFetch, timeoutMs: 2000 }
  );
  assert.equal(bundle.baseCurrency, 'PKR');
  assert.ok(bundle.pkrPerUsd);
  assert.ok(bundle.cnyPerUsd);
});

test('fetchIndicativeRates surfaces manual-entry guidance on failure', async () => {
  const fakeFetch: typeof fetch = async () => {
    throw new Error('network down');
  };
  await assert.rejects(
    () => fetchIndicativeRates({ baseCurrency: 'PKR' }, { fetchImpl: fakeFetch, timeoutMs: 500 }),
    /manually/i
  );
});
