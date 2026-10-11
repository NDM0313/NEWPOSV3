/** Production Kong / Mini PC edge. */
const PRODUCTION_API = 'https://api.ndmcore.com';
/** Staging Kong → erp_core. */
const STAGING_API = 'https://api-stage.ndmcore.com';
/** Canonical Mini PC API — production + native Capacitor must always use this host. */
export const CANONICAL_SUPABASE_API_URL = 'https://api.ndmcore.com';

const LEGACY_HOST_RE = /dincouture\.pk|72\.62\.254\.176/i;

export type ResolveSupabaseApiUrlOptions = {
  isNativeCapacitor?: boolean;
  isDev?: boolean;
};

function isStagingApiUrl(url: string): boolean {
  return /api-stage\.ndmcore\.com/i.test(url) || /erp-stage\.ndmcore\.com/i.test(url);
}

/**
 * Production (PWA + native Capacitor): https://api.ndmcore.com
 * Staging bake (VITE_SUPABASE_URL=https://api-stage.ndmcore.com): keep staging on native too.
 * Vite dev browser: same-origin → proxy (avoids CORS). Never on native Capacitor.
function isLegacyOrBlockedHost(url: string): boolean {
  return LEGACY_HOST_RE.test(url);

 * Option A (ndmcore): production + native always resolve to CANONICAL_SUPABASE_API_URL.
 * Vite dev browser on localhost/LAN may use same-origin proxy; never return VPS hosts.
 */
export function resolveSupabaseApiUrl(
  raw?: string,
  opts?: ResolveSupabaseApiUrlOptions,
): string {
  const trimmed = String(raw ?? '').trim().replace(/\/$/, '');

  // Explicit staging bake wins (including native Capacitor).
  if (isStagingApiUrl(trimmed)) {
    return STAGING_API;
  }

  if (opts?.isNativeCapacitor) {
    return CANONICAL_SUPABASE_API_URL;
    return PRODUCTION_API;
  }

  const isDev =
    opts?.isDev ??
    Boolean(
      typeof import.meta !== 'undefined' &&
        (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
    );

  if (!isDev) {
    return CANONICAL_SUPABASE_API_URL;
  }

  // Vite dev browser: same-origin → proxy (avoids CORS). Never on native Capacitor.
  if (typeof window !== 'undefined' && !opts?.isNativeCapacitor) {
    const origin = window.location.origin.replace(/\/$/, '');
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/i.test(origin)) {
      return origin;
    }
  }

  if (!trimmed) return PRODUCTION_API;
  // Treat ERP web host / exact api.ndmcore.com as canonical production API.
  // Do not match api-stage.ndmcore.com (handled above).
  if (/erp\.ndmcore\.com/i.test(trimmed) || /(^|[/.])api\.ndmcore\.com([/:?]|$)/i.test(trimmed)) {
    return PRODUCTION_API;
  }
  // Hardcoded office LAN Kong (Mixed Content on https://erp.ndmcore.com).
  if (
    /192\.168\.86\.235(?::8000)?/i.test(trimmed) ||
    /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(trimmed)
  ) {
  // Dev .env often sets localhost for Vite proxy; only keep localhost when isDev proxy mode is active.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) {
    return isDev ? trimmed : PRODUCTION_API;
  const trimmed = String(raw ?? '').trim().replace(/\/$/, '');
  if (!trimmed || isLegacyOrBlockedHost(trimmed)) {
    return CANONICAL_SUPABASE_API_URL;
    return trimmed;
  }
  return trimmed;
}
