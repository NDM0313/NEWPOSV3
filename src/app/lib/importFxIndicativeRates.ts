/**
 * Online indicative FX rates for Import FX W2 ARRANGEMENT planning.
 * Planning-only — never posts journals. Manual override always allowed.
 *
 * Default source: open.er-api.com (no API key). Adapter-shaped for swap later.
 */

import { normalizeCurrencyCode, normalizeImportDocCurrency } from '@/app/lib/importFxHelpers';

export const INDICATIVE_RATE_PROVIDER = 'open.er-api.com';

export const INDICATIVE_RATE_HELPER_COPY =
  'Online indicative rate — not financially posted. You can change it.';

export type IndicativeRateBundle = {
  baseCurrency: string;
  /** Units of company base per 1 USD */
  basePerUsd: number | null;
  /** Units of company base per 1 CNY */
  basePerCny: number | null;
  /** W2 column: PKR per 1 USD */
  pkrPerUsd: number | null;
  /** W2 column: CNY per 1 USD */
  cnyPerUsd: number | null;
  provider: string;
  fetchedAt: string;
};

export type FetchIndicativeRatesDeps = {
  fetchImpl?: typeof fetch;
  /** Abort / timeout ms (default 8000) */
  timeoutMs?: number;
  /** Override latest URL builder for tests */
  buildUrl?: (baseCurrency: string) => string;
};

type OpenErApiResponse = {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  'error-type'?: string;
};

function roundRate(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return NaN;
  // Keep enough precision for PKR-scale rates without noisy float tails.
  if (n >= 100) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 10000) / 10000;
  return Math.round(n * 1e6) / 1e6;
}

