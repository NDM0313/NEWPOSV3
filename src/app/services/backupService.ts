/**
 * Company-level data backup export.
 * Exports critical tables as JSON - no data loss risk (read-only).
 */
import { supabase } from '@/lib/supabase';
import { exportToJSON } from '@/app/utils/exportUtils';
import { handleApiError } from '@/app/utils/errorUtils';

const BACKUP_SCHEMA_VERSION = 1;

type JsonRow = Record<string, unknown>;

export interface CompanyBackupData {
  meta: {
    schema_version: number;
    exported_at: string;
    company_id: string;
    company_name?: string;
  };
  data: {
    branches: JsonRow[];
    accounts: JsonRow[];
    contacts: JsonRow[];
    products: JsonRow[];
    product_variations: JsonRow[];
    sales: JsonRow[];
    sales_items: JsonRow[];
    purchases: JsonRow[];
    purchase_items: JsonRow[];
    rentals: JsonRow[];
    rental_items: JsonRow[];
    rental_payments: JsonRow[];
    expenses: JsonRow[];
    payments: JsonRow[];
    journal_entries: JsonRow[];
    journal_entry_lines: JsonRow[];
    ledger_entries: JsonRow[];
  };
}

function chunkRows<T>(rows: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function insertMany(table: string, rows: JsonRow[]): Promise<void> {
  if (!rows.length) return;
  const chunks = chunkRows(rows, 400);
  for (const batch of chunks) {
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
  }
}

async function upsertMany(table: string, rows: JsonRow[], onConflict: string): Promise<void> {
  if (!rows.length) return;
  const chunks = chunkRows(rows, 400);
  for (const batch of chunks) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict, ignoreDuplicates: false });
    if (error) throw error;
  }
}

function isProtectedSystemWalkInContact(row: JsonRow): boolean {
  return row.is_system_generated === true && String(row.system_type || '').toLowerCase() === 'walking_customer';
}

async function deleteByCompany(table: string, companyId: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('company_id', companyId);
  if (error) throw error;
}

async function fetchByCompany(table: string, companyId: string): Promise<JsonRow[]> {
  const { data, error } = await supabase.from(table).select('*').eq('company_id', companyId);
  if (error) throw error;
  return (data || []) as JsonRow[];
}

async function fetchByParentIds(table: string, fkColumn: string, parentIds: string[]): Promise<JsonRow[]> {
  if (!parentIds.length) return [];
  const { data, error } = await supabase.from(table).select('*').in(fkColumn, parentIds);
  if (error) throw error;
  return (data || []) as JsonRow[];
}

async function deleteByParentIds(table: string, fkColumn: string, parentIds: string[]): Promise<void> {
  if (!parentIds.length) return;
  const chunks = chunkRows(parentIds, 500);
  for (const ids of chunks) {
    const { error } = await supabase.from(table).delete().in(fkColumn, ids);
    if (error) throw error;
  }
}

export async function exportCompanyBackup(companyId: string): Promise<CompanyBackupData> {
  if (!companyId) {
    throw new Error('Company ID is required');
  }

  try {
    const { data, error } = await supabase.rpc('export_company_backup_rpc', {
      p_company_id: companyId,
    });
    if (error) throw error;

    const payload = (data || {}) as {
      success?: boolean;
      error?: string;
      backup?: CompanyBackupData;
      counts?: Record<string, number>;
    };
    if (!payload.success || !payload.backup) {
      throw new Error(payload.error || 'Export RPC failed');
    }

    return payload.backup;
  } catch (error) {
    handleApiError('Backup', error);
    throw error;
  }
}

export async function restoreCompanyBackup(companyId: string, backup: CompanyBackupData): Promise<{ restored: Record<string, number> }> {
  if (!companyId) throw new Error('Company ID is required');
  if (!backup?.meta?.company_id) throw new Error('Invalid backup: missing meta.company_id');
  if (backup.meta.company_id !== companyId) throw new Error('Backup company_id does not match active company.');
  if (!backup?.data) throw new Error('Invalid backup: missing data payload');
  const { data, error } = await supabase.rpc('restore_company_backup_rpc', {
    p_company_id: companyId,
    p_backup: backup,
    p_confirmation: 'RESTORE',
  });
  if (error) throw error;

  const payload = (data || {}) as { success?: boolean; error?: string; restored?: Record<string, number> };
  if (!payload.success) {
    throw new Error(payload.error || 'Restore RPC failed');
  }

  return {
    restored: payload.restored || {},
  };
}

/** Wrapper for Settings UI - returns true on success, false on error */
export async function exportAndDownloadBackup(companyId: string): Promise<boolean> {
  try {
    const backup = await exportCompanyBackup(companyId);
    const filename = `backup_${(backup.meta.company_name || companyId.slice(0, 8)).replace(/\s/g, '_')}`;
    exportToJSON(backup, filename);
    return true;
  } catch {
    return false;
  }
}
