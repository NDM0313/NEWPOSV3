/**
 * Pure diff helpers for Party Ledger unified preview compare (Phase 2.7).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { balancePasses, diffLedgerRows, round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { CompareRowMismatch, CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import {
  effectivePartyRowKey,
  effectivePartyToCompareSummary,
} from '@/app/lib/effectivePartyLedgerCompareMappers';
import {
  unifiedPartyRowKey,
  unifiedPartyToCompareSummary,
} from '@/app/lib/partyLedgerUnifiedCompareMappers';
import {
  balanceMatchesGolden,
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from '@/app/lib/unifiedLedgerGoldenFixtures';
import type { EffectiveLedgerResult } from '@/app/services/effectivePartyLedgerService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import { defaultUnifiedBasisForPartyLedger } from '@/app/lib/partyLedgerUnifiedPreviewScope';

export type PartyLedgerUnifiedPreviewDiff = {
  oldOpening: number;
  newOpening: number;
  oldClosing: number;
  newClosing: number;
  difference: number;
  totalsPass: boolean;
  pass: boolean;
  missingInNew: CompareRowSummary[];
  extraInNew: CompareRowSummary[];
  amountMismatches: CompareRowMismatch[];
  oldRowCount: number;
  newRowCount: number;
  goldenPass?: boolean;
};

export { defaultUnifiedBasisForPartyLedger };

export function comparePartyLedgerUnifiedPreview(args: {
  legacy: EffectiveLedgerResult;
  unifiedRows: UnifiedLedgerRow[];
  unifiedClosingBalance: number;
  unifiedOpeningBalance: number;
  contactId: string;
}): PartyLedgerUnifiedPreviewDiff {
  const oldOpening = round2(args.legacy.summary.openingBalance);
  const newOpening = round2(args.unifiedOpeningBalance);
  const oldClosing = round2(args.legacy.summary.closingBalance);
  const newClosing = round2(args.unifiedClosingBalance);
  const difference = round2(oldClosing - newClosing);

  const openingDelta = round2(oldOpening - newOpening);
  const totalsPass = balancePasses(difference) && balancePasses(openingDelta);

  const rowDiff = diffLedgerRows({
    oldRows: args.legacy.rows,
    newRows: args.unifiedRows,
    oldKey: effectivePartyRowKey,
    newKey: unifiedPartyRowKey,
    oldToSummary: effectivePartyToCompareSummary,
    newToSummary: unifiedPartyToCompareSummary,
  });

  const hasRowDiffs =
    rowDiff.missingInNew.length > 0 ||
    rowDiff.extraInNew.length > 0 ||
    rowDiff.amountMismatches.length > 0;

  const pass = totalsPass && !hasRowDiffs;

  const goldenPass =
    args.contactId === MR_JALIL_CONTACT_ID
      ? balanceMatchesGolden(MR_JALIL_EXPECTED_BALANCE, newClosing)
      : undefined;

  return {
    oldOpening,
    newOpening,
    oldClosing,
    newClosing,
    difference,
    totalsPass,
    pass,
    missingInNew: rowDiff.missingInNew,
    extraInNew: rowDiff.extraInNew,
    amountMismatches: rowDiff.amountMismatches,
    oldRowCount: args.legacy.rows.length,
    newRowCount: args.unifiedRows.length,
    goldenPass,
  };
}

export function previewBasisFromPartyLedgerMode(
  mode: 'effective' | 'audit',
  showReversals: boolean,
  override?: UnifiedLedgerBasis
): UnifiedLedgerBasis {
  return override ?? defaultUnifiedBasisForPartyLedger(mode, showReversals);
}
