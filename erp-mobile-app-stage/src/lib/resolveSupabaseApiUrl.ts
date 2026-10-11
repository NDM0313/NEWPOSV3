/** Staging clone API (isolated from production api.ndmcore.com). */
const STAGING_API = 'https://api-stage.ndmcore.com';

export type ResolveSupabaseApiUrlOptions = {
  isNativeCapacitor?: boolean;
  isDev?: boolean;
};

/**
 * Staging PWA / Capacitor clone — always prefer api-stage.
 * This file exists ONLY under erp-mobile-app-stage/ (production tree untouched).
 */
export function resolveSupabaseApiUrl(
  raw?: string,
  opts?: ResolveSupabaseApiUrlOptions,
): string {
  if (opts?.isNativeCapacitor) {
    return STAGING_API;
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
  if (!trimmed) return STAGING_API;
  // Never fall back to production API from this staging clone.
  if (/api-stage\.ndmcore\.com/i.test(trimmed)) return STAGING_API;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) {
    return isDev ? trimmed : STAGING_API;
  }
  return STAGING_API;
}
