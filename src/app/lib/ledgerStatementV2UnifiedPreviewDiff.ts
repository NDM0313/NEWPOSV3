/**
 * Pure diff helpers for Ledger V2 unified preview compare (Phase 2.3).
 */

import type { LedgerStatementV2Row, LedgerStatementV2Type } from '@/app/features/ledger-statement-center-v2/types';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import {
  balancePasses,
  diffLedgerRows,
  round2,
  type CompareRowSummary,
} from '@/app/lib/unifiedLedgerCompareDiff';
import {
  balanceMatchesGolden,
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from '@/app/lib/unifiedLedgerGoldenFixtures';

export type LedgerV2UnifiedPreviewDiff = {
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

export function defaultUnifiedBasisForV2Type(statementType: LedgerStatementV2Type): UnifiedLedgerBasis {
  return statementType === 'account' ? 'official_gl' : 'effective_party';
}

function ledgerV2RowKey(row: LedgerStatementV2Row): string {
  return row.id || row.journalEntryId || `${row.date}-${row.referenceNo}`;
}

function ledgerV2ToCompareSummary(row: LedgerStatementV2Row): CompareRowSummary {
  return {
    journalEntryId: row.journalEntryId || row.id,
    entryNo: row.referenceNo === '—' ? null : row.referenceNo,
    entryDate: row.date,
    referenceType: row.transactionType,
    debit: round2(row.debit),
    credit: round2(row.credit),
    description: row.description,
  };
}

function closingFromV2Rows(rows: LedgerStatementV2Row[]): number {
  if (!rows.length) return 0;
  return round2(rows[rows.length - 1].runningBalance);
}

export function compareLedgerV2UnifiedPreview(args: {
  legacyRows: LedgerStatementV2Row[];
  previewRows: LedgerStatementV2Row[];
  statementType?: LedgerStatementV2Type;
  entityId?: string;
}): LedgerV2UnifiedPreviewDiff {
  const oldClosing = closingFromV2Rows(args.legacyRows);
  const newClosing = closingFromV2Rows(args.previewRows);
  const difference = round2(oldClosing - newClosing);
  const rowDiff = diffLedgerRows({
    oldRows: args.legacyRows,
    newRows: args.previewRows,
    oldKey: ledgerV2RowKey,
    newKey: ledgerV2RowKey,
    oldToSummary: ledgerV2ToCompareSummary,
    newToSummary: ledgerV2ToCompareSummary,
  });

  const goldenPass =
    args.statementType === 'customer' &&
    args.entityId === MR_JALIL_CONTACT_ID
      ? balanceMatchesGolden(MR_JALIL_EXPECTED_BALANCE, newClosing)
      : undefined;

  return {
    oldClosing,
    newClosing,
    difference,
    pass: balancePasses(difference),
    missingInNew: rowDiff.missingInNew,
    extraInNew: rowDiff.extraInNew,
    oldRowCount: args.legacyRows.length,
    newRowCount: args.previewRows.length,
    goldenPass,
  };
}
