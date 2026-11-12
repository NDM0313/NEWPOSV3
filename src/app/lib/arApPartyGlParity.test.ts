import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AR_AP_PARTY_GL_OPERATIONAL_BASIS,
  AR_AP_PARTY_GL_PARITY_BASIS,
  computePartyGlMapMaxDelta,
  partyGlParityWithinTolerance,
  resolvePartyGlParityStatus,
} from './arApPartyGlParity.ts';

type Slice = { glArReceivable: number; glApPayable: number; glWorkerPayable: number };

function slice(ar: number, ap: number, wp: number): Slice {
  return { glArReceivable: ar, glApPayable: ap, glWorkerPayable: wp };
}

test('AR/AP production parity baseline defaults to official_gl', () => {
  assert.equal(AR_AP_PARTY_GL_PARITY_BASIS, 'official_gl');
  assert.equal(AR_AP_PARTY_GL_OPERATIONAL_BASIS, 'effective_party');
  assert.notEqual(AR_AP_PARTY_GL_OPERATIONAL_BASIS, AR_AP_PARTY_GL_PARITY_BASIS);
});

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

test('official_gl parity map matching legacy is PASS (Bridal JE-0213 / JV-000203 EP deltas ignored)', () => {
  // Simulated official_gl / legacy align; EP would diverge by 80000 + 150 on other maps.
  const officialGl = new Map([
    ['walkin-old', slice(171500, 0, 0)],
    ['walkin', slice(-150, 0, 0)],
  ]);
  const legacy = new Map([
    ['walkin-old', slice(171500, 0, 0)],
    ['walkin', slice(-150, 0, 0)],
  ]);
  const effectiveParty = new Map([
    ['walkin-old', slice(91500, 0, 0)],
    ['walkin', slice(0, 0, 0)],
  ]);
  assert.equal(computePartyGlMapMaxDelta(officialGl, legacy), 0);
  assert.equal(resolvePartyGlParityStatus(0, { unifiedActive: true, parityMapAvailable: true }), 'pass');
  // Explained EP variance must NOT be the parity gate
  assert.equal(computePartyGlMapMaxDelta(effectiveParty, legacy), 80000);
  assert.equal(resolvePartyGlParityStatus(80000, { unifiedActive: true, parityMapAvailable: true }), 'fail');
});

test('resolvePartyGlParityStatus covers fallback and kill paths', () => {
  assert.equal(resolvePartyGlParityStatus(0, { unifiedActive: false }), 'n_a');
  assert.equal(
    resolvePartyGlParityStatus(undefined, { unifiedActive: true, parityMapAvailable: false }),
    'skipped'
  );
  assert.equal(resolvePartyGlParityStatus(undefined, { unifiedActive: true }), 'skipped');
  assert.equal(resolvePartyGlParityStatus(0.02, { unifiedActive: true, parityMapAvailable: true }), 'fail');
});

test('parity helpers are pure — no GL mutation surface', () => {
  const before = slice(1, 2, 3);
  const map = new Map([['x', before]]);
  computePartyGlMapMaxDelta(map, map);
  resolvePartyGlParityStatus(0, { unifiedActive: true, parityMapAvailable: true });
  assert.deepEqual(map.get('x'), before);
});
