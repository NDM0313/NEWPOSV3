/**
 * Party Ledger — unified engine main loader (Phase 2.13).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedToEffectiveLedgerResult } from '@/app/lib/partyLedgerUnifiedMainMapper';
import { buildPartyLedgerPreviewRpcScope } from '@/app/lib/partyLedgerUnifiedPreviewScope';
import { previewBasisFromPartyLedgerMode } from '@/app/lib/partyLedgerUnifiedPreviewDiff';
import type { EffectiveLedgerResult } from '@/app/services/effectivePartyLedgerService';
import {
  getUnifiedPartyLedger,
  type UnifiedLedgerRow,
} from '@/app/services/unifiedLedgerService';

export type PartyLedgerUnifiedMainResult = EffectiveLedgerResult & {
  unifiedRows: UnifiedLedgerRow[];
};

export async function loadPartyLedgerUnifiedMain(params: {
  companyId: string;
  contactId: string;
  partyType: 'customer' | 'supplier';
  dateFrom: string;
  dateTo: string;
  mode: 'effective' | 'audit';
  showReversals: boolean;
  partyName: string;
  basis?: UnifiedLedgerBasis;
}): Promise<PartyLedgerUnifiedMainResult> {
  if (await isUnifiedLedgerKillSwitchActive(params.companyId)) {
    throw new Error('Unified main loader blocked — kill switch active.');
  }

  const basis = previewBasisFromPartyLedgerMode(params.mode, params.showReversals, params.basis);
  const rpcScope = buildPartyLedgerPreviewRpcScope({
    contactId: params.contactId,
    partyType: params.partyType,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    mode: params.mode,
    showReversals: params.showReversals,
  });

  const unified = await getUnifiedPartyLedger({
    companyId: params.companyId,
    partyType: params.partyType,
    contactId: params.contactId,
    branchId: rpcScope.branchId,
    dateFrom: rpcScope.dateFrom,
    dateTo: rpcScope.dateTo,
    basis,
    shadowForce: false,
  });

  return mapUnifiedToEffectiveLedgerResult({
    unified,
    partyName: params.partyName,
    partyType: params.partyType,
  });
}
