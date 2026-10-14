import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isUnifiedLedgerEngineEnabledSync,
  UNIFIED_LEDGER_ENGINE_DEFAULT,
} from './unifiedLedgerFeatureFlag';
import { isUnifiedLedgerCompanyEngineEnabled } from './unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from './unifiedLedgerFlagKeys';

test('unified ledger feature flag defaults OFF', () => {
  assert.equal(UNIFIED_LEDGER_ENGINE_DEFAULT, false);
  // Without localStorage override in node test env
  assert.equal(isUnifiedLedgerEngineEnabledSync(), false);
});

test('isUnifiedLedgerCompanyEngineEnabled is false with no DB rows', async () => {
  const reader = {
    async isEnabled() {
      return false;
    },
  };
  assert.equal(await isUnifiedLedgerCompanyEngineEnabled('company-x', reader), false);
});

test('isUnifiedLedgerCompanyEngineEnabled is false when engine key missing', async () => {
  const reader = {
    async isEnabled(_companyId: string, key: string) {
      return key === UNIFIED_LEDGER_FLAG_KEYS.PILOT;
    },
  };
  assert.equal(await isUnifiedLedgerCompanyEngineEnabled('company-x', reader), false);
});
