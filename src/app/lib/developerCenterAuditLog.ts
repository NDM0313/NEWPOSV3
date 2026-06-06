/**
 * Developer Center audit log view helpers (Phase E/F) — read-only.
 */

export interface DeveloperCenterAuditRow {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  before: string;
  after: string;
  reasonCode: string;
  source: 'party_repair_audit' | 'integrity_lab' | 'developer_repair';
}

export function mapPartyRepairAuditRow(row: {
  id: string;
  created_at: string;
  table_name: string;
  row_id: string;
  column_name: string;
  old_value: string | null;
  new_value: string | null;
  reason_code: string;
  applied_by: string | null;
}): DeveloperCenterAuditRow {
  return {
    id: row.id,
    timestamp: row.created_at,
    action: `repair_${row.column_name}`,
    entityType: row.table_name,
    entityId: row.row_id,
    actorId: row.applied_by,
    before: row.old_value ?? '—',
    after: row.new_value ?? '—',
    reasonCode: row.reason_code,
    source: 'party_repair_audit',
  };
}

export function mapDeveloperRepairAuditRow(row: {
  id: string;
  created_at: string;
  action_id: string;
  target_table: string | null;
  target_id: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  status: string;
  user_id: string | null;
  confirm_phrase: string;
  error_message: string | null;
}): DeveloperCenterAuditRow {
  return {
    id: row.id,
    timestamp: row.created_at,
    action: row.action_id,
    entityType: row.target_table || 'developer_repair',
    entityId: row.target_id || '—',
    actorId: row.user_id,
    before: JSON.stringify(row.before_json ?? {}),
    after: JSON.stringify(row.after_json ?? {}),
    reasonCode: row.status === 'failed' ? row.error_message || row.confirm_phrase : row.confirm_phrase,
    source: 'developer_repair',
  };
}

export function defaultAuditLogDateRange(todayIso?: string): { dateFrom: string; dateTo: string } {
  const today = (todayIso || new Date().toISOString()).slice(0, 10);
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 90);
  return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
}
