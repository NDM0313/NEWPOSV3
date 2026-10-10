/**
 * Roznamcha repair candidate detection (Phase F4) — pure helpers.
 */

import type { RepairQueueItem } from '@/app/lib/developerRepairTypes';

export interface RoznamchaRepairCandidateInput {
  rowId: string;
  ref?: string | null;
  sourcePaymentId?: string | null;
  sourceRentalPaymentId?: string | null;
  sourceJournalEntryId?: string | null;
  paymentAccountId?: string | null;
  branchId?: string | null;
  documentBranchId?: string | null;
  amount?: number | null;
  excludedReason?: string | null;
  winnerRef?: string | null;
}

export interface RoznamchaRepairCandidateResult {
  canQueue: boolean;
  reason: string;
  queueItem?: Omit<RepairQueueItem, 'queueId'>;
}

export function detectRoznamchaRepairCandidate(
  row: RoznamchaRepairCandidateInput
): RoznamchaRepairCandidateResult {
  if (row.excludedReason && row.winnerRef) {
    return {
      canQueue: true,
      reason: 'Report / audit only — not a cash or GL repair',
      queueItem: {
        actionId: 'roznamcha.report_duplicate_source',
        sourceTab: 'roznamcha',
        params: {
          rowId: row.rowId,
          winnerRef: row.winnerRef,
          reason: row.excludedReason,
        },
        detectedReason: `Dedupe duplicate (audit only) — canonical ref ${row.winnerRef}`,
        severity: 'low',
        title: 'Report duplicate source (audit only)',
      },
    };
  }

  const rentalId = row.sourceRentalPaymentId;
  const paymentId = row.sourcePaymentId;
  const jeId = row.sourceJournalEntryId;

  if (!row.paymentAccountId && jeId) {
    return {
      canQueue: true,
      reason: 'Missing payment_account_id with linked JE',
      queueItem: {
        actionId: 'payment.fill_payment_account_from_je',
        sourceTab: 'roznamcha',
        params: {
          targetTable: rentalId ? 'rental_payments' : 'payments',
          rowId: rentalId || paymentId || row.rowId,
          journalEntryId: jeId,
        },
        detectedReason: 'payment_account_id is null; JE has liquidity line candidate',
        severity: 'medium',
        title: 'Fill payment_account_id from JE',
      },
    };
  }

  if ((!row.branchId || row.branchId !== row.documentBranchId) && row.documentBranchId) {
    const targetTable = rentalId ? 'rental_payments' : paymentId ? 'payments' : jeId ? 'journal_entries' : null;
    const rowId = rentalId || paymentId || jeId;
    if (targetTable && rowId) {
      return {
        canQueue: true,
        reason: 'Branch missing or mismatched vs source document',
        queueItem: {
          actionId: 'payment.sync_branch_from_document',
          sourceTab: 'roznamcha',
          params: { targetTable, rowId },
          detectedReason: `Document branch ${row.documentBranchId} vs row branch ${row.branchId || 'null'}`,
          severity: 'medium',
          title: 'Sync branch from document',
        },
      };
    }
  }

  return {
    canQueue: false,
    reason: 'No safe metadata repair detected for this row',
  };
}
