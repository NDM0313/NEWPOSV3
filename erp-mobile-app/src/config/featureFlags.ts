/**
 * Mobile ERP feature flags. Toggle to enable permission-driven UI (same as Web).
 */
const KEY = 'erp_mobile_feature_permission_v2';

export const FEATURE_MOBILE_PERMISSION_V2 =
  typeof window !== 'undefined'
    ? (() => {
        try {
          const v = localStorage.getItem(KEY);
          return v === 'true'; // false when unset → old behavior
        } catch {
          return false;
        }
      })()
    : false;

export function getFeatureMobilePermissionV2(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setFeatureMobilePermissionV2Storage(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('erp-mobile-permission-v2-changed', { detail: enabled }));
  } catch {}
}
