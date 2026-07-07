/**
 * Ledger Statement V2 — unified engine main loader (Phase 2.10).
 * Used only when resolveLedgerV2MainLoaderSource → unified.
 * Preview path remains in ledgerStatementCenterV2UnifiedPreviewService (shadowForce: true).
 */

import type {
  LedgerStatementV2Filters,
  LedgerStatementV2Result,
} from '@/app/features/ledger-statement-center-v2/types';
import { defaultUnifiedBasisForV2Type } from '@/app/lib/ledgerStatementV2UnifiedPreviewDiff';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { deriveLedgerV2Opening, enrichLedgerV2PaymentAndAuthorship, summarizeLedgerV2Rows } from '@/app/services/ledgerStatementCenterV2Service';
import { fetchLedgerV2UnifiedRpc } from '@/app/services/ledgerStatementCenterV2UnifiedFetch';
import { realignAccountLedgerRunningBalances } from '@/app/lib/ledgerStatementV2UnifiedMapper';

/**
 * Load Ledger V2 statement via unified RPC for the main table (shadowForce: false).
 * Caller must verify resolveLedgerV2MainLoaderSource === 'unified' before invoking.
 */
export async function getLedgerStatementV2UnifiedMain(
  companyId: string,
  filters: LedgerStatementV2Filters,
  entityLabel: string,
): Promise<LedgerStatementV2Result> {
  const { statementType, entityId, fromDate, toDate } = filters;
  if (!entityId) {
    return {
      entityLabel,
      basis: 'gl',
      rows: [],
      summary: {
        openingBalance: 0,
        closingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
      },
    };
  }

  if (await isUnifiedLedgerKillSwitchActive(companyId)) {
    throw new Error('Unified main loader blocked — kill switch active.');
  }

  const basis = defaultUnifiedBasisForV2Type(statementType);
  const fetched = await fetchLedgerV2UnifiedRpc({
    companyId,
    statementType,
    entityId,
    fromDate,
    toDate,
    basis,
    shadowForce: false,
  });

  let rows = fetched.rows;
  if (statementType === 'account') {
    rows = realignAccountLedgerRunningBalances(rows, fetched.meta.periodOpeningBalance);
  }
  await enrichLedgerV2PaymentAndAuthorship(rows, companyId, {
    statementType,
    viewedAccountId: statementType === 'account' ? entityId : null,
  });
  const opening = deriveLedgerV2Opening(rows);
  const summary = summarizeLedgerV2Rows(rows, opening, statementType);

  return {
    entityLabel,
    basis: 'gl',
    rows,
    summary,
  };
}
