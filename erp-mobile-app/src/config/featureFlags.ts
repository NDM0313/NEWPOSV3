/**
 * Mobile ERP feature flags. Toggle to enable permission-driven UI (same as Web).
 */
const KEY = 'erp_mobile_feature_permission_v2';

/** Opt-in: allow admin/owner to edit manager/user role matrix on device (default off for staging safety). */
const KEY_ROLE_MATRIX_EDITOR = 'erp_mobile_feature_role_matrix_editor';

export const FEATURE_MOBILE_PERMISSION_V2 =
  typeof window !== 'undefined'
    ? (() => {
        try {
          const v = localStorage.getItem(KEY);
          return v !== 'false'; // true by default (v2 always on unless explicitly disabled)
        } catch {
          return true;
        }
      })()
    : false;

/** When true, admin/owner may edit `role_permissions` for manager/user only (see UserPermissionsScreen). */
export const FEATURE_MOBILE_ROLE_MATRIX_EDITOR =
  typeof window !== 'undefined'
    ? (() => {
        try {
          return localStorage.getItem(KEY_ROLE_MATRIX_EDITOR) === 'true';
        } catch {
          return false;
        }
      })()
    : false;

export function getFeatureMobilePermissionV2(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v !== 'false';
  } catch {
    return true;
  }
}

export function setFeatureMobilePermissionV2Storage(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('erp-mobile-permission-v2-changed', { detail: enabled }));
  } catch {}
}

export function getFeatureMobileRoleMatrixEditor(): boolean {
  try {
    return localStorage.getItem(KEY_ROLE_MATRIX_EDITOR) === 'true';
  } catch {
    return false;
  }
}

export function setFeatureMobileRoleMatrixEditorStorage(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_ROLE_MATRIX_EDITOR, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('erp-mobile-role-matrix-editor-changed', { detail: enabled }));
  } catch {}
}
