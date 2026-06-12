/**
 * Unified Actionable Repair classifier — maps diagnostic rows to fix status, buttons, and safety bounds.
 */

import type { UnmappedLineDiagnostics, UnpostedPostability } from '@/app/lib/arApReconciliationDiagnostics';
import {
  isOrphanArReversalDefect,
  type OrphanArReversalDefectInput,
} from '@/app/lib/glCorrectionDraftRepair';
import { shouldIncludeCancelledSaleActivityInNormalStatement } from '@/app/lib/reportVisibilityContract';
import type { RepairQueueItem } from '@/app/lib/developerRepairTypes';
import type { ExpensePaymentRepairCandidateRow } from '@/app/services/expensePaymentSyncService';
import type { UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';

export type ActionableRepairStatus =
  | 'fixable_now'
  | 'needs_source_document'
  | 'needs_gl_correction_draft'
  | 'audit_only'
  | 'blocked_unsafe';

export type ActionableRepairCategory =
  | 'metadata_only'
  | 'payment_source_sync'
  | 'report_filter_audit'
  | 'source_document_required'
  | 'gl_correction_draft';

export type ActionableRepairButton =
  | 'fix_link'
  | 'sync_payment_amount'
  | 'fix_branch'
  | 'create_gl_correction_draft'
  | 'open_source_document'
  | 'view_audit'
  | 'mark_reviewed'
  | 'blocked_explain';

export type ActionableRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ActionableRepairClassification {
  issueType: string;
  status: ActionableRepairStatus;
  category: ActionableRepairCategory;
  whyDetected: string;
  whatWillChange: string[];
  whatWillNeverChange: string[];
  recommendedAction: string;
  primaryButton: ActionableRepairButton;
  canApply: boolean;
  riskLevel: ActionableRiskLevel;
  blockReason?: string;
  queueItem?: Omit<RepairQueueItem, 'queueId'>;
}

const METADATA_NEVER = [
  'journal_entry_lines debit/credit amounts',
  'GL account balances',
  'Posted sale/purchase totals',
];

const PAYMENT_SYNC_NEVER = ['journal_entry_lines debit/credit amounts', 'Expense row amount', 'GL balances'];

const GL_DRAFT_NEVER = [
  'Existing JE rows (JE-0160, JE-0161, JE-0168)',
  'Hard-delete of posted records',
  'Broad AR/AP reverse/repost enablement',
];

export function actionableRepairStatusLabel(status: ActionableRepairStatus): string {
  switch (status) {
    case 'fixable_now':
      return 'Fixable now';
    case 'needs_source_document':
      return 'Needs source document';
    case 'needs_gl_correction_draft':
      return 'Needs GL correction draft';
    case 'audit_only':
      return 'Audit-only / no action';
    case 'blocked_unsafe':
      return 'Blocked — unsafe without review';
    default:
      return status;
  }
}

export function actionableRepairButtonLabel(button: ActionableRepairButton): string {
  switch (button) {
    case 'fix_link':
      return 'Fix Link';
    case 'sync_payment_amount':
      return 'Sync Payment Amount';
    case 'fix_branch':
      return 'Fix Branch';
    case 'create_gl_correction_draft':
      return 'Create GL Correction Draft';
    case 'open_source_document':
      return 'Open Source Document';
    case 'view_audit':
      return 'View Audit';
    case 'mark_reviewed':
      return 'Mark Reviewed';
    case 'blocked_explain':
      return 'Blocked — Explain';
    default:
      return button;
  }
}

export function classifyCorrectionReversalRow(input: {
  entryNo?: string | null;
  referenceType?: string | null;
}): ActionableRepairClassification {
  const ref = String(input.referenceType ?? '').toLowerCase();
  const entry = input.entryNo || 'correction reversal';
  return {
    issueType: 'Correction reversal (audit trail)',
    status: 'audit_only',
    category: 'report_filter_audit',
    whyDetected: `${entry} has reference_type=correction_reversal — excluded from normal cash/statement views`,
    whatWillChange: [],
    whatWillNeverChange: ['JE-0168 GL rows', 'All posted GL amounts'],
    recommendedAction: 'View in audit mode only. No GL mutation.',
    primaryButton: 'view_audit',
    canApply: false,
    riskLevel: 'low',
    blockReason: 'Audit-only row — GL repair disabled',
  };
}

export function classifyCancelledSaleTrail(input: {
  saleInvoiceNo?: string | null;
  saleStatus?: string | null;
  jeReferenceType?: string | null;
}): ActionableRepairClassification | null {
  const hidden = !shouldIncludeCancelledSaleActivityInNormalStatement({
    jeReferenceType: input.jeReferenceType,
    linkedSaleStatus: input.saleStatus,
  });
  if (!hidden) return null;
  return {
    issueType: 'Cancelled sale trail (report-filter)',
    status: 'audit_only',
    category: 'report_filter_audit',
    whyDetected: `${input.saleInvoiceNo || 'Sale'} is cancelled — sale/sale_reversal rows hidden from normal statement`,
    whatWillChange: [],
    whatWillNeverChange: ['Posted GL rows', 'Sale status'],
    recommendedAction: 'Normal statement already excludes these rows. Mark reviewed or view audit.',
    primaryButton: 'mark_reviewed',
    canApply: false,
    riskLevel: 'low',
  };
}

export function classifyOrphanArReversalDefect(
  defect: OrphanArReversalDefectInput
): ActionableRepairClassification {
  return {
    issueType: 'Orphan party AR after wrong-account reversal',
    status: 'needs_gl_correction_draft',
    category: 'gl_correction_draft',
    whyDetected: `${defect.saleJeNo} Dr ${defect.partyArAccountCode} Rs ${defect.orphanAmount}; ${defect.reversalJeNo} credited ${defect.wrongCreditAccountCode} not ${defect.partyArAccountCode}`,
    whatWillChange: ['New additive correction JE (draft preview)', 'Raw GL party balance after apply (when RPC exists)'],
    whatWillNeverChange: GL_DRAFT_NEVER,
    recommendedAction: 'Run GL correction dry-run, review Dr/Cr preview, then apply with confirm phrase when RPC is deployed',
    primaryButton: 'create_gl_correction_draft',
    canApply: true,
    riskLevel: 'high',
    blockReason: undefined,
    queueItem: {
      actionId: 'gl.create_correction_draft',
      sourceTab: 'ar-ap',
      params: { defectId: defect.defectId },
      detectedReason: `Orphan ${defect.partyArAccountCode} Rs ${defect.orphanAmount} — ${defect.saleInvoiceNo}`,
      severity: 'high',
      title: `GL correction — ${defect.saleInvoiceNo}`,
    },
  };
}

export function classifyOrphanArFromTrace(input: {
  saleJePartyArDebit?: number;
  reversalJePartyArCredit?: number;
  reversalJeWrongAccountCredit?: number;
  wrongAccountCode?: string;
  partyArAccountCode?: string;
  saleInvoiceNo?: string;
  saleJeNo?: string;
  reversalJeNo?: string;
}): ActionableRepairClassification | null {
  if (
    !isOrphanArReversalDefect({
      saleJePartyArDebit: input.saleJePartyArDebit,
      reversalJePartyArCredit: input.reversalJePartyArCredit,
      reversalJeWrongAccountCredit: input.reversalJeWrongAccountCredit,
      wrongAccountCode: input.wrongAccountCode,
      partyArAccountCode: input.partyArAccountCode,
    })
  ) {
    return null;
  }
  return classifyOrphanArReversalDefect({
    defectId: `${String(input.saleInvoiceNo || 'sale').toLowerCase().replace(/\s+/g, '-')}-orphan-ar`,
    saleInvoiceNo: input.saleInvoiceNo || '—',
    saleJeNo: input.saleJeNo || '—',
    reversalJeNo: input.reversalJeNo || '—',
    partyArAccountCode: input.partyArAccountCode || 'AR',
    wrongCreditAccountCode: input.wrongAccountCode || '1100',
    orphanAmount: Number(input.saleJePartyArDebit) || 0,
  });
}

export function classifyExpensePaymentMismatch(
  row: Pick<
    ExpensePaymentRepairCandidateRow,
    'expenseId' | 'expenseNo' | 'expenseAmount' | 'paymentAmount' | 'jeLiquidityAmount' | 'canApplyRepair' | 'blockReason'
  >
): ActionableRepairClassification {
  const canApply = row.canApplyRepair;
  return {
    issueType: 'Expense / payment amount mismatch',
    status: canApply ? 'fixable_now' : 'blocked_unsafe',
    category: 'payment_source_sync',
    whyDetected: `Payment Rs ${(row.paymentAmount ?? 0).toLocaleString()} ≠ expense Rs ${row.expenseAmount.toLocaleString()}; JE liquidity Rs ${row.jeLiquidityAmount.toLocaleString()}`,
    whatWillChange: canApply ? ['payments.amount metadata'] : [],
    whatWillNeverChange: PAYMENT_SYNC_NEVER,
    recommendedAction: canApply
      ? 'Sync payment amount to match expense when JE already matches'
      : row.blockReason || 'JE amount mismatch — review GL before repair',
    primaryButton: canApply ? 'sync_payment_amount' : 'blocked_explain',
    canApply,
    riskLevel: canApply ? 'medium' : 'high',
    blockReason: canApply ? undefined : row.blockReason || 'JE liquidity amount differs from expense',
    queueItem: {
      actionId: 'expense.sync_linked_payment_amount',
      sourceTab: 'repair',
      params: { expenseId: row.expenseId, expenseNo: row.expenseNo },
      detectedReason: `Payment ≠ expense for ${row.expenseNo}`,
      severity: canApply ? 'medium' : 'high',
      title: `Sync expense payment — ${row.expenseNo}`,
    },
  };
}

export function classifyUnpostedDocument(
  row: UnpostedDocumentRow,
  diag: UnpostedPostability
): ActionableRepairClassification {
  if (diag.isNonFinal) {
    return {
      issueType: 'Non-final document',
      status: 'needs_source_document',
      category: 'source_document_required',
      whyDetected: diag.queueReason,
      whatWillChange: [],
      whatWillNeverChange: ['GL from Accounting module', 'Auto-cancel from queue'],
      recommendedAction: diag.suggestedAction,
      primaryButton: 'open_source_document',
      canApply: false,
      riskLevel: diag.riskLevel,
    };
  }
  return {
    issueType: 'Final document missing posting',
    status: 'blocked_unsafe',
    category: 'source_document_required',
    whyDetected: diag.queueReason,
    whatWillChange: [],
    whatWillNeverChange: ['Silent GL post from Accounting', 'Broad AR/AP post/reverse/repost'],
    recommendedAction: 'Open source document or run posting dry-run — GL posting disabled globally',
    primaryButton: 'blocked_explain',
    canApply: false,
    riskLevel: 'medium',
    blockReason: 'GL posting/reverse/repost intentionally disabled from AR/AP center',
  };
}

export function classifyUnmappedJournalLine(
  row: UnmappedJournalRow,
  diag: UnmappedLineDiagnostics
): ActionableRepairClassification {
  const jeRef = String(row.reference_type ?? '').toLowerCase();
  if (jeRef === 'correction_reversal') {
    return classifyCorrectionReversalRow({ entryNo: row.entry_no, referenceType: jeRef });
  }

  if (diag.isLikelyFalsePositive || diag.isMetadataReviewOnly) {
    return {
      issueType: diag.isLikelyFalsePositive ? 'Likely mapped (false positive)' : 'Metadata review only',
      status: 'fixable_now',
      category: 'metadata_only',
      whyDetected: diag.falsePositiveReason || diag.metadataReviewReason || diag.queueReason,
      whatWillChange: ['Contact mapping metadata (Fix Link)', 'payment_id / branch_id when applicable'],
      whatWillNeverChange: METADATA_NEVER,
      recommendedAction: diag.suggestedAction,
      primaryButton: diag.isMetadataReviewOnly ? 'mark_reviewed' : 'fix_link',
      canApply: true,
      riskLevel: diag.riskLevel,
    };
  }

  if (row.contact_mapping_status === 'missing_reference') {
    return {
      issueType: 'Missing source reference',
      status: 'blocked_unsafe',
      category: 'metadata_only',
      whyDetected: diag.queueReason,
      whatWillChange: [],
      whatWillNeverChange: METADATA_NEVER,
      recommendedAction: 'Identify source document before any relink',
      primaryButton: 'blocked_explain',
      canApply: false,
      riskLevel: 'critical',
      blockReason: 'No safe candidate — missing source reference',
    };
  }

  return {
    issueType: 'Unmapped AR/AP line',
    status: 'fixable_now',
    category: 'metadata_only',
    whyDetected: diag.queueReason,
    whatWillChange: ['Contact mapping metadata via Fix Link'],
    whatWillNeverChange: METADATA_NEVER,
    recommendedAction: diag.suggestedAction,
    primaryButton: 'fix_link',
    canApply: true,
    riskLevel: diag.riskLevel,
    queueItem: {
      actionId: 'payment.relink_payment_to_journal',
      sourceTab: 'ar-ap',
      params: { journalEntryId: row.journal_entry_id },
      detectedReason: diag.queueReason,
      severity: diag.riskLevel === 'critical' ? 'high' : 'medium',
      title: `Fix Link — ${row.entry_no || row.journal_entry_id.slice(0, 8)}`,
    },
  };
}

export function resolveBlockedGlRepairReason(applyEnabled: boolean): string {
  if (applyEnabled) return '';
  return 'GL repair apply disabled — dry-run and classification only until migration RPC is approved';
}
