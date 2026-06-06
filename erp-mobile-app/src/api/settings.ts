/**
 * Mobile app settings stored in public.settings (SQL).
 * Used for offline/online sync status so it persists and can be shown across sessions.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getCompanyPrinterConfig,
  updateCompanyPrinterConfig,
  type CompanyPrinterConfig,
} from './companyPrinter';

const MOBILE_SYNC_KEY = 'mobile_sync_status';
const DEFAULT_DRESS_DEVALUATION_KEY = 'default_dress_devaluation';

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

export async function getDefaultDressDevaluation(
  companyId: string | null
): Promise<{ data: number; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { data: 5000, error: null };
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', DEFAULT_DRESS_DEVALUATION_KEY)
    .maybeSingle();
  if (error) return { data: 5000, error: error.message };
  const raw = data?.value;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return { data: Number.isFinite(value) && value >= 0 ? value : 5000, error: null };
}

export async function setDefaultDressDevaluation(
  companyId: string | null,
  amount: number
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: null };
  const normalized = Math.max(0, Math.round(Number(amount) || 0));
  const { error } = await supabase.from('settings').upsert(
    {
      company_id: companyId,
      key: DEFAULT_DRESS_DEVALUATION_KEY,
      value: normalized,
      category: 'rental',
      description: 'Default dress devaluation amount auto-posted on rental booking',
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
  /** Classic Bluetooth MAC for ESC/POS (e.g. 00:11:22:33:44:55). */
  bluetoothDeviceAddress?: string | null;
}

const DEFAULT_MOBILE_PRINTER: MobilePrinterSettings = {
  mode: 'a4',
  paperSize: '80mm',
  autoPrintReceipt: false,
  bluetoothDeviceAddress: null,
};

function parseMobilePrinterRaw(raw: Record<string, unknown>): MobilePrinterSettings {
  return {
    mode: (raw.mode === 'thermal' ? 'thermal' : 'a4') as MobilePrinterMode,
    paperSize: (raw.paperSize === '58mm' ? '58mm' : '80mm') as MobilePrinterPaperSize,
    autoPrintReceipt: !!raw.autoPrintReceipt,
    bluetoothDeviceAddress:
      typeof raw.bluetoothDeviceAddress === 'string' && raw.bluetoothDeviceAddress.trim()
        ? raw.bluetoothDeviceAddress.trim()
        : null,
  };
}

function companyToMobilePrinter(c: CompanyPrinterConfig): MobilePrinterSettings {
  return {
    mode: c.mode,
    paperSize: c.paperSize,
    autoPrintReceipt: c.autoPrintReceipt,
    bluetoothDeviceAddress: null,
  };
}

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
  return { data: parseMobilePrinterRaw(raw), error: null };
}

/** Mobile app printer settings; admins also merge company printer columns when mobile row is absent. */
export async function getEffectivePrinterSettings(
  companyId: string | null,
  options?: { syncFromCompany?: boolean }
): Promise<{ data: MobilePrinterSettings; error: string | null }> {
  const mobile = await getMobilePrinterSettings(companyId);
  if (!companyId || !options?.syncFromCompany) {
    return mobile;
  }
  const { data: rowCheck, error: rowErr } = await supabase
    .from('settings')
    .select('key')
    .eq('company_id', companyId)
    .eq('key', MOBILE_PRINTER_KEY)
    .maybeSingle();
  if (rowErr) return mobile;
  if (rowCheck?.key) return mobile;
  const { data: company, error: companyErr } = await getCompanyPrinterConfig(companyId);
  if (companyErr) return { data: mobile.data, error: companyErr };
  return { data: companyToMobilePrinter(company), error: null };
}

