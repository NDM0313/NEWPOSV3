/**
 * Unified Core Ledger — developer tie-out comparison (shadow only).
 */

import { normalizeCompareDateRange } from '@/app/components/admin/unified-ledger-compare/compareFilters';
import {
  closingBalanceFromLegacyRows,
  diffLedgerRows,
  legacyPartyCompareRowKey,
  legacyToCompareSummary,
  round2,
} from '@/app/lib/unifiedLedgerCompareDiff';
import { isJe0168ClassReversal } from '@/app/lib/unifiedLedgerBasisFilter';
import {
  unifiedPartyRowKey,
  unifiedPartyToTieOutSummary,
} from '@/app/lib/partyLedgerUnifiedCompareMappers';
import {
  getUnifiedPartyLedger,
  loadLegacyPartyLedgerForTieOut,
  type UnifiedLedgerBasis,
  type UnifiedPartyType,
} from '@/app/services/unifiedLedgerService';

export type TieOutRowKey = {
  journalEntryId: string;
  journalEntryLineId?: string;
  entryNo?: string | null;
};

export type TieOutCompareResult = {
  oldBalance: number;
  newBalance: number;
  difference: number;
  oldRowCount: number;
  newRowCount: number;
  missingInNew: TieOutRowSummary[];
  extraInNew: TieOutRowSummary[];
  basis: UnifiedLedgerBasis;
  branchId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  contactId: string;
  partyType: UnifiedPartyType;
  oldEngineName: string;
  newEngineName: string;
  oldQueryMs: number;
  newQueryMs: number;
  correctionReversalInOld: number;
  correctionReversalInNew: number;
  correctionReversalHiddenInEffective: boolean;
};

export type TieOutRowSummary = {
  journalEntryId: string;
  entryNo: string | null;
  entryDate: string;
  referenceType: string | null;
  debit: number;
  credit: number;
  description: string;
};

export async function comparePartyLedgerTieOut(params: {
  companyId: string;
  partyType: UnifiedPartyType;
  contactId: string;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  basis: UnifiedLedgerBasis;
  /** Compare Account Statements hybrid vs unified (default: GL RPC path) */
  useHybridOldEngine?: boolean;
}): Promise<TieOutCompareResult> {
  const dates = normalizeCompareDateRange(params.dateFrom, params.dateTo);

  const [legacy, unified] = await Promise.all([
    loadLegacyPartyLedgerForTieOut({
      companyId: params.companyId,
      partyType: params.partyType,
      contactId: params.contactId,
      branchId: params.branchId,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      useHybridCustomerLedger: params.useHybridOldEngine,
    }),
    getUnifiedPartyLedger({
      companyId: params.companyId,
      partyType: params.partyType,
      contactId: params.contactId,
      branchId: params.branchId,
      dateFrom: dates.dateFrom,
      dateTo: params.dateTo,
      basis: params.basis,
      shadowForce: true,
    }),
  ]);

  const rowDiff = diffLedgerRows({
    oldRows: legacy.rows,
    newRows: unified.rows,
    oldKey: legacyPartyCompareRowKey,
    newKey: unifiedPartyRowKey,
    oldToSummary: legacyToCompareSummary,
    newToSummary: unifiedPartyToTieOutSummary,
  });

  const oldBalance = closingBalanceFromLegacyRows(legacy.rows);
  const correctionReversalInOld = legacy.rows.filter((e) =>
    isJe0168ClassReversal(e.je_reference_type ?? (e as { reference_type?: string }).reference_type)
  ).length;
  const correctionReversalInNew = unified.rows.filter((r) =>
    isJe0168ClassReversal(r.referenceType)
  ).length;

  return {
    oldBalance,
    newBalance: unified.closingBalance,
    difference: round2(oldBalance - unified.closingBalance),
    oldRowCount: legacy.rows.length,
    newRowCount: unified.rows.length,
    missingInNew: rowDiff.missingInNew,
    extraInNew: rowDiff.extraInNew,
    basis: params.basis,
    branchId: params.branchId ?? null,
    dateFrom: dates.dateFrom,
    dateTo: dates.dateTo,
    contactId: params.contactId,
    partyType: params.partyType,
    oldEngineName: legacy.engineName,
    newEngineName: 'get_unified_party_ledger (shadow RPC)',
    oldQueryMs: legacy.durationMs,
    newQueryMs: unified.meta.queryDurationMs,
    correctionReversalInOld,
    correctionReversalInNew,
    correctionReversalHiddenInEffective:
      params.basis === 'effective_party' && correctionReversalInNew === 0 && correctionReversalInOld > 0,
  };
}

/** Golden test contact name patterns for tie-out UI presets. */
export const GOLDEN_TIE_OUT_CONTACT_PATTERNS = [
  { label: 'JALIL', namePattern: 'JALIL', partyType: 'customer' as const },
  { label: 'Inayat', namePattern: 'INAYAT', partyType: 'customer' as const },
  { label: 'Saqib', namePattern: 'SAQIB', partyType: 'customer' as const },
  { label: 'Walk-in CUS-0000', code: 'CUS-0000', partyType: 'customer' as const },
] as const;
