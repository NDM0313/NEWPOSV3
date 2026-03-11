/**
 * Read/write centralized printing settings from companies.printing_settings.
 */
import { supabase } from '@/lib/supabase';
import type { CompanyPrintingSettings } from '@/app/types/printingSettings';
import { mergeWithDefaults } from '@/app/types/printingSettings';

export const printingSettingsService = {
  async get(companyId: string): Promise<{ data: CompanyPrintingSettings | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('printing_settings')
        .eq('id', companyId)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }
      const raw = (data as { printing_settings?: unknown })?.printing_settings;
      const parsed = (typeof raw === 'object' && raw !== null ? raw : {}) as CompanyPrintingSettings;
      return { data: parsed, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Failed to load printing settings' };
    }
  },

  async update(companyId: string, settings: CompanyPrintingSettings): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ printing_settings: settings })
        .eq('id', companyId);

      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to save printing settings' };
    }
  },

  /** Get settings merged with defaults (for UI). */
  async getMerged(companyId: string) {
    const { data, error } = await this.get(companyId);
    if (error) return { data: null, error };
    return { data: mergeWithDefaults(data), error: null };
  },
};
