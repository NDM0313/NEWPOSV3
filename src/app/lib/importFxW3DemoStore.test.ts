import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createInitialImportFxW3DemoState,
  DEMO_STORE_HAS_NO_NETWORK,
  runDemoW31Scenario,
} from './importFxW3DemoStore.ts';
import { W31_HOLDING_NOT_AP_COPY } from './importFxCaseW31Helpers.ts';

test('demo store has no network markers', () => {
  assert.equal(DEMO_STORE_HAS_NO_NETWORK, true);
});

test('W3.1 demo: agent hold 50k', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'AGENT_HOLD_50K');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.state.agentHeldUsdQty, 50000);
  assert.equal(r.state.walletUsdQty, 0);
  assert.equal(r.state.accountingStatus, 'NOT_POSTED');
  assert.match(r.receipt!.message, /DEMO — NOT POSTED/);
});

test('W3.1 demo: company wallet 50k', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'COMPANY_WALLET_50K');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.state.walletUsdQty, 50000);
  assert.equal(r.state.agentHeldUsdQty, 0);
});

test('W3.1 demo: third party 50k', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'THIRD_PARTY_50K');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.state.thirdPartyHeldUsdQty, 50000);
});

test('W3.1 demo: split 10+8+5+27', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'SPLIT_10_8_5_27');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const acq = r.state.acquisitions[0];
  assert.equal(acq.retainedUsd, 27000);
  assert.equal(acq.distributedUsd, 23000);
  assert.equal(acq.supplierApReduced, false);
  assert.equal(acq.distributionLines.every((l) => l.blocksSupplierAp), true);
  assert.ok(acq.statusLabels.includes('Partially Distributed'));
  assert.equal(r.state.agentHeldUsdQty, 27000);
});

test('W3.1 demo: supplier intermediary does not reduce AP', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'SUPPLIER_INTERMEDIARY');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const line = r.state.acquisitions[0].distributionLines[0];
  assert.equal(line.blocksSupplierAp, true);
  assert.equal(line.reviewLabel, W31_HOLDING_NOT_AP_COPY);
  assert.equal(r.state.acquisitions[0].supplierApReduced, false);
});

test('W3.1 demo: over-allocation rejects', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'OVER_ALLOCATION');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'SPLIT_MISMATCH');
});

test('W3.1 demo: duplicate client_operation_id replays', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'DUPLICATE_REPLAY');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.receipt?.replayed, true);
  assert.equal(r.state.acquisitions.length, 1);
});

test('W3.1 demo: reverse blocked after downstream consume', () => {
  const r = runDemoW31Scenario(createInitialImportFxW3DemoState(), 'REVERSE_BLOCKED');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'DOWNSTREAM_CONSUMED');
});
