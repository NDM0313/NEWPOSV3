/**
 * China import purchasing FX helpers.
 * Converts document FC ↔ base PKR for UI; GL still posts existing PKR fields only.
 */

export type ActiveImportCurrency = { code: string; label: string };

/** Document currency code: PKR base, or any admin-configured foreign code (e.g. CNY, USD). */
export type ImportDocCurrency = string;

export const DEFAULT_ACTIVE_IMPORT_CURRENCIES: ActiveImportCurrency[] = [
  { code: 'CNY', label: 'RMB (CNY)' },
  { code: 'USD', label: 'US Dollar' },
];

/** @deprecated Prefer resolveActiveImportCurrencies + labelForImportCurrency */
export const IMPORT_DOC_CURRENCY_LABELS: Record<string, string> = {
  PKR: 'PKR',
  CNY: 'RMB (CNY)',
  USD: 'USD',
};

export function normalizeCurrencyCode(raw: string | null | undefined): string {
  const c = String(raw || '').toUpperCase().trim();
  if (c === 'RMB') return 'CNY';
  return c;
}

export function resolveActiveImportCurrencies(
  settings?: { activeCurrencies?: ActiveImportCurrency[] | null } | null
): ActiveImportCurrency[] {
  const raw = settings?.activeCurrencies;
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_ACTIVE_IMPORT_CURRENCIES.map((c) => ({ ...c }));
  }
  const seen = new Set<string>();
  const out: ActiveImportCurrency[] = [];
  for (const row of raw) {
    const code = normalizeCurrencyCode(row?.code);
    if (!code || code === 'PKR' || seen.has(code)) continue;
    const label = String(row?.label || code).trim() || code;
    seen.add(code);
    out.push({ code, label });
  }
  return out.length > 0 ? out : DEFAULT_ACTIVE_IMPORT_CURRENCIES.map((c) => ({ ...c }));
}

export function labelForImportCurrency(
  code: string | null | undefined,
  active?: ActiveImportCurrency[]
): string {
  const c = normalizeCurrencyCode(code) || 'PKR';
  if (c === 'PKR') return 'PKR';
  const list = active?.length ? active : DEFAULT_ACTIVE_IMPORT_CURRENCIES;
  const hit = list.find((x) => x.code === c);
  if (hit) return hit.label;
  return IMPORT_DOC_CURRENCY_LABELS[c] || c;
}

export function foreignToBasePkr(foreignAmount: number, rateToBase: number): number {
  const fc = Number(foreignAmount) || 0;
  const rate = Number(rateToBase) || 0;
  if (!(fc > 0) || !(rate > 0)) return 0;
  return Math.round(fc * rate * 100) / 100;
}

export function basePkrToForeign(pkrAmount: number, rateToBase: number): number | null {
  const pkr = Number(pkrAmount) || 0;
  const rate = Number(rateToBase) || 0;
  if (!(rate > 0)) return null;
  return Math.round((pkr / rate) * 100) / 100;
}

/** True when document currency is a foreign (non-PKR) code. */
export function isForeignImportCurrency(currency: ImportDocCurrency | string | null | undefined): boolean {
  const c = normalizeCurrencyCode(currency);
  return c.length > 0 && c !== 'PKR';
}

export function normalizeImportDocCurrency(raw: string | null | undefined): ImportDocCurrency {
  const c = normalizeCurrencyCode(raw);
  if (!c) return 'PKR';
  return c;
}

/** True when a purchase (or similar) row has a foreign document currency. */
export function isForeignPurchaseDoc(purchase: {
  documentCurrency?: string | null;
  document_currency?: string | null;
} | null | undefined): boolean {
  if (!purchase) return false;
  return isForeignImportCurrency(purchase.documentCurrency ?? purchase.document_currency);
}

