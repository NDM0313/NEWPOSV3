/**
 * Developer Integrity Lab — persistent fix queue (integrity_lab_issues).
 * Requires migration 20260332_developer_integrity_lab.sql
 */

import { supabase } from '@/lib/supabase';

export type IntegrityIssueStatus =
  | 'new'
  | 'reviewed'
  | 'ready_to_post'
  | 'ready_to_relink'
  | 'ready_to_reverse_repost'
  | 'resolved'
  | 'ignored_by_rule';

export interface IntegrityLabIssueRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  severity: string;
  module: string | null;
  source_type: string | null;
  source_id: string | null;
  journal_entry_id: string | null;
  journal_line_id: string | null;
  account_id: string | null;
  rule_code: string;
  rule_message: string | null;
  expected_payload: unknown;
  actual_payload: unknown;
  suggested_action: string | null;
  impact_summary: string | null;
  status: IntegrityIssueStatus;
  bucket: string | null;
  priority: number;
  owner_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
}

export async function listIntegrityIssues(
  companyId: string,
  opts?: { hideResolved?: boolean; hideReviewed?: boolean; bucket?: string; limit?: number }
): Promise<IntegrityLabIssueRow[]> {
  let q = supabase
    .from('integrity_lab_issues')
    .select('*')
    .eq('company_id', companyId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 300);
  if (opts?.hideResolved) q = q.neq('status', 'resolved').neq('status', 'ignored_by_rule');
  if (opts?.hideReviewed) q = q.neq('status', 'reviewed');
  if (opts?.bucket) q = q.eq('bucket', opts.bucket);
  const { data, error } = await q;
  if (error) {
    if (error.code === 'PGRST205' || String(error.message || '').includes('does not exist')) return [];
    throw new Error(error.message);
  }
  return (data || []) as IntegrityLabIssueRow[];
}

export async function insertIntegrityIssue(
  row: Omit<Partial<IntegrityLabIssueRow>, 'company_id' | 'rule_code' | 'severity'> &
    Pick<IntegrityLabIssueRow, 'company_id' | 'rule_code' | 'severity'>
): Promise<IntegrityLabIssueRow | null> {
  const { data, error } = await supabase
    .from('integrity_lab_issues')
    .insert({
      company_id: row.company_id,
      branch_id: row.branch_id ?? null,
      severity: row.severity,
      module: row.module ?? null,
      source_type: row.source_type ?? null,
      source_id: row.source_id ?? null,
      journal_entry_id: row.journal_entry_id ?? null,
      journal_line_id: row.journal_line_id ?? null,
      account_id: row.account_id ?? null,
      rule_code: row.rule_code,
      rule_message: row.rule_message ?? null,
      expected_payload: row.expected_payload ?? null,
      actual_payload: row.actual_payload ?? null,
      suggested_action: row.suggested_action ?? null,
      impact_summary: row.impact_summary ?? null,
      status: (row.status as IntegrityIssueStatus) || 'new',
      bucket: row.bucket ?? null,
      priority: row.priority ?? 0,
      owner_user_id: row.owner_user_id ?? null,
      notes: row.notes ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[integrityIssueRepository] insert failed:', error.message);
    return null;
  }
  return data as IntegrityLabIssueRow;
}

export async function updateIntegrityIssueStatus(
  id: string,
  status: IntegrityIssueStatus,
  extras?: { notes?: string; last_reviewed_by?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'resolved') {
    patch.resolved_at = new Date().toISOString();
    if (extras?.last_reviewed_by) patch.resolved_by = extras.last_reviewed_by;
  }
  if (extras?.notes !== undefined) patch.notes = extras.notes;
  if (extras?.last_reviewed_by) {
    patch.last_reviewed_at = new Date().toISOString();
    patch.last_reviewed_by = extras.last_reviewed_by;
  }
  const { error } = await supabase.from('integrity_lab_issues').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}
