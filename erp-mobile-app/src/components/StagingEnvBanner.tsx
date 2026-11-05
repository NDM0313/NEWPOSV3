/**
 * Amber strip when the mobile build targets staging (api-stage / VITE_APP_ENV=stage).
 */
export function isStagingMobileBuild(): boolean {
  const env = (import.meta.env?.VITE_APP_ENV || '').toString().toLowerCase();
  if (env === 'stage' || env === 'staging') return true;
  const url = (import.meta.env?.VITE_SUPABASE_URL || '').toString();
  return /api-stage\.ndmcore\.com|erp-stage\.ndmcore\.com/i.test(url);
}

export function StagingEnvBanner() {
  if (!isStagingMobileBuild()) return null;
  return (
    <div
      className="erp-staging-banner w-full px-3 py-1.5 text-center text-xs font-bold tracking-wide text-[#1C1917] bg-amber-500 border-b border-amber-700"
      role="status"
      aria-label="Staging database"
    >
      [STAGING DB]
    </div>
  );
}
