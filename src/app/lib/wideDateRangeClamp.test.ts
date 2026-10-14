import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampWideDateRange,
  isStatementTimeoutMessage,
  wideDateRangeClampLimitation,
} from './wideDateRangeClamp';

test('clampWideDateRange leaves short ranges alone', () => {
  const r = clampWideDateRange('2026-01-01', '2026-10-03');
  assert.equal(r.clamped, false);
  assert.equal(r.dateFrom, '2026-01-01');
  assert.equal(r.dateTo, '2026-10-03');
});

test('clampWideDateRange caps From-start style decade span to calendar year start', () => {
  const r = clampWideDateRange('2016-01-01', '2026-10-03');
  assert.equal(r.clamped, true);
  assert.equal(r.dateFrom, '2026-01-01');
  assert.equal(r.dateTo, '2026-10-03');
  assert.equal(r.requestedDateFrom, '2016-01-01');
  assert.match(wideDateRangeClampLimitation(r, 'Day Book'), /Day Book capped/);
});

test('isStatementTimeoutMessage detects 57014', () => {
  assert.equal(isStatementTimeoutMessage('canceling statement due to statement timeout'), true);
  assert.equal(isStatementTimeoutMessage('code 57014'), true);
  assert.equal(isStatementTimeoutMessage('permission denied'), false);
});
