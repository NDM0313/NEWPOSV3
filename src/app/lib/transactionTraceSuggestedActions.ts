/**
 * Phase 2B — advisory safe actions for Transaction Trace (no auto-apply).
 */

import { isCorrectionReversalReferenceType } from '@/app/lib/reportVisibilityContract';

export type TraceIssueType =
  | 'amount_mismatch'
  | 'contact_missing'
  | 'branch_missing'
  | 'payment_linked_missing'
  | 'je_linked_missing'
  | 'correction_reversal_only'
  | 'report_filter_only'
  | 'none';

export type TraceSuggestedActionId =
  | 'fix_link'
  | 'fix_branch'
  | 'sync_linked_payment_amount'
  | 'open_source_document'
  | 'view_audit'
  | 'no_action';

export interface TraceSuggestedAction {
  id: TraceSuggestedActionId;
  label: string;
  detail: string;
}

export interface TraceDiagnosisInput {
  issueType: TraceIssueType;
  journalReferenceType?: string | null;
  paymentVoided?: boolean;
  journalIsVoid?: boolean;
  hasPaymentRow?: boolean;
  hasJournalRow?: boolean;
  contactMissing?: boolean;
  branchMissing?: boolean;
  amountMismatch?: boolean;
  normalHiddenAuditVisible?: boolean;
}

export function detectTraceIssueType(input: TraceDiagnosisInput): TraceIssueType {
  if (input.amountMismatch) return 'amount_mismatch';
  if (input.contactMissing) return 'contact_missing';
  if (input.branchMissing) return 'branch_missing';
  if (input.hasPaymentRow === false && input.hasJournalRow) return 'payment_linked_missing';
  if (input.hasJournalRow === false && input.hasPaymentRow) return 'je_linked_missing';
  if (isCorrectionReversalReferenceType(input.journalReferenceType)) return 'correction_reversal_only';
  if (input.normalHiddenAuditVisible) return 'report_filter_only';
  return 'none';
}

export function suggestTraceActions(input: TraceDiagnosisInput): TraceSuggestedAction[] {
  const issue = input.issueType === 'none' ? detectTraceIssueType(input) : input.issueType;
  const out: TraceSuggestedAction[] = [];

  switch (issue) {
    case 'amount_mismatch':
      out.push({
        id: 'sync_linked_payment_amount',
        label: 'Sync Linked Payment Amount',
        detail: 'Dry-run expense/payment sync — does not change GL lines.',
      });
      break;
    case 'contact_missing':
      out.push({
        id: 'fix_link',
        label: 'Fix Link',
        detail: 'Save party mapping for trace only on reversal rows; active rows may relink after dry-run.',
      });
      break;
    case 'branch_missing':
      out.push({
        id: 'fix_branch',
        label: 'Fix Branch',
        detail: 'Align branch_id on payment/JE after dry-run review.',
      });
      break;
    case 'correction_reversal_only':
    case 'report_filter_only':
      out.push({
        id: 'no_action',
        label: 'No action required',
        detail: 'Audit-only reversal trail — visible in audit/trace views, excluded from normal cash movement.',
      });
      out.push({
        id: 'view_audit',
        label: 'View Audit',
        detail: 'Review cancellation reason and linked voided payment.',
      });
      break;
    case 'payment_linked_missing':
    case 'je_linked_missing':
      out.push({
        id: 'view_audit',
        label: 'View Audit',
        detail: 'Inspect broken link chain before any repair.',
      });
      break;
    default:
      out.push({
        id: 'no_action',
        label: 'No action required',
        detail: 'No automated issue detected.',
      });
  }

  if (issue !== 'correction_reversal_only' && issue !== 'report_filter_only' && issue !== 'none') {
    out.push({
      id: 'view_audit',
      label: 'View Audit',
      detail: 'Review activity log and repair audit before applying fixes.',
    });
  }

  return out;
}
