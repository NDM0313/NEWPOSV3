/**
 * Party Ledger — legacy shadow preview loader (Phase 2.13).
 * Used when main table is unified; preview panel loads legacy for side-by-side compare.
 *
 * R8-R2 rehearsal: thin LegacyMain wrapper deleted; shadow calls loadEffectivePartyLedger.
 */

import {
  loadEffectivePartyLedger,
  type EffectiveLedgerResult,
} from '@/app/services/effectivePartyLedgerService';

export type PartyLedgerLegacyMainParams = {
  companyId: string;
  contactId: string;
  partyType: 'customer' | 'supplier';
  fromDate: string;
  toDate: string;
  branchId?: string | null;
};

export type PartyLedgerLegacyShadowPreviewResult = {
  legacy: EffectiveLedgerResult;
  closingBalance: number;
  openingBalance: number;
  compareSource: 'legacy_shadow';
};

export async function loadPartyLedgerLegacyShadowPreview(
  params: PartyLedgerLegacyMainParams & {
    partyName: string;
  },
): Promise<PartyLedgerLegacyShadowPreviewResult> {
  const legacy = await loadEffectivePartyLedger({
    companyId: params.companyId,
    contactId: params.contactId,
    partyType: params.partyType,
    fromDate: params.fromDate,
    toDate: params.toDate,
    branchId: params.branchId,
  });
  return {
    legacy,
    closingBalance: legacy.summary.closingBalance,
    openingBalance: legacy.summary.openingBalance,
    compareSource: 'legacy_shadow',
  };
}
