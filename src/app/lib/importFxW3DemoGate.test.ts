import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  evaluateImportFxW3DemoActivation,
  isImportFxW3DemoAllowed,
  isLocalDemoHostname,
  readImportFxW3DemoEnvFlag,
} from './importFxW3DemoGate.ts';
import {
  availableDemoAdvancePkr,
  createInitialImportFxW3DemoState,
  DEMO_STORE_HAS_NO_NETWORK,
  deserializeDemoState,
  previewUsdDemo,
  saveDemoAdvanceDraft,
  serializeDemoState,
  simulatePostAdvance,
  simulatePostUsdAcquisition,
  simulateReverseAdvance,
  simulateReverseUsdAcquisition,
} from './importFxW3DemoStore.ts';
import { isPostW3MoneyStageBlocked, isW3MoneyStage } from './importFxCaseW3Helpers.ts';

const here = dirname(fileURLToPath(import.meta.url));

test('1. Demo requires explicit flag', () => {
  assert.equal(readImportFxW3DemoEnvFlag({}), false);
  assert.equal(readImportFxW3DemoEnvFlag({ VITE_IMPORT_FX_W3_DEMO: 'false' }), false);
  assert.equal(readImportFxW3DemoEnvFlag({ VITE_IMPORT_FX_W3_DEMO: 'true' }), true);
  assert.equal(
    isImportFxW3DemoAllowed({ flagOn: false, hostname: 'localhost' }),
    false
  );
});

test('2. Demo rejects non-local hostname', () => {
  assert.equal(isLocalDemoHostname('supabase.dincouture.pk'), false);
  assert.equal(isLocalDemoHostname('dincouture.pk'), false);
  assert.equal(isLocalDemoHostname('localhost'), true);
  assert.equal(isLocalDemoHostname('127.0.0.1'), true);
  assert.equal(
    evaluateImportFxW3DemoActivation({ flagOn: true, hostname: 'app.dincouture.pk' }).allowed,
    false
  );
  assert.equal(
    evaluateImportFxW3DemoActivation({ flagOn: true, hostname: 'localhost' }).allowed,
    true
  );
});

test('3. Demo store never initializes W3 mutation RPC calls', () => {
  assert.equal(DEMO_STORE_HAS_NO_NETWORK, true);
  const storeSrc = readFileSync(join(here, 'importFxW3DemoStore.ts'), 'utf8');
  assert.equal(/from ['"]@?\/?.*supabase/i.test(storeSrc), false);
  assert.equal(storeSrc.includes('.rpc('), false);
  assert.equal(/import\s+\{[^}]*supabase/i.test(storeSrc), false);
  const forbidden = [
    'post_import_fx_agent_advance',
    'post_import_fx_usd_acquisition',
    'reverse_import_fx_agent_advance',
    'reverse_import_fx_usd_acquisition',
    'get_import_fx_case_money_overview',
  ];
  for (const name of forbidden) {
    assert.equal(storeSrc.includes(name), false, `store must not reference ${name}`);
  }
  const pageSrc = readFileSync(
    join(here, '../features/import-fx-case/ImportFxW3DemoPage.tsx'),
    'utf8'
  );
  assert.equal(pageSrc.includes('importFxCaseW3Service'), false);
  assert.equal(pageSrc.includes('postImportFx'), false);
  assert.equal(pageSrc.includes('.rpc('), false);
});

test('4. Demo badge copy is present in UI', () => {
  const pageSrc = readFileSync(
    join(here, '../features/import-fx-case/ImportFxW3DemoPage.tsx'),
    'utf8'
  );
  assert.match(pageSrc, /DEMO — NOT POSTED/);
  assert.match(pageSrc, /W3 DEMO MODE — Nothing on this screen is saved or financially posted/);
  assert.match(pageSrc, /Simulate Post — No Accounting/);
});

test('5. Credit calculation', () => {
  const p = previewUsdDemo('CREDIT', 15_000, 287.5);
  assert.equal(p.carryingPkr, 4_312_500);
  assert.equal(p.advanceAppliedPkr, 0);
  assert.equal(p.agentApCreatedPkr, 4_312_500);
  assert.equal(p.preview.balanced, true);
});

test('6. Advance calculation', () => {
  const p = previewUsdDemo('ADVANCE', 15_000, 287.5);
  assert.equal(p.advanceAppliedPkr, 4_312_500);
  assert.equal(p.agentApCreatedPkr, 0);
});

test('7. Mixed balancing', () => {
  const p = previewUsdDemo('MIXED', 15_000, 287.5, 1_000_000);
  assert.equal(p.advanceAppliedPkr, 1_000_000);
  assert.equal(p.agentApCreatedPkr, 3_312_500);
  assert.equal(p.preview.balanced, true);
  const deb = p.preview.lines.filter((l) => l.side === 'Dr').reduce((s, l) => s + l.amount, 0);
  const cred = p.preview.lines.filter((l) => l.side === 'Cr').reduce((s, l) => s + l.amount, 0);
  assert.equal(deb, cred);
});

test('8. Insufficient advance rejection', () => {
  let state = createInitialImportFxW3DemoState();
  const res = simulatePostUsdAcquisition(state, {
    postingDate: '2026-08-13',
    usdQty: 100,
    pkrPerUsd: 287.5,
    fundingType: 'ADVANCE',
  });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'INSUFFICIENT_ADVANCE');
});

test('9. Duplicate simulation-click protection', () => {
  let state = createInitialImportFxW3DemoState();
  state = saveDemoAdvanceDraft(state, {
    ...state.draftAdvance,
    amountPkr: '1000',
  });
  state = { ...state, busy: true };
  const res = simulatePostAdvance(state);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'DEMO_BUSY');
});

