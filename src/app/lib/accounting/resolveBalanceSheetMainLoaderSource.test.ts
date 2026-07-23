import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  effectiveBalanceSheetMainLoaderSource,
  resolveBalanceSheetMainLoaderFromFlags,
  resolveBalanceSheetMainLoaderSource,
} from './resolveBalanceSheetMainLoaderSource';
import { UNIFIED_LEDGER_FLAG_KEYS } from '../unifiedLedgerFlagKeys';
import { DIN_CHINA_COMPANY_ID } from '../unifiedLedgerGoldenFixtures';

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
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_BALANCE_SHEET]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_BALANCE_SHEET]: true,
  };
}

test('Balance Sheet loader flag OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveBalanceSheetMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_BALANCE_SHEET]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.reason, 'legacy_loader_off');
  assert.equal(effectiveBalanceSheetMainLoaderSource(resolved), 'legacy');
});

test('Balance Sheet loader ON + engine ON + screen ON → unified', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveBalanceSheetMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'unified');
  assert.equal(resolved.reason, 'unified_flags_on');
});

test('Balance Sheet kill switch ON → killed', async () => {
  process.env[ENV_KEY] = 'true';
  const resolved = await resolveBalanceSheetMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'killed');
  assert.equal(resolved.reason, 'legacy_kill_switch');
});

test('Balance Sheet loader ON but screen OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveBalanceSheetMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_BALANCE_SHEET]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.reason, 'legacy_screen_off');
});

test('Balance Sheet loader OFF but screen ON → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveBalanceSheetMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_BALANCE_SHEET]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.reason, 'legacy_loader_off');
});

test('Balance Sheet flag keys follow naming convention', () => {
  assert.equal(UNIFIED_LEDGER_FLAG_KEYS.LOADER_BALANCE_SHEET, 'unified_ledger_loader_balance_sheet');
  assert.equal(UNIFIED_LEDGER_FLAG_KEYS.SCREEN_BALANCE_SHEET, 'unified_ledger_screen_balance_sheet');
});

test('resolveBalanceSheetMainLoaderFromFlags priority order', () => {
  assert.equal(
    resolveBalanceSheetMainLoaderFromFlags({
      killSwitchActive: true,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'killed',
  );
  assert.equal(
    resolveBalanceSheetMainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'unified',
  );
});

test('Cash Flow loader unaffected by Balance Sheet loader only', async () => {
  delete process.env[ENV_KEY];
  const { resolveCashFlowMainLoaderSource } = await import('../resolveCashFlowMainLoaderSource');
  const reader = mockReader({
    ...allGatesOn(),
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_CASH_FLOW]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW]: true,
  });
  assert.equal((await resolveBalanceSheetMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
  assert.equal((await resolveCashFlowMainLoaderSource(DIN_CHINA_COMPANY_ID, reader)).source, 'unified');
});
