/**
 * Permission Engine – load permissions once at login, cache in memory + localStorage.
 * All UI permission checks read from cache; no DB permission queries during session.
 * Single source of truth for session permissions.
 */
import { getRolePermissions, type EngineRole, type RolePermissionRow } from '@/app/services/permissionService';
import type { UserPermissions } from '@/app/utils/checkPermission';

const CACHE_KEY_PREFIX = 'erp_perm_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface PermissionCacheEntry {
  userId: string;
  companyId: string;
  role: EngineRole;
  permissions: RolePermissionRow[];
  derived: UserPermissions;
  loadedAt: number;
}

let memoryCache: PermissionCacheEntry | null = null;

function cacheKey(userId: string, companyId: string, role: EngineRole): string {
  return `${CACHE_KEY_PREFIX}${userId}_${companyId}_${role}`;
}

function isStale(loadedAt: number): boolean {
  return Date.now() - loadedAt > CACHE_TTL_MS;
}

function deriveFromRows(rolePerms: RolePermissionRow[], role: 'Admin' | 'Manager' | 'Staff'): UserPermissions {
  const visibilityScopeActions = ['view_own', 'view_branch', 'view_company'];
  const hasPurchase = rolePerms.some(x => x.module === 'purchase' && (visibilityScopeActions.includes(x.action) || x.action === 'create') && x.allowed);
  const hasPos = rolePerms.some(x => x.module === 'pos' && (x.action === 'use' || x.action === 'view') && x.allowed);
  const hasStudio = rolePerms.some(x => x.module === 'studio' && (visibilityScopeActions.includes(x.action) || ['view', 'create', 'edit', 'delete'].includes(x.action)) && x.allowed);
  const hasRentals = rolePerms.some(x => x.module === 'rentals' && (visibilityScopeActions.includes(x.action) || x.action === 'create') && x.allowed);
  const hasSalesView = rolePerms.some(x => x.module === 'sales' && visibilityScopeActions.includes(x.action) && x.allowed);
  const hasSalesCreate = rolePerms.some(x => x.module === 'sales' && x.action === 'create' && x.allowed);
  const hasSalesEdit = rolePerms.some(x => x.module === 'sales' && x.action === 'edit' && x.allowed);
  const hasSalesDelete = rolePerms.some(x => x.module === 'sales' && x.action === 'delete' && x.allowed);
  const hasReportsView = rolePerms.some(x => x.module === 'reports' && x.action === 'view' && x.allowed);
  const hasAccountingVisibility = rolePerms.some(x => x.module === 'ledger' && (visibilityScopeActions.includes(x.action) || x.action === 'view_full_accounting' || x.action === 'view_supplier') && x.allowed);
  const hasInventory = rolePerms.some(x => x.module === 'inventory' && (visibilityScopeActions.includes(x.action) || x.action === 'view') && x.allowed);
  const hasContacts = rolePerms.some(x => x.module === 'contacts' && (visibilityScopeActions.includes(x.action) || x.action === 'create') && x.allowed);
  const hasContactsCreate = rolePerms.some(x => x.module === 'contacts' && x.action === 'create' && x.allowed);
  const hasContactsDelete = rolePerms.some(x => x.module === 'contacts' && x.action === 'delete' && x.allowed);
  const hasUsers = rolePerms.some(x => x.module === 'users' && (x.action === 'create' || x.action === 'edit' || x.action === 'delete' || x.action === 'assign_permissions') && x.allowed);
  const hasSettings = rolePerms.some(x => x.module === 'settings' && x.action === 'modify' && x.allowed);
  const hasPaymentsReceive = rolePerms.some(x => x.module === 'payments' && (visibilityScopeActions.includes(x.action) || x.action === 'receive') && x.allowed);
  const hasPaymentsEdit = rolePerms.some(x => x.module === 'payments' && x.action === 'edit' && x.allowed);
  const hasPurchaseEdit = rolePerms.some(x => x.module === 'purchase' && x.action === 'edit' && x.allowed);
  const hasPurchaseDelete = rolePerms.some(x => x.module === 'purchase' && x.action === 'delete' && x.allowed);

  return {
    role,
    canCreateSale: hasSalesCreate,
    canEditSale: hasSalesEdit,
    canDeleteSale: hasSalesDelete,
    canCancelSale: role === 'Admin' || role === 'Manager',
    canViewReports: hasReportsView,
    canManageSettings: hasSettings,
    canManageUsers: hasUsers,
    canAccessAccounting: hasAccountingVisibility,
    canMakePayments: hasPaymentsEdit || hasPaymentsReceive,
    canReceivePayments: hasPaymentsReceive,
    canManageExpenses: hasPaymentsReceive,
    canManageProducts: hasInventory,
    canManagePurchases: hasPurchase,
    canManageRentals: hasRentals,
    canEditPurchase: hasPurchaseEdit,
    canDeletePurchase: hasPurchaseDelete,
    canUsePos: hasPos ?? (role === 'Admin' || role === 'Manager'),
    canAccessStudio: hasStudio ?? (role === 'Admin' || role === 'Manager'),
    canViewSale: hasSalesView,
    canViewContacts: hasContacts,
    canCreateContact: hasContactsCreate ?? hasContacts,
    canDeleteContact: hasContactsDelete,
  };
}

