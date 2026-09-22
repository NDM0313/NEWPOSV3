/**
 * Shared unified RPC fetch for Ledger V2 preview (shadow) and main loader (Phase 2.10).
 */

import type { LedgerStatementV2Row, LedgerStatementV2Type } from '@/app/features/ledger-statement-center-v2/types';
import { defaultUnifiedBasisForV2Type } from '@/app/lib/ledgerStatementV2UnifiedPreviewDiff';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { mapUnifiedRowsToLedgerV2 } from '@/app/lib/ledgerStatementV2UnifiedMapper';
import {
  getUnifiedAccountLedger,
  getUnifiedPartyLedger,
  type UnifiedLedgerMeta,
  type UnifiedPartyType,
} from '@/app/services/unifiedLedgerService';
import { STATEMENT_ALL_BRANCHES_SCOPE } from '@/app/services/ledgerStatementCenterV2Scopes';

export type LedgerV2UnifiedFetchResult = {
  rows: LedgerStatementV2Row[];
  closingBalance: number;
  meta: UnifiedLedgerMeta;
  basis: UnifiedLedgerBasis;
};

function partyTypeFromStatementType(
  statementType: LedgerStatementV2Type,
): UnifiedPartyType | null {
  if (statementType === 'account') return null;
  return statementType;
}

export async function fetchLedgerV2UnifiedRpc(params: {
  companyId: string;
  statementType: LedgerStatementV2Type;
  entityId: string;
  fromDate: string;
  toDate: string;
  basis?: UnifiedLedgerBasis;
  /** true = preview/shadow compare; false = production main loader when flags allow */
  shadowForce: boolean;
}): Promise<LedgerV2UnifiedFetchResult> {
  const basis = params.basis ?? defaultUnifiedBasisForV2Type(params.statementType);
  const branchId = STATEMENT_ALL_BRANCHES_SCOPE ?? null;
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
      shadowForce: params.shadowForce,
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
    return {
      rows: [],
      closingBalance: 0,
      basis,
      meta: {
        engine: 'disabled',
        basis,
        featureFlagEnabled: false,
        shadowForce: params.shadowForce,
        queryDurationMs: 0,
        rowCount: 0,
        periodOpeningBalance: 0,
        message: 'Unsupported statement type for unified party ledger.',
      },
    };
  }

  const unified = await getUnifiedPartyLedger({
    companyId: params.companyId,
    partyType,
    contactId: params.entityId,
    branchId,
    dateFrom,
    dateTo,
    basis,
    shadowForce: params.shadowForce,
  });

  return {
    rows: mapUnifiedRowsToLedgerV2(unified.rows),
    closingBalance: unified.closingBalance,
    meta: unified.meta,
    basis,
  };
}
