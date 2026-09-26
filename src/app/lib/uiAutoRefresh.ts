/**
 * Passive UI auto-refresh (Realtime + fallback poll + visibility remounts).
 * Default OFF unless VITE_UI_AUTO_REFRESH=1 — keeps scroll/filters stable while testing.
 * Explicit Refresh and local post-mutation invalidations still apply.
 */
export function isUiAutoRefreshEnabled(): boolean {
  return import.meta.env.VITE_UI_AUTO_REFRESH === '1';
}

/** Realtime / fallback-poll / visibility-driven remount reasons. */
export function isPassiveUiInvalidationReason(reason?: string | null): boolean {
  const r = String(reason ?? '').toLowerCase();
  return (
    r.includes('realtime-change') ||
    r.includes('fallback-poll') ||
    r.includes('visibility')
  );
}

/** When auto-refresh is off, ignore passive invalidation producers. */
export function shouldIgnorePassiveInvalidation(reason?: string | null): boolean {
  if (isUiAutoRefreshEnabled()) return false;
  return isPassiveUiInvalidationReason(reason);
}
