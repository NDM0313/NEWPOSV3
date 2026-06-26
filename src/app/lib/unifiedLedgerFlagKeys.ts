/**
 * Unified ledger feature_flags key constants (no Supabase dependency).
 * Used by resolver, featureFlagsService, and unit tests.
 */

export const UNIFIED_LEDGER_FLAG_KEYS = {
  ENGINE: 'unified_ledger_engine',
  PILOT: 'unified_ledger_pilot',
  KILL_SWITCH: 'unified_ledger_kill_switch',
  /** Phase 2.10 — only this flag switches Ledger V2 default main loader (not engine/screen alone). */
  LOADER_LEDGER_V2: 'unified_ledger_loader_ledger_v2',
  /** Phase 2.11 — only this flag switches Account Statement default main loader. */
  LOADER_ACCOUNT_STATEMENT: 'unified_ledger_loader_account_statement',
  /** Phase 2.12 — only this flag switches Trial Balance default main loader. */
  LOADER_TRIAL_BALANCE: 'unified_ledger_loader_trial_balance',
  /** Phase 2.13 — only this flag switches Party Ledger default main loader. */
  LOADER_PARTY_LEDGER: 'unified_ledger_loader_party_ledger',
  /** Phase 2.14 — only this flag switches Roznamcha default main loader. */
  LOADER_ROZNAMCHA: 'unified_ledger_loader_roznamcha',
  SCREEN_LEDGER_V2: 'unified_ledger_screen_ledger_v2',
  SCREEN_ACCOUNT_STATEMENT: 'unified_ledger_screen_account_statement',
  SCREEN_TRIAL_BALANCE: 'unified_ledger_screen_trial_balance',
  SCREEN_ROZNAMCHA: 'unified_ledger_screen_roznamcha',
  SCREEN_PARTY_LEDGER: 'unified_ledger_screen_party_ledger',
} as const;
