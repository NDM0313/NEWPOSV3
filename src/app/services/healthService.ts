import { supabase } from '@/lib/supabase';

export interface ErpHealthRow {
  component: string;
  status: 'OK' | 'FAIL' | 'SKIP';
  details: string | null;
}

export interface ErpHealthDashboardResult {
  rows: ErpHealthRow[];
  overall: 'PASS' | 'FAIL';
  error?: string;
}

/**
 * Fetch ERP health dashboard (admin/owner only).
 * Uses view erp_health_dashboard (includes Permission Engine Integrity when present). Never throws; returns error in result.
 */
export async function getHealthDashboard(): Promise<ErpHealthDashboardResult> {
  try {
    const { data, error } = await supabase.from('erp_health_dashboard').select('component, status, details');
    if (error) {
      return {
        rows: [],
        overall: 'FAIL',
        error: error.message,
      };
    }
    const rows: ErpHealthRow[] = Array.isArray(data)
      ? data.map((r: { component?: string; status?: string; details?: string | null }) => ({
          component: r?.component ?? '',
          status: (r?.status ?? 'SKIP') as 'OK' | 'FAIL' | 'SKIP',
          details: r?.details ?? null,
        }))
      : [];
    const hasFail = rows.some((r) => r.status === 'FAIL');
    return {
      rows,
      overall: hasFail ? 'FAIL' : 'PASS',
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      rows: [],
      overall: 'FAIL',
      error: message,
    };
  }
}

export const healthService = {
  getHealthDashboard,
};
