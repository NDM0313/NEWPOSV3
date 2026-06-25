import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  isUnifiedLedgerEnvKillActive,
  isUnifiedLedgerKillSwitchActive,
  resolveUnifiedLedgerEngineState,
  isUnifiedLedgerCompanyEngineEnabled,
} from './unifiedLedgerEngineState';
import { UNIFIED_LEDGER_SCREEN_IDS } from './unifiedLedgerScreenFlags';
import { UNIFIED_LEDGER_FLAG_KEYS } from './unifiedLedgerFlagKeys';

const ENV_KEY = 'VITE_UNIFIED_LEDGER_ENGINE_KILLED';
const savedEnv = process.env[ENV_KEY];

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

function mockReader(flags: Record<string, boolean>) {
  return {
    async isEnabled(_companyId: string, key: string) {
      return flags[key] === true;
    },
  };
}

test('default state is legacy with engine OFF', async () => {
  delete process.env[ENV_KEY];
  const state = await resolveUnifiedLedgerEngineState('company-1', {}, mockReader({}));
  assert.equal(state.mode, 'legacy');
  assert.equal(state.killSwitchActive, false);
  assert.equal(state.companyEngineEnabled, false);
  assert.equal(state.rpcAllowed, false);
});

test('env kill switch forces killed mode', async () => {
  process.env[ENV_KEY] = 'true';
  assert.equal(isUnifiedLedgerEnvKillActive(), true);
  const state = await resolveUnifiedLedgerEngineState('company-1', {}, mockReader({}));
  assert.equal(state.mode, 'killed');
  assert.equal(state.killSwitchActive, true);
  assert.equal(state.rpcAllowed, false);
});

test('kill switch blocks rpc unless shadowForce', async () => {
  process.env[ENV_KEY] = 'true';
  const blocked = await resolveUnifiedLedgerEngineState('c1', {}, mockReader({}));
  assert.equal(blocked.rpcAllowed, false);

  const allowed = await resolveUnifiedLedgerEngineState(
    'c1',
    { shadowForce: true },
    mockReader({})
  );
  assert.equal(allowed.rpcAllowed, true);
  assert.equal(allowed.mode, 'killed');
});

test('DB kill switch forces killed mode', async () => {
  delete process.env[ENV_KEY];
  const reader = mockReader({ [UNIFIED_LEDGER_FLAG_KEYS.KILL_SWITCH]: true });
  assert.equal(await isUnifiedLedgerKillSwitchActive('c1', reader), true);
  const state = await resolveUnifiedLedgerEngineState('c1', {}, reader);
  assert.equal(state.mode, 'killed');
});

test('admin tie-out shows preview when not killed', async () => {
  const state = await resolveUnifiedLedgerEngineState(
    'c1',
    { adminTieOut: true, shadowForce: true },
    mockReader({})
  );
  assert.equal(state.mode, 'preview');
  assert.equal(state.rpcAllowed, true);
});

test('per-screen flag without company engine stays legacy', async () => {
  const state = await resolveUnifiedLedgerEngineState(
    'c1',
    { screenId: UNIFIED_LEDGER_SCREEN_IDS.LEDGER_V2 },
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    })
  );
  assert.equal(state.screenFlagEnabled, true);
  assert.equal(state.companyEngineEnabled, false);
  assert.equal(state.mode, 'legacy');
});

test('company engine ON + screen OFF stays legacy (screen gate)', async () => {
  const state = await resolveUnifiedLedgerEngineState(
    'c1',
    { screenId: UNIFIED_LEDGER_SCREEN_IDS.LEDGER_V2 },
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    })
  );
  assert.equal(state.companyEngineEnabled, true);
  assert.equal(state.screenFlagEnabled, false);
  assert.equal(state.mode, 'legacy');
});

test('company engine ON + screen ON yields unified mode', async () => {
  const state = await resolveUnifiedLedgerEngineState(
    'c1',
    { screenId: UNIFIED_LEDGER_SCREEN_IDS.ACCOUNT_STATEMENT },
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
    })
  );
  assert.equal(state.mode, 'unified');
  assert.equal(state.rpcAllowed, true);
});

test('company engine enabled respects kill switch', async () => {
  process.env[ENV_KEY] = 'true';
  const enabled = await isUnifiedLedgerCompanyEngineEnabled(
    'c1',
    mockReader({ [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true })
  );
  assert.equal(enabled, false);
});

test('company engine enabled when DB flag ON and no kill', async () => {
  delete process.env[ENV_KEY];
  const enabled = await isUnifiedLedgerCompanyEngineEnabled(
    'c1',
    mockReader({ [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true })
  );
  assert.equal(enabled, true);
});
