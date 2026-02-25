/**
 * Mobile app settings stored in public.settings (SQL).
 * Used for offline/online sync status so it persists and can be shown across sessions.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const MOBILE_SYNC_KEY = 'mobile_sync_status';

export interface MobileSyncStatus {
  last_sync_at: string | null; // ISO timestamp
  last_synced_count: number;
  last_errors_count: number;
}

export async function getMobileSyncStatus(
  companyId: string | null
): Promise<{ data: MobileSyncStatus | null; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: null, error: null };
  }
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', MOBILE_SYNC_KEY)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  const raw = (data?.value as Record<string, unknown>) ?? {};
  return {
    data: {
      last_sync_at: (raw.last_sync_at as string) ?? null,
      last_synced_count: Number(raw.last_synced_count) ?? 0,
      last_errors_count: Number(raw.last_errors_count) ?? 0,
    },
    error: null,
  };
}

export async function setMobileSyncStatus(
  companyId: string | null,
  payload: { last_sync_at: string; last_synced_count: number; last_errors_count: number }
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { error: null };
  }
  const { error } = await supabase.from('settings').upsert(
    {
      company_id: companyId,
      key: MOBILE_SYNC_KEY,
      value: {
        last_sync_at: payload.last_sync_at,
        last_synced_count: payload.last_synced_count,
        last_errors_count: payload.last_errors_count,
      },
      category: 'mobile',
      description: 'Last sync time and counts for mobile app',
    },
    { onConflict: 'company_id,key' }
  );
  return { error: error?.message ?? null };
}

// --- Printer (standard method: thermal / A4 normal) - stored in settings so mobile can write without companies UPDATE ---

const MOBILE_PRINTER_KEY = 'mobile_printer';

export type MobilePrinterMode = 'thermal' | 'a4';
export type MobilePrinterPaperSize = '58mm' | '80mm';

export interface MobilePrinterSettings {
  mode: MobilePrinterMode;
  paperSize: MobilePrinterPaperSize;
  autoPrintReceipt: boolean;
}

const DEFAULT_MOBILE_PRINTER: MobilePrinterSettings = {
  mode: 'a4',
  paperSize: '80mm',
  autoPrintReceipt: false,
};

export async function getMobilePrinterSettings(
  companyId: string | null
): Promise<{ data: MobilePrinterSettings; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: DEFAULT_MOBILE_PRINTER, error: null };
  }
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', MOBILE_PRINTER_KEY)
    .maybeSingle();
  if (error) return { data: DEFAULT_MOBILE_PRINTER, error: error.message };
  const raw = (data?.value as Record<string, unknown>) ?? {};
  return {
    data: {
      mode: (raw.mode === 'thermal' ? 'thermal' : 'a4') as MobilePrinterMode,
      paperSize: (raw.paperSize === '58mm' ? '58mm' : '80mm') as MobilePrinterPaperSize,
      autoPrintReceipt: !!raw.autoPrintReceipt,
    },
    error: null,
  };
}

export async function setMobilePrinterSettings(
  companyId: string | null,
  payload: MobilePrinterSettings
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: null };
  const { error } = await supabase.from('settings').upsert(
    {
      company_id: companyId,
      key: MOBILE_PRINTER_KEY,
      value: {
        mode: payload.mode,
        paperSize: payload.paperSize,
        autoPrintReceipt: payload.autoPrintReceipt,
      },
      category: 'mobile',
      description: 'Printer: thermal receipt or A4 (normal)',
    },
    { onConflict: 'company_id,key' }
  );
  return { error: error?.message ?? null };
}

// --- Barcode scanner (standard method: keyboard wedge or camera) ---

const MOBILE_BARCODE_SCANNER_KEY = 'mobile_barcode_scanner';

export type BarcodeScannerMethod = 'keyboard_wedge' | 'camera';

export interface MobileBarcodeScannerSettings {
  method: BarcodeScannerMethod;
}

const DEFAULT_BARCODE_SCANNER: MobileBarcodeScannerSettings = {
  method: 'keyboard_wedge',
};

export async function getMobileBarcodeScannerSettings(
  companyId: string | null
): Promise<{ data: MobileBarcodeScannerSettings; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: DEFAULT_BARCODE_SCANNER, error: null };
  }
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', MOBILE_BARCODE_SCANNER_KEY)
    .maybeSingle();
  if (error) return { data: DEFAULT_BARCODE_SCANNER, error: error.message };
  const raw = (data?.value as Record<string, unknown>) ?? {};
  return {
    data: {
      method: (raw.method === 'camera' ? 'camera' : 'keyboard_wedge') as BarcodeScannerMethod,
    },
    error: null,
  };
}

export async function setMobileBarcodeScannerSettings(
  companyId: string | null,
  payload: MobileBarcodeScannerSettings
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: null };
  const { error } = await supabase.from('settings').upsert(
    {
      company_id: companyId,
      key: MOBILE_BARCODE_SCANNER_KEY,
      value: { method: payload.method },
      category: 'mobile',
      description: 'Barcode scanner: keyboard wedge (hardware) or camera',
    },
    { onConflict: 'company_id,key' }
  );
  return { error: error?.message ?? null };
}
