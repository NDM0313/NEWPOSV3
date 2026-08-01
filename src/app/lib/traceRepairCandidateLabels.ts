/**
 * Human-readable labels for trace repair candidates (Payment / Transaction Trace).
 * Uses optional action metadata — static fallback for node:test without registry import.
 */

import type { DeveloperRepairRiskLevel } from '@/app/lib/developerRepairTypes';
import type { TraceRepairCandidate } from '@/app/lib/transactionTraceRepairDiagnostics';

export interface TraceRepairActionMeta {
  id: string;
  title: string;
  riskLevel: DeveloperRepairRiskLevel;
  whatItChanges: string[];
  whatItNeverChanges: string[];
}

export interface TraceRepairCandidateLabel {
  actionId: string;
  title: string;
  riskLevel: DeveloperRepairRiskLevel;
  detectedReason: string;
  targetTable: string;
  targetId: string;
  whatWillChange: string[];
  whatWillNeverChange: string[];
}

/** Static catalog for tests and fallback when registry is not loaded. */
export const TRACE_REPAIR_ACTION_META: Record<string, TraceRepairActionMeta> = {
  'payment.relink_payment_to_journal': {
    id: 'payment.relink_payment_to_journal',
    title: 'Relink payment to journal entry',
    riskLevel: 'medium',
    whatItChanges: ['journal_entries.payment_id'],
    whatItNeverChanges: ['Payment amount', 'JE lines', 'Reference numbers', 'contact_id'],
  },
  'payment.sync_branch_from_document': {
    id: 'payment.sync_branch_from_document',
    title: 'Sync branch from document',
    riskLevel: 'medium',
    whatItChanges: ['branch_id on payment, rental_payment, or journal_entry metadata'],
    whatItNeverChanges: ['Source document branch', 'GL amounts'],
  },
  'rental.relink_rental_payment_to_journal': {
    id: 'rental.relink_rental_payment_to_journal',
    title: 'Relink rental payment to JE',
    riskLevel: 'medium',
    whatItChanges: ['rental_payments.journal_entry_id', 'rental_payments.payment_account_id when null'],
    whatItNeverChanges: ['GL lines', 'Amounts', 'Rental totals'],
  },
};

function resolveTarget(candidate: TraceRepairCandidate): { table: string; id: string } {
  if (candidate.targetTable && candidate.targetId) {
    return { table: candidate.targetTable, id: candidate.targetId };
  }
  const params = candidate.queueItem?.params || {};
  if (params.paymentId) return { table: 'payments', id: String(params.paymentId) };
  if (params.rentalPaymentId) return { table: 'rental_payments', id: String(params.rentalPaymentId) };
  if (params.targetTable && params.rowId) {
    return { table: String(params.targetTable), id: String(params.rowId) };
  }
  return { table: '—', id: '—' };
}

export function buildTraceRepairCandidateLabel(
  candidate: TraceRepairCandidate,
  actionMeta?: TraceRepairActionMeta | null
): TraceRepairCandidateLabel | null {
  if (!candidate.canQueue || !candidate.queueItem) return null;

  const actionId = candidate.queueItem.actionId;
  const meta = actionMeta || TRACE_REPAIR_ACTION_META[actionId];
  const target = resolveTarget(candidate);

  return {
    actionId,
    title: candidate.queueItem.title || meta?.title || actionId,
    riskLevel: meta?.riskLevel || candidate.queueItem.severity || 'medium',
    detectedReason: candidate.reason || candidate.queueItem.detectedReason,
    targetTable: target.table,
    targetId: target.id,
    whatWillChange: meta?.whatItChanges || ['Metadata fields only — see dry-run preview'],
    whatWillNeverChange: meta?.whatItNeverChanges || ['GL line amounts', 'Void/delete operations'],
  };
}