/**
 * Load permissions for user/company/role. Uses cache (memory then localStorage) when valid.
 * Only hits DB once per (userId, companyId, role) per session / within TTL.
 */
export async function loadPermissions(
  userId: string,
  companyId: string,
  role: EngineRole,
  uiRole: 'Admin' | 'Manager' | 'Staff'
): Promise<UserPermissions> {
  const key = cacheKey(userId, companyId, role);

  if (memoryCache && memoryCache.userId === userId && memoryCache.companyId === companyId && memoryCache.role === role && !isStale(memoryCache.loadedAt)) {
    return memoryCache.derived;
  }

  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as PermissionCacheEntry;
      if (parsed.userId === userId && parsed.companyId === companyId && parsed.role === role && !isStale(parsed.loadedAt)) {
        memoryCache = parsed;
        return parsed.derived;
      }
    }
  } catch {
    // ignore localStorage parse errors
  }

  const rolePerms = await getRolePermissions(role);
  const derived = deriveFromRows(rolePerms, uiRole);
  const entry: PermissionCacheEntry = {
    userId,
    companyId,
    role,
    permissions: rolePerms,
    derived,
    loadedAt: Date.now(),
  };
  memoryCache = entry;
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // quota or disabled
  }
  return derived;
}

/**
 * Get current cached derived permissions (no fetch). Returns null if not loaded.
 */
export function getDerivedPermissions(): UserPermissions | null {
  if (!memoryCache) return null;
  if (isStale(memoryCache.loadedAt)) {
    memoryCache = null;
    return null;
  }
  return memoryCache.derived;
}

/**
 * Check cached permission by module.action (e.g. 'sales.create'). Returns false if not loaded.
 */
export function has(module: string, action: string): boolean {
  const d = getDerivedPermissions();
  if (!d) return false;
  const m = (module || '').toLowerCase();
  const a = (action || 'view').toLowerCase();
  if (m === 'sales') {
    if (a === 'create') return d.canCreateSale;
    if (a === 'edit') return d.canEditSale;
    if (a === 'delete') return d.canDeleteSale;
    if (a === 'view' || a === 'view_own' || a === 'view_branch' || a === 'view_company') return d.canViewSale ?? d.canCreateSale ?? d.canEditSale ?? d.canDeleteSale ?? false;
  }
  if (m === 'purchases' || m === 'purchase') {
    if (a === 'view' || a === 'create') return d.canManagePurchases ?? false;
    if (a === 'edit') return d.canEditPurchase ?? d.canManagePurchases ?? false;
    if (a === 'delete') return d.canDeletePurchase ?? false;
  }
  if (m === 'pos') return (a === 'view' || a === 'use') && (d.canUsePos ?? false);
  if (m === 'studio') return (a === 'view' || a === 'create' || a === 'edit' || a === 'delete') && (d.canAccessStudio ?? false);
  if (m === 'rentals') return (a === 'view' || a === 'create' || a === 'edit' || a === 'delete') && (d.canManageRentals ?? false);
  if (m === 'reports') return a === 'view' && (d.canViewReports ?? false);
  if (m === 'settings') return d.canManageSettings ?? false;
  if (m === 'users') return d.canManageUsers ?? false;
  if (m === 'accounting' || m === 'ledger') return a === 'view' && (d.canAccessAccounting ?? false);
  if (m === 'payments') return d.canMakePayments ?? d.canReceivePayments ?? false;
  if (m === 'expenses') return d.canManageExpenses ?? false;
  if (m === 'products' || m === 'inventory') return (a === 'view' || a === 'adjust' || a === 'transfer') && (d.canManageProducts ?? false);
  if (m === 'contacts') {
    if (a === 'view' || a === 'edit') return d.canViewContacts ?? false;
    if (a === 'create') return d.canCreateContact ?? d.canViewContacts ?? false;
    if (a === 'delete') return d.canDeleteContact ?? false;
  }
  return false;
}

/**
 * Clear cache (call on logout). Also invalidate when admin updates role_permissions.
 */
export function clear(): void {
  memoryCache = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Invalidate cache for a role (call after setRolePermission so next load refetches).
 */
export function invalidateForRole(role: EngineRole): void {
  if (memoryCache && memoryCache.role === role) memoryCache = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(`_${role}`)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export const permissionEngine = {
  loadPermissions,
  getDerivedPermissions,
  has,
  clear,
  invalidateForRole,
};
