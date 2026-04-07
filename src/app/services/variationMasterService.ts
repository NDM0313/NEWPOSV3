import { settingsService } from '@/app/services/settingsService';

const SETTING_KEY = 'variation_attributes_master';

export type VariationAttributesMaster = Record<string, string[]>;

const RESERVED_ROOT_KEYS = new Set([
  'updated_at',
  'attributes',
  'category',
  'description',
  'id',
  'company_id',
  'key',
]);

/** Coerce settings JSON value lists (array, single string, or legacy shapes) into string[]. */
function coerceStringList(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    const t = val.trim();
    return t ? [t] : [];
  }
  if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
    const o = val as Record<string, unknown>;
    if (Array.isArray(o.values)) {
      return coerceStringList(o.values);
    }
  }
  return [];
}

function mergeAttrLists(
  target: VariationAttributesMaster,
  name: string,
  list: string[]
): void {
  if (!name) return;
  const merged = new Set([...(target[name] || []), ...list]);
  target[name] = Array.from(merged).sort((a, b) => a.localeCompare(b));
}

/**
 * Accepts:
 * - { attributes: { COLOR: ["Red"], SIZE: ["M"], SUPPLIER: ["A"] } } (current save shape)
 * - Flat legacy: { COLOR: [...], SIZE: "S", updated_at: "..." } (merge with attributes)
 * Non-array attribute values (e.g. string) are coerced so keys are not dropped (fixes "only SUPPLIER" when
 * other attrs were saved as strings or odd JSON).
 */
function normalize(raw: unknown): VariationAttributesMaster {
  if (raw == null || raw === '') return {};
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) obj = p as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return {};

  const out: VariationAttributesMaster = {};

  const nested = obj.attributes;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [k, val] of Object.entries(nested as Record<string, unknown>)) {
      const name = String(k).trim();
      if (!name) continue;
      const list = coerceStringList(val);
      mergeAttrLists(out, name, list);
    }
  }

  for (const [k, val] of Object.entries(obj)) {
    if (RESERVED_ROOT_KEYS.has(k)) continue;
    const name = String(k).trim();
    if (!name) continue;
    const list = coerceStringList(val);
    if (list.length === 0 && !Array.isArray(val) && typeof val !== 'string') continue;
    mergeAttrLists(out, name, list);
  }

  return out;
}

export const variationMasterService = {
  async get(companyId: string): Promise<VariationAttributesMaster> {
    const row = await settingsService.getSetting(companyId, SETTING_KEY);
    return normalize(row?.value);
  },

  async save(companyId: string, attributes: VariationAttributesMaster): Promise<void> {
    await settingsService.setSetting(
      companyId,
      SETTING_KEY,
      { attributes, updated_at: new Date().toISOString() },
      'inventory',
      'Reusable product variation attributes and values'
    );
  },
};
