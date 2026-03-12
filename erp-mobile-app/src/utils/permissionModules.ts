/**
 * Map mobile screen/module id to backend permission module code (role_permissions.module).
 * Used for permission-based dashboard and navigation guard.
 */
import type { Screen } from '../types';

const SCREEN_TO_MODULE: Record<string, string> = {
  sales: 'sales',
  purchase: 'purchase', // singular to match DB
  pos: 'pos',          // match DB pos module
  rental: 'rentals',
  studio: 'studio',
  accounts: 'ledger',  // map accounts screen to ledger module
  expense: 'payments',  // fallback to payments as there is no expenses module
  products: 'inventory', // products screen maps to inventory module
  inventory: 'inventory',
  contacts: 'contacts',
  reports: 'reports',
  packing: 'sales',    // packing list is part of sales/wholesale workflow
  ledger: 'ledger',    // customer ledger read-only
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
