/** Opt-in verbose ERP logs in dev: `localStorage.setItem('DEBUG_ERP', '1')` then refresh. */
export function isDebugErpEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_ERP') === '1';
  } catch {
    return false;
  }
}
