/** Which fields appear in the bespoke customization modal (company-configurable). */
export interface BespokeFormConfig {
  show_measurements: boolean;
  show_fabric: boolean;
  show_color_code: boolean;
  show_image_upload: boolean;
  show_delivery_date: boolean;
  show_customization_charges: boolean;
}

/** Metadata-only fields stored on parent generic SKU line (no fabric/charges in JSON). */
export interface BespokeMetadata {
  image_url?: string;
  image_storage_path?: string;
  color_name?: string;
  shade_card_code?: string;
  measurements?: string | Record<string, string>;
  expected_delivery_date?: string;
  notes?: string;
}

/** Linked loose-fabric inventory row for fulfillment stock deduction. */
export interface BespokeFabricMaterial {
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku?: string;
  unit_code: string;
  quantity: number;
  /** Captured at pick time for cart line unit price. */
  retail_price?: number;
}

/** Per-line bespoke data stored in sales_items.customization_details (JSONB). */
export interface CustomizationDetails {
  image_url?: string;
  image_storage_path?: string;
  /** Legacy display string; derived from fabric_materials when present. */
  fabric?: string;
  fabric_materials?: BespokeFabricMaterial[];
  color_name?: string;
  shade_card_code?: string;
  measurements?: string | Record<string, string>;
  expected_delivery_date?: string;
  customization_charges?: number;
  notes?: string;
}

export interface BusinessSettingsRow {
  company_id: string;
  enable_bespoke_orders: boolean;
  bespoke_form_config: BespokeFormConfig;
  custom_generic_product_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export const BESPOKE_GENERIC_SKUS = [
  'CUSTOM-BRIDAL',
  'CUSTOM-PARTYWEAR',
  'CUSTOM-FORMAL',
  'CUSTOM-CASUAL',
] as const;

const LOOSE_FABRIC_UNIT_ALIASES = new Set([
  'm',
  'meter',
  'meters',
  'metre',
  'metres',
  'yd',
  'yard',
  'yards',
  'gaz',
  'gaj',
  'guz',
]);

const WEIGHT_VOLUME_UNIT_ALIASES = new Set([
  'kg',
  'kilogram',
  'kilograms',
  'g',
  'gram',
  'grams',
  'l',
  'liter',
  'litre',
  'liters',
  'litres',
]);

export interface FabricUnitLike {
  id: string;
  name?: string | null;
  short_code?: string | null;
  symbol?: string | null;
  allow_decimal?: boolean | null;
}

function normalizeUnitToken(code: string): string {
  return code.trim().toLowerCase();
}

function unitFieldTokens(u: FabricUnitLike): string[] {
  return [u.short_code, u.symbol, u.name]
    .filter((v): v is string => v != null && String(v).trim() !== '')
    .map((v) => normalizeUnitToken(String(v)));
}

export function isLooseFabricUnitCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return LOOSE_FABRIC_UNIT_ALIASES.has(normalizeUnitToken(code));
}

export function isWeightVolumeUnitCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return WEIGHT_VOLUME_UNIT_ALIASES.has(normalizeUnitToken(code));
}

/** Tier-1 meter/yard/gaz aliases on any unit field. */
export function isLooseFabricUnit(u: FabricUnitLike): boolean {
  return unitFieldTokens(u).some(isLooseFabricUnitCode);
}

/** Tier-2: decimal units except kg/liter (catches mis-assigned fabric SKUs). */
export function isDecimalFabricFallbackUnit(u: FabricUnitLike): boolean {
  if (!u.allow_decimal) return false;
  return !unitFieldTokens(u).some(isWeightVolumeUnitCode);
}

export function isFabricEligibleUnit(u: FabricUnitLike): boolean {
  return isLooseFabricUnit(u) || isDecimalFabricFallbackUnit(u);
}

export function getFabricEligibleUnits(units: FabricUnitLike[]): FabricUnitLike[] {
  return units.filter(isFabricEligibleUnit);
}

export function getLooseFabricUnitIds(units: FabricUnitLike[]): string[] {
  return units.filter(isLooseFabricUnit).map((u) => u.id);
}

export function getDecimalFabricFallbackUnitIds(units: FabricUnitLike[]): string[] {
  return units.filter(isDecimalFabricFallbackUnit).map((u) => u.id);
}

export function getBespokeLineCharges(details?: CustomizationDetails | null): number {
  const raw = details?.customization_charges;
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  return Math.max(0, Number(raw));
}

export function getBespokeUnitPrice(baseUnitPrice: number, details?: CustomizationDetails | null): number {
  return baseUnitPrice + getBespokeLineCharges(details);
}

export function formatFabricSummary(materials: BespokeFabricMaterial[]): string {
  return materials
    .filter((m) => m.product_id && m.quantity > 0)
    .map((m) => {
      const unit = m.unit_code || 'm';
      return `${m.product_name} (${m.quantity} ${unit})`;
    })
    .join('; ');
}

