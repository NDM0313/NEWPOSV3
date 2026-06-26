/**
 * Party Ledger — legacy main loader (Phase 2.13).
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

export async function loadPartyLedgerLegacyMain(
  params: PartyLedgerLegacyMainParams,
): Promise<EffectiveLedgerResult> {
  return loadEffectivePartyLedger({
    companyId: params.companyId,
    contactId: params.contactId,
    partyType: params.partyType,
    fromDate: params.fromDate,
    toDate: params.toDate,
    branchId: params.branchId,
  });
}
