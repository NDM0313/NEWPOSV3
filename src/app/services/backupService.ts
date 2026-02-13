/**
 * Company-level data backup export.
 * Exports critical tables as JSON - no data loss risk (read-only).
 */
import { supabase } from '@/lib/supabase';
import { exportToJSON } from '@/app/utils/exportUtils';
import { handleApiError } from '@/app/utils/errorUtils';

export interface CompanyBackupData {
  exportedAt: string;
  companyId: string;
  companyName?: string;
  contacts: unknown[];
  products: unknown[];
  sales: unknown[];
  purchases: unknown[];
  expenses: unknown[];
}

export async function exportCompanyBackup(companyId: string): Promise<void> {
  if (!companyId) {
    throw new Error('Company ID is required');
  }

  try {
    const [companyRes, contactsRes, productsRes, salesRes, purchasesRes, expensesRes] = await Promise.all([
      supabase.from('companies').select('id, business_name').eq('id', companyId).single(),
      supabase.from('contacts').select('*').eq('company_id', companyId),
      supabase.from('products').select('*').eq('company_id', companyId),
      supabase.from('sales').select('*').eq('company_id', companyId),
      supabase.from('purchases').select('*').eq('company_id', companyId),
      supabase.from('expenses').select('*').eq('company_id', companyId),
    ]);

    const backup: CompanyBackupData = {
      exportedAt: new Date().toISOString(),
      companyId,
      companyName: (companyRes.data as { business_name?: string })?.business_name,
      contacts: contactsRes.data ?? [],
      products: productsRes.data ?? [],
      sales: salesRes.data ?? [],
      purchases: purchasesRes.data ?? [],
      expenses: expensesRes.data ?? [],
    };

    const filename = `backup_${backup.companyName?.replace(/\s/g, '_') || companyId.slice(0, 8)}`;
    exportToJSON(backup, filename);
  } catch (error) {
    handleApiError('Backup', error);
    throw error;
  }
}

/** Wrapper for Settings UI - returns true on success, false on error */
export async function exportAndDownloadBackup(companyId: string): Promise<boolean> {
  try {
    await exportCompanyBackup(companyId);
    return true;
  } catch {
    return false;
  }
}
