/**
 * Read-only feature flag access for mobile ERP.
 * No writes — production flags are managed on web/ops only.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export async function isFeatureFlagEnabled(companyId: string, featureKey: string): Promise<boolean> {
  if (!isSupabaseConfigured || !companyId) return false;
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('company_id', companyId)
    .eq('feature_key', featureKey)
    .maybeSingle();
  if (error || !data) return false;
  return data.enabled === true;
}

export async function getFeatureFlagsForCompany(companyId: string): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured || !companyId) return {};
  const { data, error } = await supabase
    .from('feature_flags')
    .select('feature_key, enabled')
    .eq('company_id', companyId);
  if (error) {
    if (error.code === '42P01') return {};
    console.warn('[featureFlags] getAll error:', error.message);
    return {};
  }
  const map: Record<string, boolean> = {};
  for (const row of data || []) {
    map[row.feature_key] = row.enabled === true;
  }
  return map;
}
