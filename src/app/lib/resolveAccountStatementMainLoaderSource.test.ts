import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  effectiveAccountStatementMainLoaderSource,
  resolveAccountStatementMainLoaderFromFlags,
  resolveAccountStatementMainLoaderSource,
} from './resolveAccountStatementMainLoaderSource';
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
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ACCOUNT_STATEMENT]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
  };
}

test('Account Statement loader flag OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const reader = mockReader({
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
  });
  const resolved = await resolveAccountStatementMainLoaderSource(DIN_CHINA_COMPANY_ID, reader);
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.loaderFlagEnabled, false);
  assert.equal(effectiveAccountStatementMainLoaderSource(resolved), 'legacy');
});

test('Account Statement loader ON + engine ON + screen ON → unified main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveAccountStatementMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'unified');
  assert.equal(effectiveAccountStatementMainLoaderSource(resolved), 'unified');
});

test('Account Statement kill switch ON → killed (effective legacy)', async () => {
  process.env[ENV_KEY] = 'true';
  const resolved = await resolveAccountStatementMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'killed');
  assert.equal(resolved.killSwitchActive, true);
  assert.equal(effectiveAccountStatementMainLoaderSource(resolved), 'legacy');
});

test('Account Statement loader ON but engine OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveAccountStatementMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ACCOUNT_STATEMENT]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.companyEngineEnabled, false);
});

test('Account Statement loader ON but screen OFF → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveAccountStatementMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_ACCOUNT_STATEMENT]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.screenFlagEnabled, false);
});

test('Account Statement wrong company without loader flag → legacy main table', async () => {
  delete process.env[ENV_KEY];
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';
  const resolved = await resolveAccountStatementMainLoaderSource(
    otherCompanyId,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.loaderFlagEnabled, false);
});

test('Account Statement L1 rollback — loader flag OFF returns legacy even when engine+screen ON', async () => {
  delete process.env[ENV_KEY];
  const before = await resolveAccountStatementMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(before.source, 'unified');

  const afterRollback = await resolveAccountStatementMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT]: true,
    }),
  );
  assert.equal(afterRollback.source, 'legacy');
  assert.equal(effectiveAccountStatementMainLoaderSource(afterRollback), 'legacy');
});

test('resolveAccountStatementMainLoaderFromFlags priority order', () => {
  assert.equal(
    resolveAccountStatementMainLoaderFromFlags({
      killSwitchActive: true,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'killed',
  );
  assert.equal(
    resolveAccountStatementMainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: false,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'legacy',
  );
  assert.equal(
    resolveAccountStatementMainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'unified',
  );
});

test('Account Statement empty company id → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveAccountStatementMainLoaderSource('', mockReader(allGatesOn()));
  assert.equal(resolved.source, 'legacy');
});

test('Ledger V2 loader flag unchanged — separate from Account Statement', async () => {
  delete process.env[ENV_KEY];
  const { resolveLedgerV2MainLoaderSource } = await import('./resolveLedgerV2MainLoaderSource');
  const ledgerV2 = await resolveLedgerV2MainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    }),
  );
  assert.equal(ledgerV2.source, 'unified');
  const accountStmt = await resolveAccountStatementMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2]: true,
    }),
  );
  assert.equal(accountStmt.source, 'legacy');
});
