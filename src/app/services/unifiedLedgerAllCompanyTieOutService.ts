/**
 * All-company unified ledger tie-out (Phase 1.5 shadow).
 * Compares legacy engines vs unified RPC per company/contact — never blends old balances.
 */

import {
  getUnifiedPartyLedger,
  loadLegacyPartyLedgerForTieOut,
  type UnifiedLedgerBasis,
  type UnifiedPartyType,
} from '@/app/services/unifiedLedgerService';
import { comparePartyLedgerTieOut } from '@/app/services/unifiedLedgerTieOutService';
import {
  summarizeAllCompanyTieOut as summarizeTieOutRows,
  type AllCompanyTieOutSummary,
  type CompanyTieOutRow,
  type LegacyEngineLabel,
} from '@/app/lib/unifiedLedgerTieOutSummary';

export type { LegacyEngineLabel, CompanyTieOutRow, AllCompanyTieOutSummary };

export type CompanyTieOutContact = {
  contactId: string;
  contactName: string;
  contactCode: string | null;
  partyType: UnifiedPartyType;
};

export type CompanyTieOutScope = {
  companyId: string;
  companyName: string;
  branchId?: string | null;
  branchLabel?: string | null;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function toLegacyLabel(useHybrid: boolean): LegacyEngineLabel {
  return useHybrid ? 'hybrid_frontend_equivalent' : 'legacy_gl_rpc';
}

export async function compareCompanyContactTieOut(params: {
  scope: CompanyTieOutScope;
  contact: CompanyTieOutContact;
  basis: UnifiedLedgerBasis;
  dateFrom?: string | null;
  dateTo?: string | null;
  useHybridOldEngine?: boolean;
  tolerance?: number;
}): Promise<CompanyTieOutRow> {
  const tolerance = params.tolerance ?? 0.01;
  const cmp = await comparePartyLedgerTieOut({
    companyId: params.scope.companyId,
    partyType: params.contact.partyType,
    contactId: params.contact.contactId,
    branchId: params.scope.branchId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    basis: params.basis,
    useHybridOldEngine: params.useHybridOldEngine,
  });

  const diff = round2(Math.abs(cmp.difference));
  return {
    companyId: params.scope.companyId,
    companyName: params.scope.companyName,
    branchId: params.scope.branchId ?? null,
    branchLabel: params.scope.branchLabel ?? null,
    contactId: params.contact.contactId,
    contactName: params.contact.contactName,
    contactCode: params.contact.contactCode,
    partyType: params.contact.partyType,
    basis: params.basis,
    legacyEngine: toLegacyLabel(params.useHybridOldEngine === true),
    oldBalance: cmp.oldBalance,
    newBalance: cmp.newBalance,
    difference: cmp.difference,
    oldRowCount: cmp.oldRowCount,
    newRowCount: cmp.newRowCount,
    pass: diff <= tolerance,
    oldEngineName: cmp.oldEngineName,
    newEngineName: cmp.newEngineName,
  };
}

export const summarizeAllCompanyTieOut = summarizeTieOutRows;

/** Quick unified-only balance probe (no legacy) for smoke checks. */
export async function probeUnifiedPartyBalance(params: {
  companyId: string;
  partyType: UnifiedPartyType;
  contactId: string;
  branchId?: string | null;
  basis: UnifiedLedgerBasis;
}): Promise<{ balance: number; rowCount: number }> {
  const u = await getUnifiedPartyLedger({
    ...params,
    shadowForce: true,
  });
  return { balance: u.closingBalance, rowCount: u.meta.rowCount };
}

export { loadLegacyPartyLedgerForTieOut, getUnifiedPartyLedger };
