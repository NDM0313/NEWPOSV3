import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatQty, formatQtyFixed } from './quantity';

test('formatQty removes float noise with 2 decimals', () => {
  assert.equal(formatQty(-2498.2999999999997), '-2498.30');
  assert.doesNotMatch(formatQty(-2498.2999999999997), /999999/);
  assert.equal(formatQty(-298.0000000000001), '-298.00');
});

test('formatQty always shows 2 decimal places', () => {
  assert.equal(formatQty(0), '0.00');
  assert.equal(formatQty(10), '10.00');
  assert.equal(formatQty(10.5), '10.50');
  assert.equal(formatQty(10.256), '10.26');
});

test('formatQty handles invalid input', () => {
  assert.equal(formatQty(null), '0.00');
  assert.equal(formatQty(undefined), '0.00');
  assert.equal(formatQty(''), '0.00');
});

test('formatQtyFixed matches formatQty', () => {
  assert.equal(formatQtyFixed(-590.9), formatQty(-590.9));
  assert.equal(formatQtyFixed(3), '3.00');
});
