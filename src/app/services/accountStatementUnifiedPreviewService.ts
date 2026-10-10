/**
 * Account Statement — unified engine shadow preview loader (Phase 2.4).
 * Parallel fetch only — never imported by AccountLedgerReportPage legacy load.
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

/** Matches AccountLedgerReportPage — all branches. */
const STATEMENT_ALL_BRANCHES_SCOPE = undefined;

export type AccountStatementUnifiedPreviewResult = {
  rows: AccountLedgerEntry[];
  unifiedRows: UnifiedLedgerRow[];
  closingBalance: number;
  meta: UnifiedLedgerMeta;
  basis: UnifiedLedgerBasis;
  blockedByKillSwitch?: boolean;
  targetBlocked?: boolean;
  blockReason?: string;
};

function blockedResult(
  basis: UnifiedLedgerBasis,
  message: string,
  flags?: { kill?: boolean; target?: boolean }
): AccountStatementUnifiedPreviewResult {
  return {
    rows: [],
    unifiedRows: [],
    closingBalance: 0,
    basis,
    blockedByKillSwitch: flags?.kill === true,
    targetBlocked: flags?.target === true,
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

export async function loadAccountStatementUnifiedPreview(params: {
  companyId: string;
  target: AccountStatementPreviewTarget;
  startDate: string;
  endDate: string;
  basis: UnifiedLedgerBasis;
}): Promise<AccountStatementUnifiedPreviewResult> {
  const { basis, companyId, target } = params;

  if (target.kind === 'none') {
    return blockedResult(basis, target.reason, { target: true });
  }

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId);
  if (killSwitchActive) {
    return blockedResult(
      basis,
      'Unified preview blocked — kill switch active on Account Statement.',
      { kill: true }
    );
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
      shadowForce: true,
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
    shadowForce: true,
  });

  return {
    rows: mapUnifiedRowsToAccountStatement(unified.rows),
    unifiedRows: unified.rows,
    closingBalance: unified.closingBalance,
    meta: unified.meta,
    basis,
  };
}
