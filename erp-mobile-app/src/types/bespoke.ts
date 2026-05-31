/**
 * Mobile-local bespoke types (subset of web src/app/types/bespoke.ts).
 * Keeps erp-mobile-app build independent of web @/app path aliases.
 */

export interface BespokeMetadata {
  image_url?: string;
  image_storage_path?: string;
  color_name?: string;
  shade_card_code?: string;
  measurements?: string | Record<string, string>;
  expected_delivery_date?: string;
  notes?: string;
}

export interface BespokeFabricMaterial {
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku?: string;
  unit_code: string;
  quantity: number;
  retail_price?: number;
}

export interface CustomizationDetails {
  image_url?: string;
  image_storage_path?: string;
  fabric?: string;
  fabric_materials?: BespokeFabricMaterial[];
  color_name?: string;
  shade_card_code?: string;
  measurements?: string | Record<string, string>;
  expected_delivery_date?: string;
  customization_charges?: number;
  notes?: string;
}

/** Used by bespokeCartInjection fabricMaterialToOption. */
export interface LooseFabricProductOption {
  product_id: string;
  variation_id?: string;
  name?: string;
  sku?: string;
  unit_code?: string;
  retail_price?: number;
}

export function normalizeFabricMaterials(raw: unknown): BespokeFabricMaterial[] {
  if (!Array.isArray(raw)) return [];
  const out: BespokeFabricMaterial[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const productId = String(o.product_id ?? '').trim();
    const qty = Number(o.quantity);
    if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
    out.push({
      product_id: productId,
      variation_id: o.variation_id ? String(o.variation_id) : undefined,
      product_name: String(o.product_name ?? ''),
      sku: o.sku ? String(o.sku) : undefined,
      unit_code: String(o.unit_code ?? 'm'),
      quantity: qty,
    });
  }
  return out;
}

export function parseCustomizationDetails(raw: unknown): CustomizationDetails | undefined {
  if (raw == null) return undefined;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const o = parsed as Record<string, unknown>;
  const materials = normalizeFabricMaterials(o.fabric_materials);
  return {
    ...(parsed as CustomizationDetails),
    fabric_materials: materials.length ? materials : undefined,
    fabric: materials.length
      ? materials.map((m) => `${m.product_name} (${m.quantity} ${m.unit_code || 'm'})`).join('; ')
      : (o.fabric as string | undefined),
  };
}

export function hasBespokeMetadataContent(
  details?: BespokeMetadata | CustomizationDetails | null,
): boolean {
  if (!details) return false;
  if (details.image_url || details.image_storage_path) return true;
  if (details.color_name || details.shade_card_code) return true;
  if (details.expected_delivery_date) return true;
  if (details.notes && String(details.notes).trim()) return true;
  if (details.measurements) {
    if (typeof details.measurements === 'string' && details.measurements.trim()) return true;
    if (typeof details.measurements === 'object' && Object.keys(details.measurements).length > 0) return true;
  }
  return false;
}

export function buildBespokeMetadataForPersist(raw: unknown): BespokeMetadata | null {
  const parsed = parseCustomizationDetails(raw);
  if (!parsed) return null;
  const meta: BespokeMetadata = {
    image_url: parsed.image_url,
    image_storage_path: parsed.image_storage_path,
    color_name: parsed.color_name,
    shade_card_code: parsed.shade_card_code,
    measurements: parsed.measurements,
    expected_delivery_date: parsed.expected_delivery_date,
    notes: parsed.notes,
  };
  return hasBespokeMetadataContent(meta) ? meta : null;
}
