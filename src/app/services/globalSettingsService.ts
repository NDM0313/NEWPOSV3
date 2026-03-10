/**
 * Phase-2: Global Settings Engine
 * getSetting(key) with caching to avoid repeated DB calls.
 * Resolves from: (1) in-memory cache, (2) settings table, (3) companies row for known keys.
 */
import { supabase } from '@/lib/supabase';

const CACHE_TTL_MS = 60 * 1000; // 1 minute
const cache = new Map<string, { value: unknown; expires: number }>();

const COMPANY_KEYS: Record<string, string> = {
  company_name: 'name',
  businessName: 'name',
  business_name: 'name',
  currency: 'currency',
  timezone: 'timezone',
  time_zone: 'timezone',
  date_format: 'date_format',
  dateFormat: 'date_format',
  time_format: 'time_format',
  timeFormat: 'time_format',
  financial_year_start: 'financial_year_start',
  fiscalYearStart: 'financial_year_start',
  invoice_prefix: 'invoice_prefix',
  logo: 'logo_url',
  logoUrl: 'logo_url',
  symbol: 'currency_symbol',
  currency_symbol: 'currency_symbol',
  decimal_precision: 'decimal_precision',
  decimalPrecision: 'decimal_precision',
};

function cacheKey(companyId: string, key: string): string {
  return `${companyId}:${key}`;
}

/**
 * Get a setting value by key. Uses cache; refetches after TTL.
 * Keys can be from settings table or company (e.g. currency, timezone, company_name).
 */
export async function getSetting<T = unknown>(companyId: string, key: string): Promise<T | null> {
  if (!companyId) return null;

  const ck = cacheKey(companyId, key);
  const hit = cache.get(ck);
  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }

  const companyCol = COMPANY_KEYS[key] || COMPANY_KEYS[key.replace(/([A-Z])/g, '_$1').toLowerCase()];
  if (companyCol) {
    const { data } = await supabase.from('companies').select(companyCol).eq('id', companyId).single();
    const value = data?.[companyCol] ?? null;
    cache.set(ck, { value, expires: Date.now() + CACHE_TTL_MS });
    return value as T;
  }

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', key)
    .maybeSingle();

  const value = data?.value ?? null;
  cache.set(ck, { value, expires: Date.now() + CACHE_TTL_MS });
  return value as T;
}

/**
 * Invalidate cache for one key or all keys for a company.
 */
export function invalidateSetting(companyId: string, key?: string): void {
  if (!key) {
    for (const k of cache.keys()) {
      if (k.startsWith(`${companyId}:`)) cache.delete(k);
    }
    return;
  }
  cache.delete(cacheKey(companyId, key));
}

export const globalSettingsService = {
  getSetting,
  invalidateSetting,
};
