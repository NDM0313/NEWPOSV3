/**
 * Ledger Statement V2 — unified engine shadow preview loader (Phase 2.3).
 * Parallel fetch only — never switches the main table unless loader flag ON (Phase 2.10).
 */

import type { LedgerStatementV2Row, LedgerStatementV2Type } from '@/app/features/ledger-statement-center-v2/types';
import { defaultUnifiedBasisForV2Type } from '@/app/lib/ledgerStatementV2UnifiedPreviewDiff';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedRowsToLedgerV2 } from '@/app/lib/ledgerStatementV2UnifiedMapper';
import {
  getUnifiedAccountLedger,
  getUnifiedPartyLedger,
  type UnifiedLedgerMeta,
  type UnifiedPartyType,
} from '@/app/services/unifiedLedgerService';

export type { LedgerV2UnifiedPreviewDiff } from '@/app/lib/ledgerStatementV2UnifiedPreviewDiff';
export {
  compareLedgerV2UnifiedPreview,
  defaultUnifiedBasisForV2Type,
} from '@/app/lib/ledgerStatementV2UnifiedPreviewDiff';

export type LedgerV2UnifiedPreviewResult = {
  rows: LedgerStatementV2Row[];
  closingBalance: number;
  meta: UnifiedLedgerMeta;
  basis: UnifiedLedgerBasis;
  blockedByKillSwitch?: boolean;
};

function partyTypeFromStatementType(
  statementType: LedgerStatementV2Type,
): UnifiedPartyType | null {
  if (statementType === 'account') return null;
  return statementType;
}

function blockedByKillResult(basis: UnifiedLedgerBasis): LedgerV2UnifiedPreviewResult {
  return {
    rows: [],
    closingBalance: 0,
    basis,
    blockedByKillSwitch: true,
    meta: {
      engine: 'disabled',
      basis,
      featureFlagEnabled: false,
      shadowForce: true,
      queryDurationMs: 0,
      rowCount: 0,
      periodOpeningBalance: 0,
      message: 'Unified preview blocked — kill switch active on Ledger V2.',
    },
  };
}

export async function loadLedgerV2UnifiedPreview(params: {
  companyId: string;
  statementType: LedgerStatementV2Type;
  entityId: string;
  fromDate: string;
  toDate: string;
  basis?: UnifiedLedgerBasis;
}): Promise<LedgerV2UnifiedPreviewResult> {
  const basis = params.basis ?? defaultUnifiedBasisForV2Type(params.statementType);
  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);
  if (killSwitchActive) {
    return blockedByKillResult(basis);
  }

  const branchId = null;
  const dateFrom = params.fromDate || null;
  const dateTo = params.toDate || null;

  if (params.statementType === 'account') {
    const unified = await getUnifiedAccountLedger({
      companyId: params.companyId,
      accountId: params.entityId,
      branchId,
      dateFrom,
      dateTo,
      basis,
      shadowForce: true,
    });
    return {
      rows: mapUnifiedRowsToLedgerV2(unified.rows),
      closingBalance: unified.closingBalance,
      meta: unified.meta,
      basis,
    };
  }

  const partyType = partyTypeFromStatementType(params.statementType);
  if (!partyType) {
    return blockedByKillResult(basis);
  }

  const unified = await getUnifiedPartyLedger({
    companyId: params.companyId,
    partyType,
    contactId: params.entityId,
    branchId,
    dateFrom,
    dateTo,
    basis,
    shadowForce: true,
  });

  return {
    rows: mapUnifiedRowsToLedgerV2(unified.rows),
    closingBalance: unified.closingBalance,
    meta: unified.meta,
    basis,
  };
}
