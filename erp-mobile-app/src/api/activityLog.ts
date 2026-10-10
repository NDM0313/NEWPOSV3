import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type ActivityModule =
  | 'sale'
  | 'purchase'
  | 'inventory'
  | 'payment'
  | 'expense'
  | 'accounting'
  | 'contact'
  | 'product'
  | 'rental';

export interface ActivityLogRow {
  id: string;
  company_id: string;
  module: ActivityModule;
  entity_id: string;
  entity_reference?: string | null;
  action: string;
  field?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  amount?: number | null;
  payment_method?: string | null;
  performed_by?: string | null;
  performed_by_name?: string | null;
  description?: string | null;
  notes?: string | null;
  created_at: string;
}

export async function getEntityActivityLogs(
  companyId: string,
  module: ActivityModule,
  entityId: string,
  limit = 100,
): Promise<{ data: ActivityLogRow[]; error: string | null }> {
  if (!isSupabaseConfigured || !companyId || !entityId) {
    return { data: [], error: null };
  }
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('company_id', companyId)
    .eq('module', module)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as ActivityLogRow[], error: null };
}

export function formatActivityLog(log: ActivityLogRow): string {
  const userName = log.performed_by_name || 'Unknown';

  switch (log.action) {
    case 'create':
      return `${userName} created ${log.entity_reference || log.module}`;
    case 'update':
      if (log.field && log.old_value !== undefined && log.new_value !== undefined) {
        return `${userName} updated ${log.field}: ${String(log.old_value)} → ${String(log.new_value)}`;
      }
      return `${userName} updated ${log.entity_reference || log.module}`;
    case 'status_change':
      return `${userName} changed status: ${String(log.old_value ?? '')} → ${String(log.new_value ?? '')}`;
    case 'payment_added':
      return `${userName} received Rs ${Number(log.amount ?? 0).toLocaleString()}${log.payment_method ? ` via ${log.payment_method}` : ''}`;
    case 'payment_edited':
      return log.description || `${userName} edited payment`;
    case 'payment_deleted':
      return `${userName} removed payment Rs ${Number(log.amount ?? 0).toLocaleString()}`;
    case 'attachment_added':
      return log.description || `${userName} added attachment(s) to sale ${log.entity_reference || log.module}`;
    case 'attachment_removed':
      return log.description || `${userName} removed attachment(s) from sale ${log.entity_reference || log.module}`;
    case 'sale_component_edited':
      return log.description || `${userName} edited ${log.field || 'sale'}`;
    case 'delete':
      return `${userName} deleted ${log.entity_reference || log.module}`;
    default:
      return log.description || `${userName} — ${log.action}`;
  }
}
