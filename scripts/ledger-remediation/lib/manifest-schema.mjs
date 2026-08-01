/**
 * Phase 1.6.1 branch manual-review manifest schema.
 */

export const MANIFEST_COLUMNS = [
  'entry_no',
  'journal_entry_id',
  'company_name',
  'company_id',
  'reference_type',
  'date',
  'description',
  'amount',
  'from_account',
  'to_account',
  'current_branch',
  'candidate_branch_1',
  'candidate_branch_1_reason',
  'candidate_branch_2',
  'candidate_branch_2_reason',
  'recommended_branch_id',
  'recommended_branch_label',
  'confidence',
  'approval_required',
  'final_status',
  'operator_decision',
  'operator_note',
  'approved_branch_id',
];

export const OPERATOR_DECISIONS = new Set(['approve', 'reject', 'exception', '']);

export function validateManifestRow(row) {
  const errors = [];
  if (!row.journal_entry_id) errors.push('missing journal_entry_id');
  if (!row.company_id) errors.push('missing company_id');
  const decision = String(row.operator_decision || '').trim().toLowerCase();
  if (decision && !OPERATOR_DECISIONS.has(decision)) {
    errors.push(`invalid operator_decision: ${decision}`);
  }
  if (decision === 'approve' && !row.approved_branch_id) {
    errors.push('approve requires approved_branch_id');
  }
  return errors;
}

export function countApprovedRows(rows) {
  return rows.filter((r) => String(r.operator_decision || '').trim().toLowerCase() === 'approve').length;
}

export function branchLabel(branch) {
  if (!branch) return '';
  const code = branch.code ? String(branch.code) : '';
  const name = branch.name ? String(branch.name) : '';
  if (code && name) return `${code} — ${name}`;
  return code || name || branch.id || '';
}
