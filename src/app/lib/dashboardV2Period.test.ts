import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  priorComparablePeriod,
  formatPeriodLabel,
  trendPercent,
  clampDashboardV2DateRange,
  isDashboardRpcTimeoutMessage,
  dashboardV2ClampLimitation,
} from './dashboardV2Period';

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

test('clampDashboardV2DateRange leaves short ranges alone', () => {
  const r = clampDashboardV2DateRange('2026-01-01', '2026-10-03');
  assert.equal(r.clamped, false);
  assert.equal(r.dateFrom, '2026-01-01');
  assert.equal(r.dateTo, '2026-10-03');
});

test('clampDashboardV2DateRange caps From-start style decade span to calendar year start', () => {
  const r = clampDashboardV2DateRange('2016-01-01', '2026-10-03');
  assert.equal(r.clamped, true);
  assert.equal(r.dateFrom, '2026-01-01');
  assert.equal(r.dateTo, '2026-10-03');
  assert.equal(r.requestedDateFrom, '2016-01-01');
  assert.match(dashboardV2ClampLimitation(r), /Dashboard capped/);
});

test('isDashboardRpcTimeoutMessage detects 57014', () => {
  assert.equal(isDashboardRpcTimeoutMessage('canceling statement due to statement timeout'), true);
  assert.equal(isDashboardRpcTimeoutMessage('code 57014'), true);
  assert.equal(isDashboardRpcTimeoutMessage('permission denied'), false);
});
