/**
 * Read/write centralized printing settings from companies.printing_settings.
 */
import { supabase } from '@/lib/supabase';
import type { CompanyPrintingSettings, ThermalSettings } from '@/app/types/printingSettings';
import { DEFAULT_THERMAL, mergeWithDefaults } from '@/app/types/printingSettings';

/** Browser silent-print automation guide (POS kiosk — not an in-app API). */
export const POS_SILENT_PRINT_GUIDE = {
  chromeFlag: '--kiosk-printing',
  suggestedDeviceName: 'POSPrinter POS58',
  note:
    'Browser silent print is OS/Chrome policy. Set the Windows default printer to your POS58 device and launch Chrome/Edge with --kiosk-printing for unattended POS receipt printing.',
} as const;

/** Human-readable hint for Settings UI and docs. */
export function getPosPrintAutomationHint(thermal?: Partial<ThermalSettings>): string {
  const device = thermal?.posPrinterDeviceName?.trim() || DEFAULT_THERMAL.posPrinterDeviceName!;
  return [
    `Preferred printer: ${device}`,
    `Launch flag: ${POS_SILENT_PRINT_GUIDE.chromeFlag}`,
    POS_SILENT_PRINT_GUIDE.note,
  ].join(' · ');
}

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
