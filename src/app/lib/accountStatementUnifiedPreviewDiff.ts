/**
 * Pure diff helpers for Account Statement unified preview compare (Phase 2.4).
 */

import type { AccountingStatementMode } from '@/app/lib/accounting/statementEngineTypes';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { AccountLedgerEntry } from '@/app/services/accountingService';
import {
  balancePasses,
  diffLedgerRows,
  legacyAccountRowKey,
  legacyToCompareSummary,
  round2,
  unifiedLedgerRowKey,
  unifiedToCompareSummary,
  type CompareRowSummary,
} from '@/app/lib/unifiedLedgerCompareDiff';
import {
  balanceMatchesGolden,
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from '@/app/lib/unifiedLedgerGoldenFixtures';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import type { AccountStatementPreviewTarget } from '@/app/lib/accountStatementUnifiedPreviewTarget';

export type AccountStatementUnifiedPreviewDiff = {
  oldClosing: number;
  newClosing: number;
  difference: number;
  pass: boolean;
  missingInNew: CompareRowSummary[];
  extraInNew: CompareRowSummary[];
  oldRowCount: number;
  newRowCount: number;
  goldenPass?: boolean;
};

export function defaultUnifiedBasisForAccountStatement(
  target: AccountStatementPreviewTarget,
  viewMode: 'effective' | 'audit'
): UnifiedLedgerBasis {
  if (target.kind === 'account') return 'official_gl';
  if (viewMode === 'audit') return 'audit_full_history';
  return 'effective_party';
}

function closingFromLegacyEntries(rows: AccountLedgerEntry[]): number {
  if (!rows.length) return 0;
  const last = rows[rows.length - 1];
  return round2(Number(last.running_balance ?? (last as { balance?: number }).balance) || 0);
}

function closingFromUnifiedRows(rows: AccountLedgerEntry[]): number {
  return closingFromLegacyEntries(rows);
}

export function compareAccountStatementUnifiedPreview(args: {
  legacyEntries: AccountLedgerEntry[];
  previewEntries: AccountLedgerEntry[];
  previewUnifiedRows?: UnifiedLedgerRow[];
  statementType?: AccountingStatementMode;
  partyId?: string;
}): AccountStatementUnifiedPreviewDiff {
  const oldClosing = closingFromLegacyEntries(args.legacyEntries);
  const newClosing = args.previewUnifiedRows?.length
    ? round2(args.previewUnifiedRows[args.previewUnifiedRows.length - 1].runningBalance)
    : closingFromUnifiedRows(args.previewEntries);
  const difference = round2(oldClosing - newClosing);

  const rowDiff = diffLedgerRows({
    oldRows: args.legacyEntries,
    newRows: args.previewUnifiedRows ?? args.previewEntries,
    oldKey: legacyAccountRowKey,
    newKey: (row) =>
      args.previewUnifiedRows
        ? unifiedLedgerRowKey(row as UnifiedLedgerRow)
        : legacyAccountRowKey(row as AccountLedgerEntry),
    oldToSummary: legacyToCompareSummary,
    newToSummary: (row) =>
      args.previewUnifiedRows
        ? unifiedToCompareSummary(row as UnifiedLedgerRow)
        : legacyToCompareSummary(row as AccountLedgerEntry),
  });

  const goldenPass =
    args.statementType === 'customer' && args.partyId === MR_JALIL_CONTACT_ID
      ? balanceMatchesGolden(MR_JALIL_EXPECTED_BALANCE, newClosing)
      : undefined;

  return {
    oldClosing,
    newClosing,
    difference,
    pass: balancePasses(difference),
    missingInNew: rowDiff.missingInNew,
    extraInNew: rowDiff.extraInNew,
    oldRowCount: args.legacyEntries.length,
    newRowCount: args.previewUnifiedRows?.length ?? args.previewEntries.length,
    goldenPass,
  };
}
