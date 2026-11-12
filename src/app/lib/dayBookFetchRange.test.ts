import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDayBookFetchRange } from './dayBookFetchRange';
import { clampWideDateRange } from './wideDateRangeClamp';

test('resolveDayBookFetchRange keeps From-start decade span (no year clamp)', () => {
  const r = resolveDayBookFetchRange('2016-01-01', '2026-11-05');
  assert.equal(r.dateFrom, '2016-01-01');
  assert.equal(r.dateTo, '2026-11-05');
  const clamped = clampWideDateRange('2016-01-01', '2026-11-05');
  assert.equal(clamped.clamped, true);
  assert.notEqual(r.dateFrom, clamped.dateFrom);
});
