/**
 * Full-page admin/test routes that bypass normal view routing until pathname is reset.
 */

export const SPECIAL_APP_PATHS = [
  '/admin/permission-inspector',
  '/admin/developer-integrity-lab',
  '/admin/accounting-developer-center',
  '/admin/accounting-test-bench',
  '/test/accounting-edit-trace',
  '/test/ar-ap-truth-lab',
  '/test/expense-edit-trace',
  '/test/accounting-accounts-hierarchy',
] as const;

export function isSpecialAppPath(pathname: string): boolean {
  return (SPECIAL_APP_PATHS as readonly string[]).includes(pathname);
}

/** Reset URL to home when leaving a special full-page route (sidebar navigation). */
export function leaveSpecialAppRoute(homePath = '/'): void {
  if (typeof window === 'undefined') return;
  if (isSpecialAppPath(window.location.pathname)) {
    window.history.pushState({}, '', homePath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
