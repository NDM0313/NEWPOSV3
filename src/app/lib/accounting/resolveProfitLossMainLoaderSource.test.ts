import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  effectiveProfitLossMainLoaderSource,
  resolveProfitLossMainLoaderFromFlags,
  resolveProfitLossMainLoaderSource,
} from './resolveProfitLossMainLoaderSource';
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
    [UNIFIED_LEDGER_FLAG_KEYS.LOADER_PROFIT_LOSS]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_PROFIT_LOSS]: true,
  };
}

test('P&L loader flag OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveProfitLossMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.SCREEN_PROFIT_LOSS]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.reason, 'legacy_loader_off');
});

test('P&L loader ON + engine ON + screen ON → unified', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveProfitLossMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'unified');
  assert.equal(resolved.reason, 'unified_flags_on');
  assert.equal(effectiveProfitLossMainLoaderSource(resolved), 'unified');
});

test('P&L kill switch ON → killed', async () => {
  process.env[ENV_KEY] = 'true';
  const resolved = await resolveProfitLossMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader(allGatesOn()),
  );
  assert.equal(resolved.source, 'killed');
});

test('P&L loader ON but screen OFF → legacy', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveProfitLossMainLoaderSource(
    DIN_CHINA_COMPANY_ID,
    mockReader({
      [UNIFIED_LEDGER_FLAG_KEYS.LOADER_PROFIT_LOSS]: true,
      [UNIFIED_LEDGER_FLAG_KEYS.ENGINE]: true,
    }),
  );
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.reason, 'legacy_screen_off');
});

test('P&L flag read error reader throws → legacy fallback', async () => {
  delete process.env[ENV_KEY];
  const resolved = await resolveProfitLossMainLoaderSource(DIN_CHINA_COMPANY_ID, {
    async isEnabled() {
      throw new Error('db down');
    },
  });
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.reason, 'legacy_error_fallback');
});

test('P&L flag keys follow naming convention', () => {
  assert.equal(UNIFIED_LEDGER_FLAG_KEYS.LOADER_PROFIT_LOSS, 'unified_ledger_loader_profit_loss');
  assert.equal(UNIFIED_LEDGER_FLAG_KEYS.SCREEN_PROFIT_LOSS, 'unified_ledger_screen_profit_loss');
});

test('resolveProfitLossMainLoaderFromFlags unified gate', () => {
  assert.equal(
    resolveProfitLossMainLoaderFromFlags({
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    }),
    'unified',
  );
});
