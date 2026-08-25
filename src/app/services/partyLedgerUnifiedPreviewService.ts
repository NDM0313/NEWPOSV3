/**
 * Party Ledger — unified engine shadow preview loader (Phase 2.7).
 * Parallel fetch only — never imported by EffectivePartyLedgerPage legacy load.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedRowsToPartyLedgerPreview } from '@/app/lib/partyLedgerUnifiedMapper';
import { buildPartyLedgerPreviewRpcScope } from '@/app/lib/partyLedgerUnifiedPreviewScope';
import { previewBasisFromPartyLedgerMode } from '@/app/lib/partyLedgerUnifiedPreviewDiff';
import type { PartyLedgerPreviewRow } from '@/app/lib/partyLedgerUnifiedMapper';
import {
  getUnifiedPartyLedger,
  type UnifiedLedgerMeta,
  type UnifiedLedgerRow,
} from '@/app/services/unifiedLedgerService';

export type PartyLedgerUnifiedPreviewResult = {
  rows: PartyLedgerPreviewRow[];
  unifiedRows: UnifiedLedgerRow[];
  closingBalance: number;
  openingBalance: number;
  meta: UnifiedLedgerMeta;
  basis: UnifiedLedgerBasis;
  rpcScope: ReturnType<typeof buildPartyLedgerPreviewRpcScope>;
  blockedByKillSwitch?: boolean;
  blockReason?: string;
};

function blockedResult(
  basis: UnifiedLedgerBasis,
  message: string,
  rpcScope: ReturnType<typeof buildPartyLedgerPreviewRpcScope>
): PartyLedgerUnifiedPreviewResult {
  return {
    rows: [],
    unifiedRows: [],
    closingBalance: 0,
    openingBalance: 0,
    basis,
    rpcScope,
    blockedByKillSwitch: true,
    blockReason: message,
    meta: {
      engine: 'disabled',
      basis,
      featureFlagEnabled: false,
      shadowForce: false,
      queryDurationMs: 0,
      rowCount: 0,
      periodOpeningBalance: 0,
      message,
    },
  };
}

export async function loadPartyLedgerUnifiedPreview(params: {
  companyId: string;
  contactId: string;
  partyType: 'customer' | 'supplier';
  dateFrom: string;
  dateTo: string;
  mode: 'effective' | 'audit';
  showReversals: boolean;
  basis?: UnifiedLedgerBasis;
}): Promise<PartyLedgerUnifiedPreviewResult> {
  const rpcScope = buildPartyLedgerPreviewRpcScope({
    contactId: params.contactId,
    partyType: params.partyType,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    mode: params.mode,
    showReversals: params.showReversals,
  });
  const basis = previewBasisFromPartyLedgerMode(params.mode, params.showReversals, params.basis);

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);
  if (killSwitchActive) {
    return blockedResult(
      basis,
      'Unified preview blocked — kill switch active on Party Ledger.',
      rpcScope
    );
  }

  const unified = await getUnifiedPartyLedger({
    companyId: params.companyId,
    partyType: params.partyType,
    contactId: params.contactId,
    branchId: rpcScope.branchId,
    dateFrom: rpcScope.dateFrom,
    dateTo: rpcScope.dateTo,
    basis,
    shadowForce: true,
  });

  return {
    rows: mapUnifiedRowsToPartyLedgerPreview(unified.rows),
    unifiedRows: unified.rows,
    closingBalance: unified.closingBalance,
    openingBalance: unified.meta.periodOpeningBalance,
    meta: unified.meta,
    basis,
    rpcScope,
  };
}
