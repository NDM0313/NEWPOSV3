/**
 * Feature Flags Service (Safe Zone / Feature Toggle)
 * Company-scoped flags. No row = disabled (safe default).
 * Used for Studio Production V2 and future optional features.
 */

import { supabase } from '@/lib/supabase';

export const FEATURE_KEYS = {
  STUDIO_PRODUCTION_V2: 'studio_production_v2',
  STUDIO_PRODUCTION_V3: 'studio_production_v3',
  STUDIO_CUSTOMER_INVOICE_V1: 'studio_customer_invoice_v1',
  /** TEST only: WIP inventory layer (design in docs/WIP_INVENTORY_DESIGN.md). Do not enable in production until approved. */
  STUDIO_WIP_INVENTORY_TEST: 'studio_wip_inventory_test',
  /** TEST only: Kanban board backend (RPC get_studio_kanban_board_test). Do not enable in production until approved. */
  STUDIO_KANBAN_BOARD_TEST: 'studio_kanban_board_test',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export interface FeatureFlagRow {
  id: string;
  company_id: string;
  feature_key: string;
  enabled: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const featureFlagsService = {
  /**
   * Get all feature flags for a company.
   * Missing row for a key = treated as disabled.
   */
  async getAll(companyId: string): Promise<Record<string, boolean>> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('feature_key, enabled')
      .eq('company_id', companyId);

    if (error) {
      if (error.code === '42P01') return {}; // table does not exist yet
      console.warn('[FEATURE_FLAGS] getAll error:', error);
      return {};
    }

    const map: Record<string, boolean> = {};
    for (const row of data || []) {
      map[row.feature_key] = row.enabled === true;
    }
    return map;
  },

  /**
   * Check if a feature is enabled for the company.
   * No row or enabled=false → false.
   */
  async isEnabled(companyId: string, featureKey: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('company_id', companyId)
      .eq('feature_key', featureKey)
      .maybeSingle();

    if (error || !data) return false;
    return data.enabled === true;
  },

  /**
   * Set a feature flag. Upserts by (company_id, feature_key).
   */
  async setEnabled(
    companyId: string,
    featureKey: string,
    enabled: boolean,
    description?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('feature_flags')
      .upsert(
        {
          company_id: companyId,
          feature_key: featureKey,
          enabled,
          ...(description != null && { description }),
        },
        { onConflict: 'company_id,feature_key' }
      );

    if (error) throw error;
  },
};
