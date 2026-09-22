/**
 * Ledger Statement V2 — legacy shadow preview loader (Phase 2.10C-FIX).
 * Used when main table is unified; preview panel loads legacy for side-by-side compare.
 */

import type {
  LedgerStatementV2Row,
  LedgerStatementV2Type,
} from '@/app/features/ledger-statement-center-v2/types';
import { getLedgerStatementV2 } from '@/app/services/ledgerStatementCenterV2Service';

export type LedgerV2LegacyShadowPreviewResult = {
  rows: LedgerStatementV2Row[];
  closingBalance: number;
  compareSource: 'legacy_shadow';
};

export async function loadLedgerV2LegacyShadowPreview(params: {
  companyId: string;
  statementType: LedgerStatementV2Type;
  entityId: string;
  fromDate: string;
  toDate: string;
  entityLabel?: string;
}): Promise<LedgerV2LegacyShadowPreviewResult> {
  const data = await getLedgerStatementV2(
    params.companyId,
    {
      statementType: params.statementType,
      entityId: params.entityId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      branchId: 'all',
      transactionType: 'all',
      search: '',
    },
    params.entityLabel || params.entityId,
  );

  const closingBalance =
    data.summary?.closingBalance ??
    (data.rows.length ? data.rows[data.rows.length - 1].runningBalance : 0);

  return {
    rows: data.rows,
    closingBalance,
    compareSource: 'legacy_shadow',
  };
}