export function defaultIndicativeRateUrl(baseCurrency: string): string {
  const base = normalizeCurrencyCode(baseCurrency) || 'PKR';
  return `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
}

/**
 * open.er-api returns quote units per 1 base.
 * We need base units per 1 quote (same meaning as purchase fx_rate_to_base).
 */
export function invertQuotePerBase(quotePerBase: number): number {
  const q = Number(quotePerBase);
  if (!Number.isFinite(q) || q <= 0) return NaN;
  return roundRate(1 / q);
}

/**
 * Pure mapping from an API rates table (quote-per-1-base) into W2 planning bundle.
 */
export function mapOpenErRatesToIndicativeBundle(params: {
  baseCurrency: string;
  rates: Record<string, number>;
  fetchedAt?: string;
  provider?: string;
}): IndicativeRateBundle {
  const base = normalizeImportDocCurrency(params.baseCurrency) || 'PKR';
  const rates: Record<string, number> = {};
  for (const [k, v] of Object.entries(params.rates || {})) {
    const code = normalizeCurrencyCode(k);
    if (!code || !Number.isFinite(Number(v)) || Number(v) <= 0) continue;
    rates[code] = Number(v);
  }

  let basePerUsd: number | null = null;
  let basePerCny: number | null = null;
  let pkrPerUsd: number | null = null;
  let cnyPerUsd: number | null = null;

  if (base === 'USD') {
    basePerUsd = 1;
    if (rates.CNY) {
      basePerCny = invertQuotePerBase(rates.CNY);
      // rates.CNY is CNY per 1 USD when base is USD
      cnyPerUsd = roundRate(rates.CNY);
    }
    if (rates.PKR) {
      pkrPerUsd = roundRate(rates.PKR);
    }
  } else if (base === 'PKR') {
    if (rates.USD) {
      basePerUsd = invertQuotePerBase(rates.USD);
      pkrPerUsd = basePerUsd;
    }
    if (rates.CNY) {
      basePerCny = invertQuotePerBase(rates.CNY);
    }
    if (rates.USD && rates.CNY) {
      // CNY per USD = (CNY per PKR) / (USD per PKR) = rates.CNY / rates.USD
      cnyPerUsd = roundRate(rates.CNY / rates.USD);
    }
  } else {
    // Generic base (e.g. EUR): invert for USD/CNY; also derive PKR/USD and CNY/USD when possible.
    if (rates.USD) basePerUsd = invertQuotePerBase(rates.USD);
    if (rates.CNY) basePerCny = invertQuotePerBase(rates.CNY);
    if (rates.USD && rates.PKR) {
      // PKR per USD = (PKR per base) / (USD per base) = rates.PKR / rates.USD
      pkrPerUsd = roundRate(rates.PKR / rates.USD);
    }
    if (rates.USD && rates.CNY) {
      cnyPerUsd = roundRate(rates.CNY / rates.USD);
    }
  }

  const clean = (n: number | null): number | null =>
    n != null && Number.isFinite(n) && n > 0 ? n : null;

  return {
    baseCurrency: base,
    basePerUsd: clean(basePerUsd),
    basePerCny: clean(basePerCny),
    pkrPerUsd: clean(pkrPerUsd),
    cnyPerUsd: clean(cnyPerUsd),
    provider: params.provider || INDICATIVE_RATE_PROVIDER,
    fetchedAt: params.fetchedAt || new Date().toISOString(),
  };
}

export function formatIndicativeRateLabel(baseCurrency: string, quoteCurrency: string): string {
  const base = normalizeCurrencyCode(baseCurrency) || 'PKR';
  const quote = normalizeImportDocCurrency(quoteCurrency) || quoteCurrency;
  // W2.1: explicit directional wording (never ambiguous slash forms like CNY/USD).
  if (base === 'PKR' && quote === 'USD') return 'Indicative PKR per 1 USD';
  if (base === 'PKR' && quote === 'CNY') return 'Indicative PKR per 1 CNY';
  if (base === 'USD' && quote === 'CNY') return 'Indicative USD required per 1 CNY';
  if (base === 'CNY' && quote === 'USD') return 'Indicative CNY received per 1 USD';
  return `Indicative ${base} per 1 ${quote}`;
}

export function rateToInputString(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

/**
 * Fetch indicative rates quoted against company base currency.
 */
export async function fetchIndicativeRates(
  params: { baseCurrency: string; symbols?: string[] },
  deps: FetchIndicativeRatesDeps = {}
): Promise<IndicativeRateBundle> {
  const base = normalizeImportDocCurrency(params.baseCurrency) || 'PKR';
  const fetchImpl = deps.fetchImpl || fetch;
  const timeoutMs = deps.timeoutMs ?? 8000;
  const url = (deps.buildUrl || defaultIndicativeRateUrl)(base);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Indicative rate service returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as OpenErApiResponse;
    if (body.result && body.result !== 'success') {
      throw new Error(body['error-type'] || 'Indicative rate service failed');
    }
    if (!body.rates || typeof body.rates !== 'object') {
      throw new Error('Indicative rate service returned no rates');
    }
    return mapOpenErRatesToIndicativeBundle({
      baseCurrency: body.base_code || base,
      rates: body.rates,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Indicative rate request timed out — enter the rate manually');
    }
    const msg = e instanceof Error ? e.message : 'Indicative rate request failed';
    throw new Error(`${msg}. Enter the rate manually.`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Decide which planning fields an auto-fill may overwrite.
 * Dirty or non-empty fields are skipped unless forceReplace is true (explicit Refresh).
 */
export function pickIndicativeFieldsToApply(params: {
  bundle: IndicativeRateBundle;
  dirtyPkrPerUsd: boolean;
  dirtyCnyPerUsd: boolean;
  dirtyBasePerCny?: boolean;
  forceReplace: boolean;
  currentPkrPerUsd?: string;
  currentCnyPerUsd?: string;
  currentBasePerCny?: string;
}): {
  pkrPerUsd: string | null;
  cnyPerUsd: string | null;
  basePerCny: string | null;
} {
  const force = params.forceReplace === true;
  const allow = (dirty: boolean | undefined, current?: string) =>
    force || (!(dirty === true) && !(String(current || '').trim()));
  return {
    pkrPerUsd: allow(params.dirtyPkrPerUsd, params.currentPkrPerUsd)
      ? rateToInputString(params.bundle.pkrPerUsd) || null
      : null,
    cnyPerUsd: allow(params.dirtyCnyPerUsd, params.currentCnyPerUsd)
      ? rateToInputString(params.bundle.cnyPerUsd) || null
      : null,
    basePerCny: allow(params.dirtyBasePerCny, params.currentBasePerCny)
      ? rateToInputString(params.bundle.basePerCny) || null
      : null,
  };
}
