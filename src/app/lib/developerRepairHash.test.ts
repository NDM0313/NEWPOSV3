import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeDryRunHash, fnv1aHash, stableRepairJson } from './developerRepairHash';

test('stableRepairJson sorts keys', () => {
  assert.equal(stableRepairJson({ b: 1, a: 2 }), stableRepairJson({ a: 2, b: 1 }));
});

test('computeDryRunHash is stable for same input', () => {
  const before = { sequenceLast: 5, documentType: 'PAYMENT' };
  const h1 = computeDryRunHash('numbering.sync_sequence_to_effective_max', { documentType: 'PAYMENT' }, before);
  const h2 = computeDryRunHash('numbering.sync_sequence_to_effective_max', { documentType: 'PAYMENT' }, before);
  assert.equal(h1, h2);
  assert.match(fnv1aHash('test'), /^[0-9a-f]{8}$/);
});

test('computeDryRunHash changes when before changes', () => {
  const h1 = computeDryRunHash('x', {}, { a: 1 });
  const h2 = computeDryRunHash('x', {}, { a: 2 });
  assert.notEqual(h1, h2);
});
