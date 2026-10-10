import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyOpeningBalanceGap } from './openingBalanceDiagnostics';

test('classifyOpeningBalanceGap detects missing JE', () => {
  const out = classifyOpeningBalanceGap({ operationalOpening: 5000, jeAmount: null, hasJe: false });
  assert.equal(out.status, 'missing_je');
});

test('classifyOpeningBalanceGap detects orphan JE', () => {
  const out = classifyOpeningBalanceGap({ operationalOpening: 0, jeAmount: 3000, hasJe: true });
  assert.equal(out.status, 'orphan_je');
});

test('classifyOpeningBalanceGap marks synced when amounts match', () => {
  const out = classifyOpeningBalanceGap({ operationalOpening: 10000, jeAmount: 10000, hasJe: true });
  assert.equal(out.status, 'synced');
  assert.equal(out.gap, 0);
});

test('classifyOpeningBalanceGap detects amount mismatch', () => {
  const out = classifyOpeningBalanceGap({ operationalOpening: 10000, jeAmount: 8000, hasJe: true });
  assert.equal(out.status, 'amount_mismatch');
  assert.equal(out.gap, 2000);
});
