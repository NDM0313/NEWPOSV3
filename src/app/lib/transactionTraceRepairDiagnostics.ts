/**
 * Transaction / Payment trace repair candidate detection (Phase F7).
 * Pure helpers — full eligibility validated on dry-run.
 */

import { amountsMatch, datesClose } from '@/app/lib/paymentJournalRepairEligibility';
import type { RepairQueueItem } from '@/app/lib/developerRepairTypes';
import type { JournalTraceRow } from '@/app/services/developerAccountingDiagnosticsService';
import type { TransactionTraceResult } from '@/app/services/accountingDeveloperCenterService';

export interface TraceRepairCandidate {
  canQueue: boolean;
  reason: string;
  queueItem?: Omit<RepairQueueItem, 'queueId'>;
}

function jePrimaryAmount(j: JournalTraceRow): number {
  let max = 0;
  for (const l of j.lines || []) {
    max = Math.max(max, Number(l.debit) || 0, Number(l.credit) || 0);
  }
  return max;
}

function documentBranchFromTrace(trace: TransactionTraceResult): string | null {
  for (const link of trace.branchChain) {
    const layer = link.layer.toLowerCase();
    if (
      link.branchId &&
      (layer.includes('sale') ||
        layer.includes('purchase') ||
        layer.includes('rental') ||
        layer.includes('document'))
    ) {
      return link.branchId;
    }
  }
  for (const e of trace.entities) {
    if (e.branch_id) return String(e.branch_id);
  }
  return null;
}

function candidateRelinkPayment(
  paymentId: string,
  journalEntryId: string,
  reason: string
): TraceRepairCandidate {
  return {
    canQueue: true,
    reason,
    queueItem: {
      actionId: 'payment.relink_payment_to_journal',
      sourceTab: 'trace',
      params: { paymentId, journalEntryId },
      detectedReason: reason,
      severity: 'medium',
      title: 'Relink payment to journal entry',
    },
  };
}

function candidateSyncBranch(
  targetTable: 'payments' | 'journal_entries' | 'rental_payments',
  rowId: string,
  reason: string,
  sourceTab: string
): TraceRepairCandidate {
  return {
    canQueue: true,
    reason,
    queueItem: {
      actionId: 'payment.sync_branch_from_document',
      sourceTab,
      params: { targetTable, rowId },
      detectedReason: reason,
      severity: 'medium',
      title: 'Sync branch from document',
    },
  };
}

function candidateRelinkRentalPayment(
  rentalPaymentId: string,
  journalEntryId: string,
  reason: string,
  sourceTab: string
): TraceRepairCandidate {
  return {
    canQueue: true,
    reason,
    queueItem: {
      actionId: 'rental.relink_rental_payment_to_journal',
      sourceTab,
      params: { rentalPaymentId, journalEntryId },
      detectedReason: reason,
      severity: 'medium',
      title: 'Relink rental payment to JE',
    },
  };
}

/** Detect safe metadata repair candidates from a transaction trace result. */
export function detectTransactionTraceRepairCandidates(
  trace: TransactionTraceResult,
  sourceTab: 'trace' | 'payment' = 'trace'
): TraceRepairCandidate[] {
  const out: TraceRepairCandidate[] = [];
  const docBranch = documentBranchFromTrace(trace);

  for (const p of trace.payments) {
    if (p.voided_at) continue;

    const linkedJeId = p.journal_entry_id;
    if (linkedJeId) {
      const je = trace.journals.find((j) => j.id === linkedJeId);
      if (je && !je.is_void && je.payment_id !== p.id) {
        out.push(
          candidateRelinkPayment(
            p.id,
            je.id,
            `Payment ${p.reference_number || p.id} linked JE missing payment_id backlink`
          )
        );
      }
    } else {
      for (const j of trace.journals) {
        if (j.is_void) continue;
        if (j.payment_id && j.payment_id !== p.id) continue;
        if (!amountsMatch(p.amount, jePrimaryAmount(j))) continue;
        if (!datesClose(p.payment_date, j.entry_date)) continue;
        out.push(
          candidateRelinkPayment(
            p.id,
            j.id,
            `Orphan payment ${p.reference_number || p.id} matches JE ${j.entry_no || j.id.slice(0, 8)}`
          )
        );
        break;
      }
    }

    if (docBranch && !p.branch_id) {
      out.push(
        candidateSyncBranch(
          'payments',
          p.id,
          `Payment branch null; document branch ${docBranch}`,
          sourceTab
        )
      );
    }
  }

  for (const j of trace.journals) {
    if (j.is_void) continue;
    if (docBranch && !j.branch_id) {
      out.push(
        candidateSyncBranch(
          'journal_entries',
          j.id,
          `Journal entry branch null; document branch ${docBranch}`,
          sourceTab
        )
      );
    }
  }

  for (const rp of trace.rentalPayments) {
    if (rp.journal_entry_id) continue;
    for (const j of trace.journals) {
      if (j.is_void) continue;
      if (j.reference_type !== 'rental') continue;
      if (j.reference_id !== rp.rental_id) continue;
      if (!amountsMatch(rp.amount, jePrimaryAmount(j))) continue;
      if (!datesClose(rp.payment_date, j.entry_date)) continue;
      out.push(
        candidateRelinkRentalPayment(
          rp.id,
          j.id,
          `Rental payment missing journal_entry_id; candidate JE ${j.entry_no || j.id.slice(0, 8)}`,
          sourceTab
        )
      );
      break;
    }
  }

  if (out.length === 0) {
    return [{ canQueue: false, reason: 'No safe metadata repair detected — dry-run will validate if queued manually' }];
  }

  const seen = new Set<string>();
  return out.filter((c) => {
    if (!c.queueItem) return true;
    const key = `${c.queueItem.actionId}:${JSON.stringify(c.queueItem.params)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
