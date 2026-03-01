/**
 * Map mobile screen/module id to backend permission module code (role_permissions.module).
 * Used for permission-based dashboard and navigation guard.
 */
import type { Screen } from '../types';

const SCREEN_TO_MODULE: Record<string, string> = {
  sales: 'sales',
  purchase: 'purchase',
  pos: 'pos',
  rental: 'rentals',
  studio: 'studio',
  accounts: 'accounts',
  expense: 'expense',
  products: 'products',
  inventory: 'inventory',
  contacts: 'contacts',
  reports: 'reports',
  settings: 'settings',
  dashboard: 'reports', // dashboard uses reports permission
  home: 'reports',     // home always shown; "More" grid still filtered
};

export function getPermissionModuleForScreen(screen: Screen): string | null {
  return SCREEN_TO_MODULE[screen] ?? null;
}

export function screenRequiresPermission(screen: Screen): boolean {
  return screen !== 'login' && screen !== 'branch-selection' && screen !== 'home' && getPermissionModuleForScreen(screen) != null;
}
