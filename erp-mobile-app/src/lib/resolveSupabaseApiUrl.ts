const DIRECT = 'https://supabase.dincouture.pk';

/** Mobile/PWA: never route Supabase API through erp.dincouture.pk nginx /storage proxy. */
export function resolveSupabaseApiUrl(raw?: string): string {
  const trimmed = String(raw ?? '').trim().replace(/\/$/, '');
  if (!trimmed) return DIRECT;
  if (/erp\.dincouture\.pk/i.test(trimmed)) return DIRECT;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) return trimmed;
  return trimmed;
}
