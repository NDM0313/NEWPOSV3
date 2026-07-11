import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computePartyGlMapMaxDelta,
  partyGlParityWithinTolerance,
} from './arApPartyGlParity.ts';

type Slice = { glArReceivable: number; glApPayable: number; glWorkerPayable: number };

function slice(ar: number, ap: number, wp: number): Slice {
  return { glArReceivable: ar, glApPayable: ap, glWorkerPayable: wp };
}

test('computePartyGlMapMaxDelta picks largest per-contact column delta', () => {
  const unified = new Map([
    ['a', slice(100, 50, 0)],
    ['b', slice(0, 200, 10)],
  ]);
  const legacy = new Map([
    ['a', slice(100.005, 50, 0)],
    ['b', slice(0, 195, 10)],
  ]);
  assert.equal(computePartyGlMapMaxDelta(unified, legacy), 5);
});

test('computePartyGlMapMaxDelta includes contacts only on one side as zero baseline', () => {
  const unified = new Map([['only-unified', slice(10, 0, 0)]]);
  const legacy = new Map<string, Slice>();
  assert.equal(computePartyGlMapMaxDelta(unified, legacy), 10);
});

test('partyGlParityWithinTolerance uses default 0.01 materiality', () => {
  assert.equal(partyGlParityWithinTolerance(undefined), true);
  assert.equal(partyGlParityWithinTolerance(0.01), true);
  assert.equal(partyGlParityWithinTolerance(0.0101), false);
});
