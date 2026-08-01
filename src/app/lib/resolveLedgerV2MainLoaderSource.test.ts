import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  effectiveLedgerV2MainLoaderSource,
  resolveLedgerV2MainLoaderFromFlags,
  resolveLedgerV2MainLoaderSource,
} from './resolveLedgerV2MainLoaderSource';
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
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
  };
}

test('loader flag OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const reader = mockReader({
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
  });
  const resolved = await resolveLedgerV2MainLoaderSource(DIN_CHINA_COMPANY_ID, reader);
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.loaderFlagEnabled, false);
  assert.equal(effectiveLedgerV2MainLoaderSource(resolved), 'legacy');
});

test('loader ON + engine ON + screen ON → unified main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveLedgerV2MainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'unified');
  assert.equal(effectiveLedgerV2MainLoaderSource(resolved), 'unified');
});

test('kill switch ON → killed (effective legacy)', async () => {
  process.env[ENV_KEY] = 'true';
  const resolved = await resolveLedgerV2MainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'killed');
  assert.equal(resolved.killSwitchActive, true);
  assert.equal(effectiveLedgerV2MainLoaderSource(resolved), 'legacy');
});

test('loader ON but engine OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveLedgerV2MainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.companyEngineEnabled, false);
});

test('loader ON but screen OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveLedgerV2MainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.screenFlagEnabled, false);
});

test('wrong company without loader flag → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';
  const resolved = await resolveLedgerV2MainLoaderSource(
    otherCompanyId,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.loaderFlagEnabled, false);
});

test('L1 rollback — loader flag OFF returns legacy even when engine+screen ON', async () => {
  delete process.env[ENV_KEY];
  const before = await resolveLedgerV2MainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(before.source, 'unified');

  const afterRollback = await resolveLedgerV2MainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    }),
  );
  assert.equal(afterRollback.source, 'legacy');
  assert.equal(effectiveLedgerV2MainLoaderSource(afterRollback), 'legacy');
});

test('resolveLedgerV2MainLoaderFromFlags priority order', () => {
  assert.equal(
    resolveLedgerV2MainLoaderFromFlags({
      killSwitchActive: true,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'killed',
  );
  assert.equal(
    resolveLedgerV2MainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: false,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'legacy',
  );
  assert.equal(
    resolveLedgerV2MainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'unified',
  );
});

test('empty company id → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveLedgerV2MainLoaderSource('', mockReader(allGatesOn()));
  assert.equal(resolved.source, 'legacy');
});
