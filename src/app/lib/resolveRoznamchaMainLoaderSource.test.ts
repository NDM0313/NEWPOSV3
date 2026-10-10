import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  effectiveRoznamchaMainLoaderSource,
  resolveRoznamchaMainLoaderFromFlags,
  resolveRoznamchaMainLoaderSource,
} from './resolveRoznamchaMainLoaderSource';
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
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA]: true,
  };
}

test('Roznamcha loader flag OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveRoznamchaMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(effectiveRoznamchaMainLoaderSource(resolved), 'legacy');
});

test('Roznamcha loader ON + engine ON + screen ON → unified main', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveRoznamchaMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'unified');
});

test('Roznamcha kill switch ON → killed (effective legacy)', async () => {
  process.env[ENV_KEY] = 'true';
  const resolved = await resolveRoznamchaMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'killed');
  assert.equal(effectiveRoznamchaMainLoaderSource(resolved), 'legacy');
});

test('Roznamcha loader ON but engine OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveRoznamchaMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
});

test('Roznamcha loader ON but screen OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveRoznamchaMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
});

test('Roznamcha wrong company → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveRoznamchaMainLoaderSource(
    '00000000-0000-0000-0000-000000000099',
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.loaderFlagEnabled, false);
});

test('Roznamcha L1 rollback returns legacy', async () => {
  delete process.env[ENV_KEY];
  const before = await resolveRoznamchaMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(before.source, 'unified');
  const after = await resolveRoznamchaMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA]: true,
    }),
  );
  assert.equal(after.source, 'legacy');
});

test('LV2/AS/TB/PL loaders unaffected by Roznamcha loader only', async () => {
  delete process.env[ENV_KEY];
  const { resolveLedgerV2MainLoaderSource } = await import('./resolveLedgerV2MainLoaderSource');
  const { resolveAccountStatementMainLoaderSource } = await import('./resolveAccountStatementMainLoaderSource');
  const { resolveTrialBalanceMainLoaderSource } = await import('./resolveTrialBalanceMainLoaderSource');
  const { resolvePartyLedgerMainLoaderSource } = await import('./resolvePartyLedgerMainLoaderSource');
  const reader = mockReader({
    ...allGatesOn(),
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ACCOUNT_STATEMENT]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_TRIAL_BALANCE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_PARTY_LEDGER]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_PARTY_LEDGER]: true,
  });
  assert.equal((await resolveRoznamchaMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolveLedgerV2MainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolveAccountStatementMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolveTrialBalanceMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolvePartyLedgerMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
});

test('no Cash/Bank loader flags added in Phase 2.14 keys', () => {
  assert.equal(UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA, 'unified_ledger_loader_roznamcha');
  assert.equal('LOADER_CASH_BANK' in UNIFIED_LEDGER_FLAG_KEYS, false);
});

test('resolveRoznamchaMainLoaderFromFlags priority order', () => {
  assert.equal(
    resolveRoznamchaMainLoaderFromFlags({
      killSwitchActive: true,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'killed',
  );
  assert.equal(
    resolveRoznamchaMainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'unified',
  );
});
