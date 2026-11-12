import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retargetDateToMonth } from './retargetDateToMonth';

test('retargetDateToMonth changes year while keeping day and time', () => {
  const selected = new Date(2026, 8, 21, 12, 0, 0, 0); // 21 Sep 2026 noon
  const view = new Date(2019, 8, 1);
  const next = retargetDateToMonth(selected, view);
  assert.equal(next.getFullYear(), 2019);
  assert.equal(next.getMonth(), 8);
  assert.equal(next.getDate(), 21);
  assert.equal(next.getHours(), 12);
  assert.equal(next.getMinutes(), 0);
});

test('retargetDateToMonth clamps day for short months', () => {
  const selected = new Date(2026, 0, 31, 9, 30, 0, 0); // 31 Jan
  const view = new Date(2024, 1, 1); // Feb 2024 (leap)
  const next = retargetDateToMonth(selected, view);
  assert.equal(next.getFullYear(), 2024);
  assert.equal(next.getMonth(), 1);
  assert.equal(next.getDate(), 29);
  assert.equal(next.getHours(), 9);
  assert.equal(next.getMinutes(), 30);
});
