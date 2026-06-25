/**
 * Unified ledger feature_flags key constants (no Supabase dependency).
 * Used by resolver, featureFlagsService, and unit tests.
 */

export const UNIFIED_LEDGER_FLAG_KEYS = {
  ENGINE: 'unified_ledger_engine',
  PILOT: 'unified_ledger_pilot',
  KILL_SWITCH: 'unified_ledger_kill_switch',
  SCREEN_LEDGER_V2: 'unified_ledger_screen_ledger_v2',
  SCREEN_ACCOUNT_STATEMENT: 'unified_ledger_screen_account_statement',
  SCREEN_TRIAL_BALANCE: 'unified_ledger_screen_trial_balance',
  SCREEN_ROZNAMCHA: 'unified_ledger_screen_roznamcha',
  SCREEN_PARTY_LEDGER: 'unified_ledger_screen_party_ledger',
} as const;
