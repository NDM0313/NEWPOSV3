import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveContactListBalance, type ContactPartyGlSlice } from './contactBalancesRpc';

const arSlice = (ar: number): ContactPartyGlSlice => ({
  glArReceivable: ar,
  glApPayable: 0,
  glWorkerPayable: 0,
});

test('resolveContactListBalance prefers non-zero GL', () => {
  const bal = resolveContactListBalance({
    opening: 0,
    contactType: 'customer',
    listRole: 'customer',
    glOk: true,
    glSlice: arSlice(1500),
    opRow: { receivables: 99, payables: 0 },
  });
  assert.equal(bal, 1500);
});

test('resolveContactListBalance empty GL map path uses operational fill', () => {
  const bal = resolveContactListBalance({
    opening: 0,
    contactType: 'customer',
    listRole: 'customer',
    glOk: true,
    glSlice: undefined,
    opRow: { receivables: 4200, payables: 0 },
  });
  assert.equal(bal, 4200);
});

test('resolveContactListBalance zero GL slice fills from operational', () => {
  const bal = resolveContactListBalance({
    opening: 50,
    contactType: 'customer',
    listRole: 'customer',
    glOk: true,
    glSlice: arSlice(0),
    opRow: { receivables: 800, payables: 0 },
  });
  assert.equal(bal, 800);
});

test('resolveContactListBalance missing slice and op falls back to opening', () => {
  const bal = resolveContactListBalance({
    opening: 125,
    contactType: 'customer',
    listRole: 'customer',
    glOk: true,
    glSlice: undefined,
    opRow: undefined,
  });
  assert.equal(bal, 125);
});

test('resolveContactListBalance GL error uses operational then opening', () => {
  const fromOp = resolveContactListBalance({
    opening: 10,
    contactType: 'supplier',
    listRole: 'supplier',
    glOk: false,
    glSlice: undefined,
    opRow: { receivables: 0, payables: 300 },
  });
  assert.equal(fromOp, 300);

  const fromOpening = resolveContactListBalance({
    opening: 10,
    contactType: 'supplier',
    listRole: 'supplier',
    glOk: false,
    glSlice: undefined,
    opRow: undefined,
  });
  assert.equal(fromOpening, 10);
});
