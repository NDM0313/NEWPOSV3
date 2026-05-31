const ERP_PROXY = 'https://erp.dincouture.pk';
const DIRECT = 'https://supabase.dincouture.pk';

export type ResolveSupabaseApiUrlOptions = {
  isNativeCapacitor?: boolean;
  isDev?: boolean;
};

/**
 * PWA/browser: direct supabase.dincouture.pk (Kong echoes https://erp.dincouture.pk Origin).
 * Native Capacitor: https://erp.dincouture.pk nginx proxy (/auth, /rest, /storage) so
 * capacitor://localhost gets Access-Control-Allow-Origin from deploy/nginx.conf.
 */
export function resolveSupabaseApiUrl(
  raw?: string,
  opts?: ResolveSupabaseApiUrlOptions,
): string {
  if (opts?.isNativeCapacitor) {
    return ERP_PROXY;
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
  if (!trimmed) return DIRECT;
  if (/erp\.dincouture\.pk/i.test(trimmed)) return DIRECT;
  // Dev .env often sets localhost for Vite proxy; only keep localhost when isDev proxy mode is active.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) {
    return isDev ? trimmed : DIRECT;
  }
  return trimmed;
}
