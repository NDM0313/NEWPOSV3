/** Unified ledger feature flag keys — mirrors web src/app/lib/unifiedLedgerFlagKeys.ts */

export const UNIFIED_LEDGER_FLAG_KEYS = {
  ENGINE: 'unified_ledger_engine',
  PILOT: 'unified_ledger_pilot',
  KILL_SWITCH: 'unified_ledger_kill_switch',
  LOADER_LEDGER_V2: 'unified_ledger_loader_ledger_v2',
  LOADER_ACCOUNT_STATEMENT: 'unified_ledger_loader_account_statement',
  LOADER_TRIAL_BALANCE: 'unified_ledger_loader_trial_balance',
  LOADER_PARTY_LEDGER: 'unified_ledger_loader_party_ledger',
  LOADER_ROZNAMCHA: 'unified_ledger_loader_roznamcha',
  LOADER_CASH_FLOW: 'unified_ledger_loader_cash_flow',
  LOADER_BALANCE_SHEET: 'unified_ledger_loader_balance_sheet',
  LOADER_PROFIT_LOSS: 'unified_ledger_loader_profit_loss',
  SCREEN_LEDGER_V2: 'unified_ledger_screen_ledger_v2',
  SCREEN_ACCOUNT_STATEMENT: 'unified_ledger_screen_account_statement',
  SCREEN_TRIAL_BALANCE: 'unified_ledger_screen_trial_balance',
  SCREEN_PARTY_LEDGER: 'unified_ledger_screen_party_ledger',
  SCREEN_ROZNAMCHA: 'unified_ledger_screen_roznamcha',
  SCREEN_CASH_FLOW: 'unified_ledger_screen_cash_flow',
  SCREEN_BALANCE_SHEET: 'unified_ledger_screen_balance_sheet',
  SCREEN_PROFIT_LOSS: 'unified_ledger_screen_profit_loss',
} as const;

export type UnifiedReportScreenId =
  | 'balance_sheet'
  | 'profit_loss'
  | 'trial_balance'
  | 'cash_flow'
  | 'account_statement'
  | 'ledger_v2'
  | 'party_ledger'
  | 'roznamcha';

const SCREEN_TO_LOADER: Record<UnifiedReportScreenId, string> = {
  balance_sheet: UNIFIED_LEDGER_FLAG_KEYS.LOADER_BALANCE_SHEET,
  profit_loss: UNIFIED_LEDGER_FLAG_KEYS.LOADER_PROFIT_LOSS,
  trial_balance: UNIFIED_LEDGER_FLAG_KEYS.LOADER_TRIAL_BALANCE,
  cash_flow: UNIFIED_LEDGER_FLAG_KEYS.LOADER_CASH_FLOW,
  account_statement: UNIFIED_LEDGER_FLAG_KEYS.LOADER_ACCOUNT_STATEMENT,
  ledger_v2: UNIFIED_LEDGER_FLAG_KEYS.LOADER_LEDGER_V2,
  party_ledger: UNIFIED_LEDGER_FLAG_KEYS.LOADER_PARTY_LEDGER,
  roznamcha: UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA,
};

const SCREEN_TO_SCREEN_FLAG: Record<UnifiedReportScreenId, string> = {
  balance_sheet: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_BALANCE_SHEET,
  profit_loss: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_PROFIT_LOSS,
  trial_balance: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE,
  cash_flow: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW,
  account_statement: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT,
  ledger_v2: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_LEDGER_V2,
  party_ledger: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_PARTY_LEDGER,
  roznamcha: UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA,
};

export function unifiedLoaderFlagKey(screenId: UnifiedReportScreenId): string {
  return SCREEN_TO_LOADER[screenId];
}

export function unifiedScreenFlagKey(screenId: UnifiedReportScreenId): string {
  return SCREEN_TO_SCREEN_FLAG[screenId];
}
