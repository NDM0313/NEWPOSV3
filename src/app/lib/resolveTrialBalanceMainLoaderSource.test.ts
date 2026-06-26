import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  effectiveTrialBalanceMainLoaderSource,
  resolveTrialBalanceMainLoaderFromFlags,
  resolveTrialBalanceMainLoaderSource,
} from './resolveTrialBalanceMainLoaderSource';
import { UNIFIED_LEDGER_FLAG_KEYS } from './unifiedLedgerFlagKeys';
import { DIN_CHINA_COMPANY_ID } from './unifiedLedgerGoldenFixtures';

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

function allGatesOn(): Record<string, boolean> {
  return {
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_TRIAL_BALANCE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE]: true,
  };
}

test('Trial Balance loader flag OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveTrialBalanceMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(effectiveTrialBalanceMainLoaderSource(resolved), 'legacy');
});

test('Trial Balance loader ON + engine ON + screen ON → unified main', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveTrialBalanceMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'unified');
});

test('Trial Balance kill switch ON → killed (effective legacy)', async () => {
  process.env[ENV_KEY] = 'true';
  const resolved = await resolveTrialBalanceMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'killed');
  assert.equal(effectiveTrialBalanceMainLoaderSource(resolved), 'legacy');
});

test('Trial Balance loader ON but engine OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveTrialBalanceMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_TRIAL_BALANCE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
});

test('Trial Balance loader ON but screen OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveTrialBalanceMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_TRIAL_BALANCE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
});

test('Trial Balance wrong company → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveTrialBalanceMainLoaderSource(
    '00000000-0000-0000-0000-000000000099',
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.loaderFlagEnabled, false);
});

test('Trial Balance L1 rollback returns legacy', async () => {
  delete process.env[ENV_KEY];
  const before = await resolveTrialBalanceMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(before.source, 'unified');
  const after = await resolveTrialBalanceMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE]: true,
    }),
  );
  assert.equal(after.source, 'legacy');
});

test('Ledger V2 and Account Statement loaders unaffected by TB loader only', async () => {
  delete process.env[ENV_KEY];
  const { resolveLedgerV2MainLoaderSource } = await import('./resolveLedgerV2MainLoaderSource');
  const { resolveAccountStatementMainLoaderSource } = await import('./resolveAccountStatementMainLoaderSource');
  const reader = mockReader({
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_TRIAL_BALANCE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ACCOUNT_STATEMENT]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
  });
  assert.equal((await resolveTrialBalanceMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolveLedgerV2MainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolveAccountStatementMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
});

test('resolveTrialBalanceMainLoaderFromFlags priority order', () => {
  assert.equal(
    resolveTrialBalanceMainLoaderFromFlags({
      killSwitchActive: true,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'killed',
  );
  assert.equal(
    resolveTrialBalanceMainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'unified',
  );
});
