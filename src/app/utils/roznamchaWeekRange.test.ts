import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getDaysSinceWeekStart,
  getWeekRangeContaining,
  shiftWeek,
} from './roznamchaWeekRange';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test('getDaysSinceWeekStart for Friday start', () => {
  // Fri=5 → 0, Sat=6 → 1, Sun=0 → 2, Thu=4 → 6
  assert.equal(getDaysSinceWeekStart(5, 5), 0);
  assert.equal(getDaysSinceWeekStart(6, 5), 1);
  assert.equal(getDaysSinceWeekStart(0, 5), 2);
  assert.equal(getDaysSinceWeekStart(4, 5), 6);
});

test('Fri-start week containing a Wednesday is Fri→Thu', () => {
  // 2026-07-22 is Wednesday
  const { startDate, endDate } = getWeekRangeContaining(new Date(2026, 6, 22), 5);
  assert.equal(ymd(startDate), '2026-07-17'); // Friday
  assert.equal(ymd(endDate), '2026-07-23'); // Thursday
});

test('Sat-start week containing a Wednesday is Sat→Fri', () => {
  const { startDate, endDate } = getWeekRangeContaining(new Date(2026, 6, 22), 6);
  assert.equal(ymd(startDate), '2026-07-18'); // Saturday
  assert.equal(ymd(endDate), '2026-07-24'); // Friday
});

test('shiftWeek moves by 7 days (Sat-start week)', () => {
  const base = getWeekRangeContaining(new Date(2026, 6, 22), 6);
  const next = shiftWeek(base, 1);
  const prev = shiftWeek(base, -1);
  assert.equal(ymd(next.startDate), '2026-07-25');
  assert.equal(ymd(next.endDate), '2026-07-31');
  assert.equal(ymd(prev.startDate), '2026-07-11');
  assert.equal(ymd(prev.endDate), '2026-07-17');
});

test('default weekStartsOn is Saturday (Sat→Fri)', () => {
  const { startDate, endDate } = getWeekRangeContaining(new Date(2026, 6, 22));
  assert.equal(ymd(startDate), '2026-07-18'); // Saturday
  assert.equal(ymd(endDate), '2026-07-24'); // Friday
});