export async function setEffectivePrinterSettings(
  companyId: string | null,
  payload: MobilePrinterSettings,
  options?: { mirrorToCompany?: boolean }
): Promise<{ error: string | null }> {
  const { error: mobileErr } = await setMobilePrinterSettings(companyId, payload);
  if (mobileErr) return { error: mobileErr };
  if (!options?.mirrorToCompany || !companyId) return { error: null };
  const { error: companyErr } = await updateCompanyPrinterConfig(companyId, {
    mode: payload.mode,
    paperSize: payload.paperSize,
    autoPrintReceipt: payload.autoPrintReceipt,
  });
  return { error: companyErr };
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
        bluetoothDeviceAddress: payload.bluetoothDeviceAddress ?? null,
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

// --- Barcode label print defaults ---

const MOBILE_BARCODE_LABEL_KEY = 'mobile_barcode_label';

export type BarcodeLabelLayout = 'thermal' | 'a4';

export interface MobileBarcodeLabelSettings {
  labelLayout: BarcodeLabelLayout;
  showName: boolean;
  showPrice: boolean;
  /** @deprecated Use showCompanyName — kept for JSON round-trip */
  showBusinessName?: boolean;
  showVariation: boolean;
  showPacking: boolean;
  showCompanyName: boolean;
  showBranchName: boolean;
  defaultQuantity: number;
  /** Columns on A4 sticker sheet (2–4). */
  a4Columns: number;
  /** Max labels per A4 page (safety cap). */
  maxLabelsPerSheet: number;
  /** When printing from purchase PO, default qty = line quantity sum. */
  defaultLabelsFromPurchaseQty: boolean;
}

export const DEFAULT_BARCODE_LABEL: MobileBarcodeLabelSettings = {
  labelLayout: 'thermal',
  showName: true,
  showPrice: true,
  showBusinessName: true,
  showVariation: false,
  showPacking: false,
  showCompanyName: true,
  showBranchName: false,
  defaultQuantity: 1,
  a4Columns: 3,
  maxLabelsPerSheet: 30,
  defaultLabelsFromPurchaseQty: true,
};

function parseBarcodeLabelSettings(raw: Record<string, unknown>): MobileBarcodeLabelSettings {
  const cols = Number(raw.a4Columns);
  const legacyBiz = raw.showBusinessName !== false;
  const showCompany =
    raw.showCompanyName !== undefined ? raw.showCompanyName !== false : legacyBiz;
  return {
    labelLayout: raw.labelLayout === 'a4' ? 'a4' : 'thermal',
    showName: raw.showName !== false,
    showPrice: raw.showPrice !== false,
    showBusinessName: showCompany,
    showVariation: raw.showVariation === true,
    showPacking: raw.showPacking === true,
    showCompanyName: showCompany,
    showBranchName: raw.showBranchName === true,
    defaultQuantity: Math.max(1, Number(raw.defaultQuantity) || 1),
    a4Columns: cols >= 2 && cols <= 4 ? cols : 3,
    maxLabelsPerSheet: Math.max(6, Math.min(60, Number(raw.maxLabelsPerSheet) || 30)),
    defaultLabelsFromPurchaseQty: raw.defaultLabelsFromPurchaseQty !== false,
  };
}

export async function getMobileBarcodeLabelSettings(
  companyId: string | null
): Promise<{ data: MobileBarcodeLabelSettings; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: DEFAULT_BARCODE_LABEL, error: null };
  }
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', MOBILE_BARCODE_LABEL_KEY)
    .maybeSingle();
  if (error) return { data: DEFAULT_BARCODE_LABEL, error: error.message };
  const raw = (data?.value as Record<string, unknown>) ?? {};
  return { data: parseBarcodeLabelSettings(raw), error: null };
}

export async function setMobileBarcodeLabelSettings(
  companyId: string | null,
  payload: MobileBarcodeLabelSettings
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: null };
  const { error } = await supabase.from('settings').upsert(
    {
      company_id: companyId,
      key: MOBILE_BARCODE_LABEL_KEY,
      value: payload,
      category: 'mobile',
      description: 'Barcode label print defaults',
    },
    { onConflict: 'company_id,key' }
  );
  return { error: error?.message ?? null };
}

// --- Module toggles (same as Web: modules_config table). Company-wide: apply to all users/roles in that business. ---

export interface ModuleConfigRow {
  company_id: string;
  module_name: string;
  is_enabled: boolean;
}

const MODULE_CONFIG_NAMES = ['rentals', 'studio', 'accounting', 'production', 'pos', 'combos'] as const;

export interface ModuleToggles {
  rentalModuleEnabled: boolean;
  studioModuleEnabled: boolean;
  accountingModuleEnabled: boolean;
  posModuleEnabled: boolean;
}

const DEFAULT_MODULE_TOGGLES: ModuleToggles = {
  rentalModuleEnabled: true,
  studioModuleEnabled: true,
  accountingModuleEnabled: true,
  posModuleEnabled: true,
};

// --- Default payment accounts (mirrors web settings[key='default_accounts']) ---

export interface DefaultPaymentMethodSetting {
  id?: string;
  method: string;
  enabled?: boolean;
  defaultAccount?: string;
}

export interface DefaultAccountsSettings {
  paymentMethods: DefaultPaymentMethodSetting[];
}

const FALLBACK_DEFAULT_ACCOUNTS: DefaultAccountsSettings = {
  paymentMethods: [
    { id: '1', method: 'Cash', enabled: true, defaultAccount: '' },
    { id: '2', method: 'Bank', enabled: true, defaultAccount: '' },
    { id: '3', method: 'Mobile Wallet', enabled: true, defaultAccount: '' },
  ],
};

export async function getDefaultAccounts(
  companyId: string | null,
): Promise<{ data: DefaultAccountsSettings | null; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: null, error: null };
  }
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', 'default_accounts')
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  let raw = data?.value;
  if (raw == null) return { data: FALLBACK_DEFAULT_ACCOUNTS, error: null };
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { data: FALLBACK_DEFAULT_ACCOUNTS, error: null };
    }
  }
  const obj = raw as { paymentMethods?: DefaultPaymentMethodSetting[] };
  return {
    data: {
      paymentMethods: obj.paymentMethods?.length
        ? obj.paymentMethods
        : FALLBACK_DEFAULT_ACCOUNTS.paymentMethods,
    },
    error: null,
  };
}

