/** Native + direct production API (ndmcore Kong / Mini PC edge). */
const PRODUCTION_API = 'https://api.ndmcore.com';

export type ResolveSupabaseApiUrlOptions = {
  isNativeCapacitor?: boolean;
  isDev?: boolean;
};

/**
 * Production (PWA + native Capacitor): https://api.ndmcore.com
 * (auth/rest/storage; CORS allows capacitor://localhost).
 * Vite dev browser: same-origin → proxy (avoids CORS). Never on native Capacitor.
 */
export function resolveSupabaseApiUrl(
  raw?: string,
  opts?: ResolveSupabaseApiUrlOptions,
): string {
  if (opts?.isNativeCapacitor) {
    return PRODUCTION_API;
  }

  const isDev =
    opts?.isDev ??
    Boolean(
      typeof import.meta !== 'undefined' &&
        (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
    );

  // Vite dev browser: same-origin → proxy (avoids CORS). Never on native Capacitor.
  if (typeof window !== 'undefined' && isDev && !opts?.isNativeCapacitor) {
    const origin = window.location.origin.replace(/\/$/, '');
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/i.test(origin)) {
      return origin;
    }
  }

  const trimmed = String(raw ?? '').trim().replace(/\/$/, '');
  if (!trimmed) return PRODUCTION_API;
  // Treat ERP web host as API mis-bake → canonical API.
  if (/erp\.ndmcore\.com/i.test(trimmed) || /api\.ndmcore\.com/i.test(trimmed)) {
    return PRODUCTION_API;
  }
  // Dev .env often sets localhost for Vite proxy; only keep localhost when isDev proxy mode is active.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) {
    return isDev ? trimmed : PRODUCTION_API;
  }
  return trimmed;
}
