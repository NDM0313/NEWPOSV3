/**
 * Company-level data backup & export.
 * CSV/JSON export - no data loss risk.
 */
import { supabase } from '@/lib/supabase';

export interface BackupOptions {
  companyId: string;
  format: 'json' | 'csv';
  modules?: ('sales' | 'purchases' | 'contacts' | 'products' | 'expenses')[];
}

async function fetchTable<T>(table: string, companyId: string, companyColumn: string = 'company_id'): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(companyColumn, companyId);
  if (error) throw error;
  return (data || []) as T[];
}

/**
 * Export company data as JSON backup.
 */
export async function exportCompanyBackupJSON(options: BackupOptions): Promise<Blob> {
  const { companyId, modules = ['sales', 'purchases', 'contacts', 'products', 'expenses'] } = options;

  const backup: Record<string, unknown[]> = {};

  if (modules.includes('sales')) {
    backup.sales = await fetchTable('sales', companyId);
    backup.sale_items = await fetchTable('sale_items', companyId, 'company_id').catch(() => []);
  }
  if (modules.includes('purchases')) {
    backup.purchases = await fetchTable('purchases', companyId);
    backup.purchase_items = await fetchTable('purchase_items', companyId, 'company_id').catch(() => []);
  }
  if (modules.includes('contacts')) {
    backup.contacts = await fetchTable('contacts', companyId);
  }
  if (modules.includes('products')) {
    backup.products = await fetchTable('products', companyId);
    backup.product_variations = await fetchTable('product_variations', companyId, 'company_id').catch(() => []);
  }
  if (modules.includes('expenses')) {
    backup.expenses = await fetchTable('expenses', companyId);
  }

  backup.meta = {
    exportedAt: new Date().toISOString(),
    companyId,
    format: 'json',
  };

  const json = JSON.stringify(backup, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Export company data as CSV (sales only for simplicity).
 */
export async function exportCompanyBackupCSV(options: BackupOptions): Promise<Blob> {
  const { companyId } = options;
  const sales = await fetchTable<Record<string, unknown>>('sales', companyId);

  if (sales.length === 0) {
    return new Blob(['No data to export'], { type: 'text/csv' });
  }

  const headers = Object.keys(sales[0]);
  const rows = sales.map((row) =>
    headers.map((h) => {
      const v = row[h];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    })
  );
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Trigger download of backup file.
 */
export function downloadBackup(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
