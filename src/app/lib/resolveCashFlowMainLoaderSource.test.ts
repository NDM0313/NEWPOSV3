import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  effectiveCashFlowMainLoaderSource,
  resolveCashFlowMainLoaderFromFlags,
  resolveCashFlowMainLoaderSource,
} from './resolveCashFlowMainLoaderSource';
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
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_CASH_FLOW]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW]: true,
  };
}

test('Cash Flow loader flag OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveCashFlowMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(effectiveCashFlowMainLoaderSource(resolved), 'legacy');
});

test('Cash Flow loader ON + engine ON + screen ON → unified main', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveCashFlowMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'unified');
});

test('Cash Flow kill switch ON → killed (effective legacy)', async () => {
  process.env[ENV_KEY] = 'true';
  const resolved = await resolveCashFlowMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'killed');
  assert.equal(effectiveCashFlowMainLoaderSource(resolved), 'legacy');
});

test('Cash Flow loader ON but engine OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveCashFlowMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_CASH_FLOW]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
});

test('Cash Flow loader ON but screen OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveCashFlowMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_CASH_FLOW]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
});

test('Cash Flow L1 rollback returns legacy', async () => {
  delete process.env[ENV_KEY];
  const before = await resolveCashFlowMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(before.source, 'unified');
  const after = await resolveCashFlowMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW]: true,
    }),
  );
  assert.equal(after.source, 'legacy');
});

test('five existing loaders unaffected by Cash Flow loader only', async () => {
  delete process.env[ENV_KEY];
  const { resolveRoznamchaMainLoaderSource } = await import('./resolveRoznamchaMainLoaderSource');
  const reader = mockReader({
    ...allGatesOn(),
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA]: true,
  });
  assert.equal((await resolveCashFlowMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolveRoznamchaMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
});

test('Cash Flow flag keys follow naming convention', () => {
  assert.equal(UNIFIED_LEDGER_FLAG_KEYS.LOADER_CASH_FLOW, 'unified_ledger_loader_cash_flow');
  assert.equal(UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW, 'unified_ledger_screen_cash_flow');
});

test('resolveCashFlowMainLoaderFromFlags priority order', () => {
  assert.equal(
    resolveCashFlowMainLoaderFromFlags({
      killSwitchActive: true,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'killed',
  );
  assert.equal(
    resolveCashFlowMainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'unified',
  );
});
