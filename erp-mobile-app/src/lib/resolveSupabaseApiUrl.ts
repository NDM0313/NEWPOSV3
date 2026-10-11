/** Native + direct production API (ndmcore Kong / Mini PC edge). */
const PRODUCTION_API = 'https://api.ndmcore.com';
const STAGING_API = 'https://api-stage.ndmcore.com';

export type ResolveSupabaseApiUrlOptions = {
  isNativeCapacitor?: boolean;
  isDev?: boolean;
};

/**
 * Production (PWA + native Capacitor): https://api.ndmcore.com
 * Staging .env (api-stage): use api-stage directly (even in Vite DEV) so a
 * misconfigured/stale localhost proxy cannot send the staging anon key to
 * production Kong (plain "Unauthorized").
 * Vite DEV + production URL: same-origin → proxy.
 */
export function resolveSupabaseApiUrl(
  raw?: string,
  opts?: ResolveSupabaseApiUrlOptions,
): string {
  const trimmed = String(raw ?? '').trim().replace(/\/$/, '');

  // Explicit staging URL always wins (browser + native stage testing).
  if (/api-stage\.ndmcore\.com/i.test(trimmed)) {
    return STAGING_API;
  }

  if (opts?.isNativeCapacitor) {
    return PRODUCTION_API;
  }

  const isDev =
    opts?.isDev ??
    Boolean(
      typeof import.meta !== 'undefined' &&
        (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
    );

  // Vite DEV + production config: same-origin → proxy (avoids CORS).
  if (typeof window !== 'undefined' && isDev && !opts?.isNativeCapacitor) {
    const origin = window.location.origin.replace(/\/$/, '');
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/i.test(origin)) {
      // Only use localhost proxy when env is NOT staging.
      if (!/api-stage/i.test(trimmed)) {
        return origin;
      }
    }
  }

  if (!trimmed) return PRODUCTION_API;
  // Treat ERP web host / production API host as canonical production API.
  if (/erp\.ndmcore\.com/i.test(trimmed) || /api\.ndmcore\.com/i.test(trimmed)) {
    return PRODUCTION_API;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) {
    return isDev ? trimmed : PRODUCTION_API;
  }
  return trimmed;
}
