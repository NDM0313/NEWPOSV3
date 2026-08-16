/**
 * Per-screen unified ledger feature flag keys (scaffold for Phase 2.3+).
 * No row in feature_flags = OFF. PR 2.1 reads only — never writes.
 */

export const UNIFIED_LEDGER_SCREEN_IDS = {
  LEDGER_V2: 'ledger_v2',
  ACCOUNT_STATEMENT: 'account_statement',
  TRIAL_BALANCE: 'trial_balance',
  ROZNAMCHA: 'roznamcha',
  PARTY_LEDGER: 'party_ledger',
  CASH_FLOW: 'cash_flow',
  BALANCE_SHEET: 'balance_sheet',
  PROFIT_LOSS: 'profit_loss',
} as const;

export type UnifiedLedgerScreenId =
  (typeof UNIFIED_LEDGER_SCREEN_IDS)[keyof typeof UNIFIED_LEDGER_SCREEN_IDS];

/** Company-scoped feature_flags keys for per-screen rollout gates. */
export const UNIFIED_LEDGER_SCREEN_FLAG_KEYS: Record<UnifiedLedgerScreenId, string> = {
  ledger_v2: 'unified_ledger_screen_ledger_v2',
  account_statement: 'unified_ledger_screen_account_statement',
  trial_balance: 'unified_ledger_screen_trial_balance',
  roznamcha: 'unified_ledger_screen_roznamcha',
  party_ledger: 'unified_ledger_screen_party_ledger',
  cash_flow: 'unified_ledger_screen_cash_flow',
  balance_sheet: 'unified_ledger_screen_balance_sheet',
  profit_loss: 'unified_ledger_screen_profit_loss',
};

export function unifiedLedgerScreenFlagKey(screenId: UnifiedLedgerScreenId): string {
  return UNIFIED_LEDGER_SCREEN_FLAG_KEYS[screenId];
}
