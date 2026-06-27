/**
 * Account Statement — legacy shadow preview loader (Phase 2.11).
 * Used when main table is unified; preview panel loads legacy for side-by-side compare.
 */

import type { AccountLedgerEntry } from '@/app/services/accountingService';
import {
  loadAccountStatementLegacyMain,
  type AccountStatementLegacyLoadParams,
} from '@/app/services/accountStatementLegacyMainService';

export type AccountStatementLegacyShadowPreviewResult = {
  rows: AccountLedgerEntry[];
  closingBalance: number;
  compareSource: 'legacy_shadow';
};

function closingFromEntries(rows: AccountLedgerEntry[]): number {
  if (!rows.length) return 0;
  const last = rows[rows.length - 1];
  return Number(last.running_balance ?? (last as { balance?: number }).balance) || 0;
}

export async function loadAccountStatementLegacyShadowPreview(
  params: AccountStatementLegacyLoadParams,
): Promise<AccountStatementLegacyShadowPreviewResult> {
  const rows = await loadAccountStatementLegacyMain(params);
  return {
    rows,
    closingBalance: closingFromEntries(rows),
    compareSource: 'legacy_shadow',
  };
}
