/**
 * Audit Log: write to audit_logs for sales, payments, purchases, production orders.
 * Table columns: company_id, user_id, table_name, record_id, action, old_data, new_data, created_at.
 * Entity = table_name, entity_id = record_id, metadata in new_data.
 */

import { supabase } from '@/lib/supabase';

export type AuditEntity =
  | 'sales'
  | 'payments'
  | 'purchases'
  | 'production_orders'
  | 'journal_entries'
  | 'quotations';

export type AuditAction = 'created' | 'updated' | 'deleted' | 'cancelled' | 'restored';

export interface AuditLogEntry {
  company_id: string;
  user_id: string | null;
  entity: AuditEntity;
  entity_id: string;
  action: AuditAction;
  metadata?: Record<string, unknown> | null;
  old_data?: Record<string, unknown> | null;
}

/**
 * Resolve current user id (public.users.id) from auth. Uses auth_user_id -> users.id.
 */
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.id) return null;
  const { data: row } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();
  return row?.id ?? null;
}

/**
 * Insert one audit log row. Maps entity -> table_name, entity_id -> record_id, metadata -> new_data.
 */
export async function logAudit(entry: AuditLogEntry): Promise<{ error: Error | null }> {
  const user_id = entry.user_id ?? await getCurrentUserId();
  const { error } = await supabase.from('audit_logs').insert({
    company_id: entry.company_id,
    user_id,
    table_name: entry.entity,
    record_id: entry.entity_id,
    action: entry.action,
    old_data: entry.old_data ?? null,
    new_data: entry.metadata ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

/**
 * Convenience: log sale created/updated/deleted.
 */
export async function logSaleAction(
  companyId: string,
  saleId: string,
  action: AuditAction,
  metadata?: Record<string, unknown> | null,
  oldData?: Record<string, unknown> | null
): Promise<void> {
  await logAudit({
    company_id: companyId,
    user_id: null,
    entity: 'sales',
    entity_id: saleId,
    action,
    metadata: metadata ?? undefined,
    old_data: oldData ?? undefined,
  });
}

/**
 * Convenience: log payment created/deleted.
 */
export async function logPaymentAction(
  companyId: string,
  paymentId: string,
  action: 'created' | 'deleted',
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await logAudit({
    company_id: companyId,
    user_id: null,
    entity: 'payments',
    entity_id: paymentId,
    action,
    metadata: metadata ?? undefined,
  });
}

/**
 * Convenience: log purchase created/updated/deleted.
 */
export async function logPurchaseAction(
  companyId: string,
  purchaseId: string,
  action: AuditAction,
  metadata?: Record<string, unknown> | null,
  oldData?: Record<string, unknown> | null
): Promise<void> {
  await logAudit({
    company_id: companyId,
    user_id: null,
    entity: 'purchases',
    entity_id: purchaseId,
    action,
    metadata: metadata ?? undefined,
    old_data: oldData ?? undefined,
  });
}

/**
 * Convenience: log production order created/updated/deleted.
 */
export async function logProductionOrderAction(
  companyId: string,
  orderId: string,
  action: AuditAction,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await logAudit({
    company_id: companyId,
    user_id: null,
    entity: 'production_orders',
    entity_id: orderId,
    action,
    metadata: metadata ?? undefined,
  });
}

export const auditLogService = {
  logAudit,
  logSaleAction,
  logPaymentAction,
  logPurchaseAction,
  logProductionOrderAction,
};
