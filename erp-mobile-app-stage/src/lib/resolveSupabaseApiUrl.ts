/** Staging clone API (isolated from production api.ndmcore.com). */
const STAGING_API = 'https://api-stage.ndmcore.com';

export type ResolveSupabaseApiUrlOptions = {
  isNativeCapacitor?: boolean;
  isDev?: boolean;
};

/**
 * Staging clone — always talk to api-stage directly (no localhost Vite proxy).
 * Avoids stale :5175 processes proxying the staging anon key to production Kong
 * (plain "Unauthorized" → JSON parse crash).
 */
export function resolveSupabaseApiUrl(
  _raw?: string,
  _opts?: ResolveSupabaseApiUrlOptions,
): string {
  return STAGING_API;
}
