import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isUnifiedLedgerEngineEnabledSync,
  UNIFIED_LEDGER_ENGINE_DEFAULT,
} from './unifiedLedgerFeatureFlag';

test('unified ledger feature flag defaults OFF', () => {
  assert.equal(UNIFIED_LEDGER_ENGINE_DEFAULT, false);
  // Without localStorage override in node test env
  assert.equal(isUnifiedLedgerEngineEnabledSync(), false);
});
