/**
 * Map unified TB RPC accounts → TrialBalanceRow for preview display (Phase 2.5).
 */

import type { TrialBalanceRow } from '@/app/services/accountingReportsService';
import type { UnifiedTrialBalanceAccount } from '@/app/services/unifiedLedgerService';

export function mapUnifiedAccountToTrialBalanceRow(acc: UnifiedTrialBalanceAccount): TrialBalanceRow {
  return {
    account_id: acc.accountId,
    account_code: acc.accountCode || '',
    account_name: acc.accountName || '',
    account_type: acc.accountType || '',
    debit: acc.totalDebit,
    credit: acc.totalCredit,
    balance: acc.netBalance,
  };
}

export function mapUnifiedAccountsToTrialBalanceRows(
  accounts: UnifiedTrialBalanceAccount[]
): TrialBalanceRow[] {
  return accounts.map(mapUnifiedAccountToTrialBalanceRow);
}
