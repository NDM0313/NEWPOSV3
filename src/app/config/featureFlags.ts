/**
 * Feature flags for safe testing. Do not remove.
 * FEATURE_PERMISSION_V2: when true, enables lightweight enterprise UI and User Permissions tab.
 * When false, original UI and behaviour remain.
 * Runtime override: localStorage key "erp_feature_permission_v2" ("true" | "false") wins over this default.
 */
export const FEATURE_PERMISSION_V2 = true;

const STORAGE_KEY = 'erp_feature_permission_v2';

export function getFeaturePermissionV2(): boolean {
  if (typeof window === 'undefined') return FEATURE_PERMISSION_V2;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // SecurityError when localStorage is denied (e.g. iframe, strict privacy)
  }
  return FEATURE_PERMISSION_V2;
}

export function setFeaturePermissionV2Storage(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // ignore when storage is denied
  }
}
