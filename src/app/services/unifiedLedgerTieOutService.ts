/**
 * Unified Core Ledger — developer tie-out comparison (shadow only).
 */

import {
  getUnifiedPartyLedger,
  loadLegacyPartyLedgerForTieOut,
  type UnifiedLedgerBasis,
  type UnifiedPartyType,
} from '@/app/services/unifiedLedgerService';
import type { AccountLedgerEntry } from '@/app/services/accountingService';
import { isJe0168ClassReversal } from '@/app/lib/unifiedLedgerBasisFilter';
import {
  unifiedPartyRowKey,
  unifiedPartyToTieOutSummary,
} from '@/app/lib/partyLedgerUnifiedCompareMappers';

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

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function legacyRowKey(e: AccountLedgerEntry): string {
  return String(e.journal_entry_id || e.id || `${e.date}-${e.reference_number}`);
}

function legacyToSummary(e: AccountLedgerEntry): TieOutRowSummary {
  return {
    journalEntryId: String(e.journal_entry_id || ''),
    entryNo: e.entry_no ?? e.reference_number ?? null,
    entryDate: String(e.date || ''),
    referenceType: e.reference_type ?? null,
    debit: round2(Number(e.debit) || 0),
    credit: round2(Number(e.credit) || 0),
    description: String(e.description || e.narration || '—'),
  };
}

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
  const [legacy, unified] = await Promise.all([
    loadLegacyPartyLedgerForTieOut({
      companyId: params.companyId,
      partyType: params.partyType,
      contactId: params.contactId,
      branchId: params.branchId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      useHybridCustomerLedger: params.useHybridOldEngine,
    }),
    getUnifiedPartyLedger({
      companyId: params.companyId,
      partyType: params.partyType,
      contactId: params.contactId,
      branchId: params.branchId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      basis: params.basis,
      shadowForce: true,
    }),
  ]);

  const oldKeys = new Set(legacy.rows.map(legacyRowKey));
  const newKeys = new Set(unified.rows.map(unifiedPartyRowKey));

  const missingInNew = legacy.rows
    .filter((e) => !newKeys.has(legacyRowKey(e)) && Boolean(e.journal_entry_id))
    .map(legacyToSummary);

  const extraInNew = unified.rows
    .filter((r) => !oldKeys.has(unifiedPartyRowKey(r)))
    .map(unifiedPartyToTieOutSummary);

  const oldBalance =
    legacy.rows.length > 0
      ? round2(Number(legacy.rows[legacy.rows.length - 1].balance) || 0)
      : 0;

  const correctionReversalInOld = legacy.rows.filter((e) =>
    isJe0168ClassReversal(e.reference_type)
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
    missingInNew,
    extraInNew,
    basis: params.basis,
    branchId: params.branchId ?? null,
    dateFrom: params.dateFrom ?? null,
    dateTo: params.dateTo ?? null,
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
