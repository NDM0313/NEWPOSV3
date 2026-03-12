/**
 * Couriers list for shipment modal (read-only on mobile).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CourierRow {
  id: string;
  name: string;
  contact_id: string | null;
}

export async function getCouriersByCompany(companyId: string): Promise<{ data: CourierRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('couriers')
    .select('id, name, contact_id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as CourierRow[], error: null };
}