export function normalizeFabricMaterials(raw: unknown): BespokeFabricMaterial[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const productId = String(o.product_id ?? '').trim();
      const qty = Number(o.quantity);
      if (!productId || !Number.isFinite(qty) || qty <= 0) return null;
      return {
        product_id: productId,
        variation_id: o.variation_id ? String(o.variation_id) : undefined,
        product_name: String(o.product_name ?? ''),
        sku: o.sku ? String(o.sku) : undefined,
        unit_code: String(o.unit_code ?? 'm'),
        quantity: qty,
      } satisfies BespokeFabricMaterial;
    })
    .filter((r): r is BespokeFabricMaterial => r != null);
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
    fabric: materials.length ? formatFabricSummary(materials) : (o.fabric as string | undefined),
  };
}

/** True when metadata JSON has fields worth persisting on parent line. */
export function hasBespokeMetadataContent(details?: BespokeMetadata | CustomizationDetails | null): boolean {
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

/** @deprecated Legacy rows may still have fabric/charges in JSON. */
export function hasBespokeContent(details?: CustomizationDetails | null): boolean {
  if (!details) return false;
  if (getBespokeLineCharges(details) > 0) return true;
  if (details.fabric_materials?.length) return true;
  return hasBespokeMetadataContent(details);
}

/** Strip financial/inventory fields; persist metadata only on parent line. */
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

/**
 * Decode base retail from stored unit_price.
 * Supports historical rows where unit_price is base-only OR already includes customization_charges.
 */
export function deriveBaseUnitPriceFromStored(
  storedUnitPrice: number,
  details?: CustomizationDetails | null,
): number {
  const stored = Number(storedUnitPrice) || 0;
  const charges = getBespokeLineCharges(details);
  if (charges <= 0) return stored;
  const asBase = stored - charges;
  // Inclusive: stored = base + charges (asBase >= 0 and reconstructs stored)
  if (asBase >= 0 && Math.abs(asBase + charges - stored) < 0.01) {
    return asBase;
  }
  // Base-only: charges live only in JSON
  return stored;
}

export interface SaleLinePriceInput {
  price?: number;
  unitPrice?: number;
  baseUnitPrice?: number | null;
  customizationDetails?: CustomizationDetails | null;
}

/** Canonical unit price for DB + totals. Parent generic lines: base only; legacy rows may include charges in JSON. */
export function resolveSaleLineUnitPrice(input: SaleLinePriceInput): number {
  const details = input.customizationDetails ?? undefined;
  const charges = getBespokeLineCharges(details);
  if (input.baseUnitPrice != null && Number.isFinite(Number(input.baseUnitPrice))) {
    if (charges > 0) return getBespokeUnitPrice(Number(input.baseUnitPrice), details);
    return Number(input.baseUnitPrice);
  }
  const raw = Number(input.unitPrice ?? input.price ?? 0) || 0;
  if (charges > 0) {
    return getBespokeUnitPrice(deriveBaseUnitPriceFromStored(raw, details), details);
  }
  return raw;
}

/** Normalize customization_details for DB insert (metadata-only on parent). */
export function buildCustomizationDetailsForPersist(raw: unknown): CustomizationDetails | null {
  const meta = buildBespokeMetadataForPersist(raw);
  return meta as CustomizationDetails | null;
}

/** Instruction bullets for invoice / view (metadata only). */
export interface BespokeInstructionBullet {
  label: string;
  value: string;
}

export function getBespokeInstructionBullets(raw: unknown): BespokeInstructionBullet[] {
  const meta = buildBespokeMetadataForPersist(raw) ?? parseCustomizationDetails(raw);
  if (!meta) return [];
  const bullets: BespokeInstructionBullet[] = [];
  if (meta.measurements) {
    const m =
      typeof meta.measurements === 'string'
        ? meta.measurements.trim()
        : Object.entries(meta.measurements as Record<string, string>)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
    if (m) bullets.push({ label: 'Measurements', value: m });
  }
  if (meta.color_name) bullets.push({ label: 'Color', value: meta.color_name });
  if (meta.shade_card_code) bullets.push({ label: 'Shade card', value: meta.shade_card_code });
  if (meta.expected_delivery_date) {
    bullets.push({ label: 'Expected delivery', value: meta.expected_delivery_date });
  }
  if (meta.notes && String(meta.notes).trim()) {
    bullets.push({ label: 'Notes', value: String(meta.notes).trim() });
  }
  if (meta.image_url) bullets.push({ label: 'Reference image', value: meta.image_url });
  return bullets;
}

export { DEFAULT_BESPOKE_FORM_CONFIG, normalizeBespokeFormConfig } from '@/app/lib/bespokeDefaults';