// --- Enable Packing (per-company toggle). Mirrors web: settings[key='enable_packing'].value === true ---

export async function getEnablePacking(companyId: string | null): Promise<boolean> {
  if (!isSupabaseConfigured || !companyId) return false;
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', 'enable_packing')
    .maybeSingle();
  if (error) return false;
  return data?.value === true;
}

function parseNegativeStockValue(raw: unknown): boolean | null {
  if (raw == null) return null;
  let val = raw;
  if (typeof val === 'string') {
    try {
      val = JSON.parse(val);
    } catch {
      return val === 'true' || String(val).toLowerCase() === 'true';
    }
  }
  if (typeof val === 'object' && val !== null && 'negativeStockAllowed' in val) {
    const v = (val as { negativeStockAllowed?: boolean | string }).negativeStockAllowed;
    if (typeof v === 'boolean') return v;
    if (v === 'true' || String(v).toLowerCase() === 'true') return true;
    return false;
  }
  if (typeof val === 'boolean') return val;
  if (val === 'true' || String(val).toLowerCase() === 'true') return true;
  return false;
}

function parseLegacyNegativeStockFlag(raw: unknown): boolean {
  return raw === true || raw === 'true' || String(raw ?? '').toLowerCase() === 'true';
}

function resolveNegativeStockAllowed(
  inventory: boolean | null,
  pos: boolean | null,
  legacy: boolean,
): boolean {
  if (inventory === true || pos === true || legacy) return true;
  return false;
}

async function getNegativeStockAllowedFromSettings(companyId: string): Promise<boolean> {
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .eq('company_id', companyId)
    .in('key', ['inventory_settings', 'pos_settings', 'allow_negative_stock']);

  let inventory: boolean | null = null;
  let pos: boolean | null = null;
  let legacy = false;
  for (const row of rows || []) {
    if (row.key === 'inventory_settings') inventory = parseNegativeStockValue(row.value);
    else if (row.key === 'pos_settings') pos = parseNegativeStockValue(row.value);
    else if (row.key === 'allow_negative_stock') legacy = parseLegacyNegativeStockFlag(row.value);
  }
  return resolveNegativeStockAllowed(inventory, pos, legacy);
}

async function getNegativeStockAllowedViaRpc(companyId: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('get_company_negative_stock_allowed', {
    p_company_id: companyId,
  });
  if (error) return null;
  return data === true;
}

/** Company-level negative stock policy — OR inventory_settings, pos_settings, legacy; RPC fallback for staff RLS. */
export async function getNegativeStockAllowed(companyId: string | null): Promise<boolean> {
  if (!isSupabaseConfigured || !companyId) return false;
  const direct = await getNegativeStockAllowedFromSettings(companyId);
  if (direct) return true;
  const rpc = await getNegativeStockAllowedViaRpc(companyId);
  if (rpc === true) return true;
  return direct;
}

export async function getModuleConfigs(
  companyId: string | null
): Promise<{ data: ModuleToggles; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: DEFAULT_MODULE_TOGGLES, error: null };
  }
  const { data: rows, error } = await supabase
    .from('modules_config')
    .select('module_name, is_enabled')
    .eq('company_id', companyId)
    .in('module_name', [...MODULE_CONFIG_NAMES]);
  if (error) return { data: DEFAULT_MODULE_TOGGLES, error: error.message };
  const map = new Map<string, boolean>();
  (rows || []).forEach((r) => map.set(r.module_name, r.is_enabled === true));
  return {
    data: {
      rentalModuleEnabled: map.get('rentals') ?? true,
      studioModuleEnabled: map.get('studio') ?? true,
      accountingModuleEnabled: map.get('accounting') ?? true,
      posModuleEnabled: map.get('pos') ?? true,
    },
    error: null,
  };
}

export async function setEnablePacking(companyId: string, value: boolean): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: 'App not configured.' };
  const { error } = await supabase.from('settings').upsert(
    {
      company_id: companyId,
      key: 'enable_packing',
      value,
      category: 'inventory',
      description: 'Enable Packing (Boxes/Pieces) – when OFF, packing is hidden system-wide',
    },
    { onConflict: 'company_id,key' },
  );
  return { error: error?.message ?? null };
}

export async function setModuleEnabled(
  companyId: string,
  moduleName: string,
  isEnabled: boolean,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: 'App not configured.' };
  const { error } = await supabase.from('modules_config').upsert(
    {
      company_id: companyId,
      module_name: moduleName,
      is_enabled: isEnabled,
    },
    { onConflict: 'company_id,module_name' },
  );
  return { error: error?.message ?? null };
}