test('10. Simulated reversal', () => {
  let state = createInitialImportFxW3DemoState();
  state = saveDemoAdvanceDraft(state, { ...state.draftAdvance, amountPkr: '5000000' });
  let res = simulatePostAdvance(state);
  assert.equal(res.ok, true);
  state = res.state;
  const advId = state.advances[0].id;
  res = simulatePostUsdAcquisition(state, {
    postingDate: '2026-08-13',
    usdQty: 15_000,
    pkrPerUsd: 287.5,
    fundingType: 'MIXED',
    advanceAppliedPkr: 2_000_000,
  });
  assert.equal(res.ok, true);
  state = res.state;
  const blocked = simulateReverseAdvance(state, advId);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, 'ADVANCE_APPLIED');

  const usdId = state.acquisitions[0].id;
  const rev = simulateReverseUsdAcquisition(state, usdId);
  assert.equal(rev.ok, true);
  state = rev.state;
  assert.equal(state.acquisitions[0].status, 'REVERSED');
  assert.equal(state.walletUsdQty, 0);
  assert.ok(availableDemoAdvancePkr(state) >= 4_999_999);
  assert.equal(state.history.find((h) => h.id === usdId)?.status, 'REVERSED');
});

test('11. Refresh/reset behavior', () => {
  let state = createInitialImportFxW3DemoState();
  state = saveDemoAdvanceDraft(state, { ...state.draftAdvance, amountPkr: '100' });
  const posted = simulatePostAdvance(state);
  assert.equal(posted.ok, true);
  const raw = serializeDemoState(posted.state);
  const restored = deserializeDemoState(raw);
  assert.ok(restored);
  assert.equal(restored!.advances.length, 1);
  // Fresh init (refresh without storage) clears
  const fresh = createInitialImportFxW3DemoState();
  assert.equal(fresh.advances.length, 0);
  assert.equal(fresh.accountingStatus, 'NOT_POSTED');
});

test('12. Production behavior unchanged when flag absent', () => {
  assert.equal(
    evaluateImportFxW3DemoActivation({ flagOn: false, hostname: 'localhost' }).allowed,
    false
  );
  // Real W3 helpers still capability-oriented (stages unchanged)
  assert.equal(isW3MoneyStage('ADVANCE'), true);
  assert.equal(isPostW3MoneyStageBlocked('CHINA_USD_TRANSFER'), true);
});

test('13. W3 real UI remains capability-gated (source contract)', () => {
  const panel = readFileSync(
    join(here, '../features/import-fx-case/ImportFxCaseW3MoneyPanel.tsx'),
    'utf8'
  );
  assert.match(panel, /probeImportFxW3Capability/);
  assert.match(panel, /W3_MIGRATION_NOT_INSTALLED/);
  assert.match(panel, /Confirm & Post|Confirm/);
  assert.equal(panel.includes('Simulate Post — No Accounting'), false);
});

test('14. W4–W6 remain unavailable in demo UI', () => {
  const pageSrc = readFileSync(
    join(here, '../features/import-fx-case/ImportFxW3DemoPage.tsx'),
    'utf8'
  );
  assert.match(pageSrc, /W4 \(disabled\)/);
  assert.match(pageSrc, /W5 \(disabled\)/);
  assert.match(pageSrc, /W6 \(disabled\)/);
  assert.equal(isPostW3MoneyStageBlocked('CHINA_USD_TRANSFER'), true);
  assert.equal(isPostW3MoneyStageBlocked('CNY_POOL'), true);
  assert.equal(isPostW3MoneyStageBlocked('SUPPLIER_ALLOCATION'), true);
});
