import assert from 'node:assert/strict';
import test from 'node:test';
import { isWebSaveTimingEnabled, webSaveTimingMark, webSaveTimingStart } from './webSaveTiming.ts';

test('webSaveTiming helpers return numeric timestamps', () => {
  const t0 = webSaveTimingStart('sale:save');
  assert.equal(typeof t0, 'number');
  const t1 = webSaveTimingMark('sale:items', t0);
  assert.equal(typeof t1, 'number');
  assert.ok(t1 >= t0);
});

test('isWebSaveTimingEnabled is boolean', () => {
  assert.equal(typeof isWebSaveTimingEnabled(), 'boolean');
});
