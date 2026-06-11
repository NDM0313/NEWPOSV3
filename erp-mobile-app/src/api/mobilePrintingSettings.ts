import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  mergeWithDefaults,
  type CompanyPrintingSettings,
  type FieldsConfig,
} from '../types/printingSettings';

export interface MobileCompanyCurrency {
  currency: string;
  currencySymbol: string | null;
  showCurrencySymbol: boolean;
  decimalPrecision: number;
}

/** Receipt visibility toggles (subset of fields). */
export interface ReceiptFieldToggles {
  showLogo: boolean;
  showCompanyAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showStudioCost: boolean;
  showNotes: boolean;
}

export const DEFAULT_RECEIPT_FIELDS: ReceiptFieldToggles = {
  showLogo: true,
  showCompanyAddress: true,
  showPhone: true,
  showEmail: false,
  showDiscount: true,
  showTax: true,
  showStudioCost: true,
  showNotes: true,
};

export interface MobilePrintingSettingsBundle {
  printingSettings: ReturnType<typeof mergeWithDefaults>;
  fields: FieldsConfig;
  receiptFields: ReceiptFieldToggles;
  currency: MobileCompanyCurrency;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: MobilePrintingSettingsBundle }>();

function parsePrintingSettings(raw: unknown): CompanyPrintingSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as CompanyPrintingSettings;
}

function toReceiptFields(fields: FieldsConfig): ReceiptFieldToggles {
  return {
    showLogo: fields.showLogo,
    showCompanyAddress: fields.showCompanyAddress,
    showPhone: fields.showPhone,
    showEmail: fields.showEmail,
    showDiscount: fields.showDiscount,
    showTax: fields.showTax,
    showStudioCost: fields.showStudioCost !== false,
    showNotes: fields.showNotes,
  };
}

const DEFAULT_CURRENCY: MobileCompanyCurrency = {
  currency: 'PKR',
  currencySymbol: null,
  showCurrencySymbol: true,
  decimalPrecision: 2,
};

export function invalidateMobilePrintingSettingsCache(companyId?: string): void {
  if (companyId) cache.delete(companyId);
  else cache.clear();
}

export async function getMobilePrintingSettings(
  companyId: string | null,
  opts?: { forceRefresh?: boolean },
): Promise<{ data: MobilePrintingSettingsBundle; error: string | null }> {
  const fallback: MobilePrintingSettingsBundle = {
    printingSettings: mergeWithDefaults(null),
    fields: mergeWithDefaults(null).fields,
    receiptFields: { ...DEFAULT_RECEIPT_FIELDS },
    currency: { ...DEFAULT_CURRENCY },
  };

  if (!isSupabaseConfigured || !companyId) {
    return { data: fallback, error: null };
  }

  const cached = cache.get(companyId);
  if (!opts?.forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { data: cached.data, error: null };
  }

  const { data, error } = await supabase
    .from('companies')
    .select('printing_settings, currency, currency_symbol, show_currency_symbol, decimal_precision')
    .eq('id', companyId)
    .maybeSingle();

  if (error) {
    if (cached) return { data: cached.data, error: error.message };
    return { data: fallback, error: error.message };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const partial = parsePrintingSettings(row.printing_settings);
  const merged = mergeWithDefaults(partial);
  const bundle: MobilePrintingSettingsBundle = {
    printingSettings: merged,
    fields: merged.fields,
    receiptFields: toReceiptFields(merged.fields),
    currency: {
      currency: String(row.currency || 'PKR'),
      currencySymbol: row.currency_symbol != null ? String(row.currency_symbol) : null,
      showCurrencySymbol: row.show_currency_symbol !== false,
      decimalPrecision: Number(row.decimal_precision ?? 2),
    },
  };

  cache.set(companyId, { at: Date.now(), data: bundle });
  return { data: bundle, error: null };
}
