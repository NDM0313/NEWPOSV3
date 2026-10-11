/** Canonical Mini PC API — production + native Capacitor must always use this host. */
export const CANONICAL_SUPABASE_API_URL = 'https://api.ndmcore.com';

const LEGACY_HOST_RE = /dincouture\.pk|72\.62\.254\.176/i;

export type ResolveSupabaseApiUrlOptions = {
  isNativeCapacitor?: boolean;
  isDev?: boolean;
};

function isLegacyOrBlockedHost(url: string): boolean {
  return LEGACY_HOST_RE.test(url);
}

/**
 * Option A (ndmcore): production + native always resolve to CANONICAL_SUPABASE_API_URL.
 * Vite dev browser on localhost/LAN may use same-origin proxy; never return VPS hosts.
 */
export function resolveSupabaseApiUrl(
  raw?: string,
  opts?: ResolveSupabaseApiUrlOptions,
): string {
  if (opts?.isNativeCapacitor) {
    return CANONICAL_SUPABASE_API_URL;
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

  const trimmed = String(raw ?? '').trim().replace(/\/$/, '');
  if (!trimmed || isLegacyOrBlockedHost(trimmed)) {
    return CANONICAL_SUPABASE_API_URL;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}
