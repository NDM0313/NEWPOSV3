import { supabase } from '@/lib/supabase';
import { settingsService } from '@/app/services/settingsService';
import {
  DEFAULT_WORKER_ROLES,
  isBuiltinWorkerRole,
  mergeWorkerRoles,
  slugifyWorkerRole,
  type WorkerRoleCategory,
  type WorkerRoleOption,
} from '@/app/lib/workerRoles';

const CATALOG_KEY = 'worker_role_catalog';
const CATALOG_CATEGORY = 'contacts';

export interface WorkerRoleCatalogPayload {
  roles: WorkerRoleOption[];
}

function parseCatalogValue(raw: unknown): WorkerRoleOption[] {
  if (!raw || typeof raw !== 'object') return [];
  const roles = (raw as WorkerRoleCatalogPayload).roles;
  if (!Array.isArray(roles)) return [];
  return roles
    .filter((r) => r && typeof r.value === 'string' && r.value.trim())
    .map((r) => ({
      value: r.value.trim(),
      label: String(r.label || r.value).trim(),
      category: (r.category as WorkerRoleCategory) || 'Handwork',
      isCustom: true,
    }));
}

async function persistCatalog(companyId: string, roles: WorkerRoleOption[]): Promise<void> {
  const customOnly = roles.filter((r) => r.isCustom !== false && !isBuiltinWorkerRole(r.value));
  await settingsService.setSetting(
    companyId,
    CATALOG_KEY,
    { roles: customOnly } satisfies WorkerRoleCatalogPayload,
    CATALOG_CATEGORY,
    'Custom worker role definitions for contact drawer and Studio filtering',
  );
}

export const workerRoleCatalogService = {
  async loadCatalog(companyId: string): Promise<WorkerRoleOption[]> {
    if (!companyId) return [];
    try {
      const row = await settingsService.getSetting(companyId, CATALOG_KEY);
      return parseCatalogValue(row?.value);
    } catch {
      return [];
    }
  },

  async loadDistinctRolesFromContacts(companyId: string): Promise<string[]> {
    if (!companyId) return [];
    const { data, error } = await supabase
      .from('contacts')
      .select('worker_role')
      .eq('company_id', companyId)
      .eq('type', 'worker')
      .not('worker_role', 'is', null);
    if (error) return [];
    const set = new Set<string>();
    for (const row of data ?? []) {
      const v = (row.worker_role as string | null)?.trim();
      if (v) set.add(v);
    }
    return Array.from(set);
  },

  async loadMergedRoles(companyId: string): Promise<WorkerRoleOption[]> {
    const [catalog, dbDistinct] = await Promise.all([
      this.loadCatalog(companyId),
      this.loadDistinctRolesFromContacts(companyId),
    ]);
    return mergeWorkerRoles(catalog, dbDistinct);
  },

  async saveCustomRole(
    companyId: string,
    input: { label: string; category: WorkerRoleCategory },
  ): Promise<WorkerRoleOption> {
    const label = input.label.trim();
    if (!label) throw new Error('Role name is required');
    const value = slugifyWorkerRole(label);
    if (!value) throw new Error('Invalid role name');
    if (isBuiltinWorkerRole(value)) {
      const builtin = DEFAULT_WORKER_ROLES.find((r) => r.value === value);
      if (builtin) return builtin;
    }

    const catalog = await this.loadCatalog(companyId);
    const existing = catalog.find((r) => r.value === value);
    if (existing) return existing;

    const newRole: WorkerRoleOption = {
      value,
      label,
      category: input.category,
      isCustom: true,
    };
    await persistCatalog(companyId, [...catalog, newRole]);
    return newRole;
  },

  async updateCustomRole(
    companyId: string,
    value: string,
    patch: { label?: string; category?: WorkerRoleCategory },
  ): Promise<void> {
    if (isBuiltinWorkerRole(value)) {
      throw new Error('Built-in roles cannot be edited');
    }
    const catalog = await this.loadCatalog(companyId);
    const idx = catalog.findIndex((r) => r.value === value);
    if (idx < 0) throw new Error('Role not found in catalog');
    const updated = { ...catalog[idx] };
    if (patch.label !== undefined) {
      const label = patch.label.trim();
      if (!label) throw new Error('Role name is required');
      updated.label = label;
    }
    if (patch.category !== undefined) updated.category = patch.category;
    const next = [...catalog];
    next[idx] = updated;
    await persistCatalog(companyId, next);
  },

  async deleteCustomRole(companyId: string, value: string): Promise<void> {
    if (isBuiltinWorkerRole(value)) {
      throw new Error('Built-in roles cannot be deleted');
    }
    const catalog = await this.loadCatalog(companyId);
    await persistCatalog(companyId, catalog.filter((r) => r.value !== value));
  },
};
