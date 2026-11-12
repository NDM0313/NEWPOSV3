/**
 * Account Statement — unified engine main loader (Phase 2.11).
 * Used only when resolveAccountStatementMainLoaderSource → unified.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedRowsToAccountStatement } from '@/app/lib/accountStatementUnifiedMapper';
import type { AccountStatementPreviewTarget } from '@/app/lib/accountStatementUnifiedPreviewTarget';
import type { AccountLedgerEntry } from '@/app/services/accountingService';
import {
  getUnifiedAccountLedger,
  getUnifiedPartyLedger,
  type UnifiedLedgerMeta,
  type UnifiedLedgerRow,
} from '@/app/services/unifiedLedgerService';

const STATEMENT_ALL_BRANCHES_SCOPE = undefined;

export type AccountStatementUnifiedMainResult = {
  rows: AccountLedgerEntry[];
  unifiedRows: UnifiedLedgerRow[];
  closingBalance: number;
  meta: UnifiedLedgerMeta;
  basis: UnifiedLedgerBasis;
};

export async function loadAccountStatementUnifiedMain(params: {
  companyId: string;
  target: AccountStatementPreviewTarget;
  startDate: string;
  endDate: string;
  basis: UnifiedLedgerBasis;
}): Promise<AccountStatementUnifiedMainResult> {
  const { basis, companyId, target } = params;

  if (target.kind === 'none') {
    throw new Error(target.reason);
  }

  if (await isUnifiedLedgerKillSwitchActive(companyId)) {
    throw new Error('Unified main loader blocked — kill switch active.');
  }

  const branchId = STATEMENT_ALL_BRANCHES_SCOPE ?? null;
  const dateFrom = params.startDate || null;
  const dateTo = params.endDate || null;

  if (target.kind === 'account') {
    const unified = await getUnifiedAccountLedger({
      companyId,
      accountId: target.accountId,
      branchId,
      dateFrom,
      dateTo,
      basis,
      shadowForce: false,
    });
    return {
      rows: mapUnifiedRowsToAccountStatement(unified.rows),
      unifiedRows: unified.rows,
      closingBalance: unified.closingBalance,
      meta: unified.meta,
      basis,
    };
  }

  const unified = await getUnifiedPartyLedger({
    companyId,
    partyType: target.partyType,
    contactId: target.partyId,
    branchId,
    dateFrom,
    dateTo,
    basis,
    shadowForce: false,
  });

  return {
    rows: mapUnifiedRowsToAccountStatement(unified.rows),
    unifiedRows: unified.rows,
    closingBalance: unified.closingBalance,
    meta: unified.meta,
    basis,
  };
}
