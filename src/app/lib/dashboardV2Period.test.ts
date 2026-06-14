import assert from 'node:assert/strict';
import { test } from 'node:test';
import { priorComparablePeriod, formatPeriodLabel, trendPercent } from './dashboardV2Period';

test('priorComparablePeriod returns equal-length window before start', () => {
  const prior = priorComparablePeriod('2026-06-01', '2026-06-07');
  assert.equal(prior.to, '2026-05-31');
  assert.equal(prior.from, '2026-05-25');
});

test('formatPeriodLabel shows range', () => {
  assert.match(formatPeriodLabel('2026-06-01', '2026-06-07'), /2026-06-01/);
});

test('trendPercent handles zero prior', () => {
  assert.equal(trendPercent(100, 0), null);
  assert.equal(trendPercent(50, 25), 100);
});
