import { legacyToUuid, stripHtml } from './legacyId.js';

/** Split legacy single product names like "SHIRT-D 01 - 110" into design base + variant suffix. */
export function parseDesignBaseName(productName) {
  const raw = String(productName || '').trim();
  const idx = raw.lastIndexOf(' - ');
  if (idx > 0) {
    const base = raw.slice(0, idx).trim();
    const suffix = raw.slice(idx + 3).trim();
    if (base && suffix) return { base, suffix, consolidatable: true };
  }
  return { base: raw, suffix: null, consolidatable: false };
}

function normalizeKey(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function variationAttributes(productVariations, variation) {
  const pvId = variation?.product_variation_id != null ? Number(variation.product_variation_id) : null;
  const pv = pvId != null ? productVariations.get(pvId) : null;
  const attrs = {};
  const pvName = pv?.name != null ? String(pv.name).trim() : '';
  const vName = variation?.name != null ? String(variation.name).trim() : '';
  if (pvName && pvName.toUpperCase() !== 'DUMMY') attrs.Design = pvName;
  if (vName && vName.toUpperCase() !== 'DUMMY' && vName !== pvName) attrs.Variant = vName;
  return attrs;
}

function mapVariantRow(variation, product, productVariations, legacyProductId, suffixLabel) {
  const attrs = variationAttributes(productVariations, variation);
  if (suffixLabel && !attrs.Size && !attrs.Code) attrs.Code = suffixLabel;

  const sku =
    (variation?.sub_sku != null && String(variation.sub_sku).trim()) ||
    (product?.sku != null && String(product.sku).trim()) ||
    '';

  return {
    id: legacyToUuid('product_variations', variation.id),
    sku,
    attributes: attrs,
    price: Number(variation.default_sell_price ?? variation.sell_price_inc_tax) || 0,
    stock: 0,
    costPrice: Number(variation.default_purchase_price ?? variation.dpp_inc_tax) || 0,
    legacyProductId,
    legacyVariationId: Number(variation.id),
  };
}

function mapParentRow(parentId, name, sku, product, hasVariations, legacyProductIds) {
  const firstVar = product;
  return {
    id: parentId,
    sku: sku || (product?.sku != null ? String(product.sku) : ''),
    name,
    category: null,
    categoryId: null,
    brandId: product?.brand_id != null ? legacyToUuid('brands', Number(product.brand_id)) : null,
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    hasVariations,
    status: product?.is_inactive ? 'inactive' : 'active',
    description: product?.product_description ? stripHtml(product.product_description) : null,
    barcode: null,
    minStock: product?.alert_quantity != null ? Number(product.alert_quantity) : 0,
    legacyProductIds,
    legacyProductType: product?.type != null ? String(product.type) : null,
    variations: [],
  };
}

/**
 * Build Parent-Variant tree from legacy catalog.
 * @param {Record<string, unknown>[]} products
 * @param {Record<string, unknown>[]} variations
 * @param {Record<string, unknown>[]} productVariationsRows
 */
export function buildParentVariantTree(products, variations, productVariationsRows) {
  const productVariations = new Map(
    productVariationsRows.map((pv) => [Number(pv.id), pv]),
  );

  const variationsByProduct = new Map();
  for (const v of variations) {
    if (v.deleted_at) continue;
    const pid = Number(v.product_id);
    if (!variationsByProduct.has(pid)) variationsByProduct.set(pid, []);
    variationsByProduct.get(pid).push(v);
  }

  const stats = {
    parentProducts: 0,
    variants: 0,
    legacySingleProducts: 0,
    legacyVariableProducts: 0,
    consolidatedGroups: 0,
    standaloneSingles: 0,
  };

  const legacyProductToParent = {};
  const parents = [];
  const parentById = new Map();

  const singles = [];
  const variables = [];

  for (const p of products) {
    const t = String(p.type || 'single').toLowerCase();
    if (t === 'variable') variables.push(p);
    else singles.push(p);
  }

  stats.legacyVariableProducts = variables.length;
  stats.legacySingleProducts = singles.length;

  // Path A: variable products — one parent per legacy product
  for (const product of variables) {
    const legacyId = Number(product.id);
    const parentId = legacyToUuid('products', legacyId);
    const vars = variationsByProduct.get(legacyId) || [];
    const parent = mapParentRow(
      parentId,
      String(product.name || '').trim(),
      String(product.sku || '').trim(),
      product,
      vars.length > 1,
      [legacyId],
    );

    parent.variations = vars.map((v) => mapVariantRow(v, product, productVariations, legacyId, null));
    if (parent.variations.length === 0 && vars.length === 0) {
      // fallback: synthetic variant from product sku
      parent.variations = [{
        id: legacyToUuid('product_variations', legacyId),
        sku: String(product.sku || '').trim(),
        attributes: {},
        price: 0,
        stock: 0,
        costPrice: 0,
        legacyProductId: legacyId,
        legacyVariationId: legacyId,
      }];
    }

    parent.costPrice = Math.min(...parent.variations.map((v) => v.costPrice).filter((n) => n > 0), Infinity) || 0;
    parent.retailPrice = Math.max(...parent.variations.map((v) => v.price), 0);
    parent.wholesalePrice = parent.retailPrice;

    parents.push(parent);
    parentById.set(parentId, parent);
    legacyProductToParent[String(legacyId)] = parentId;
    stats.parentProducts++;
    stats.variants += parent.variations.length;
  }

  // Path B/C: single products — consolidate by design base name
  const singleGroups = new Map();
  for (const product of singles) {
    const parsed = parseDesignBaseName(product.name);
    const groupKey = parsed.consolidatable ? normalizeKey(parsed.base) : `__standalone__:${product.id}`;
    if (!singleGroups.has(groupKey)) singleGroups.set(groupKey, { parsed, products: [] });
    singleGroups.get(groupKey).products.push(product);
  }

  for (const [groupKey, group] of singleGroups) {
    const isConsolidated = group.parsed.consolidatable && group.products.length >= 1;
    const useSyntheticParent = group.parsed.consolidatable;

    if (useSyntheticParent && group.products.length > 1) stats.consolidatedGroups++;
    else if (!group.parsed.consolidatable) stats.standaloneSingles += group.products.length;

    const first = group.products[0];
    const parentId = useSyntheticParent
      ? legacyToUuid('product_parent', groupKey)
      : legacyToUuid('products', Number(first.id));

    const parentName = useSyntheticParent ? group.parsed.base : String(first.name || '').trim();
    const parentSku = useSyntheticParent
      ? String(first.sku || '').trim().replace(/\d+$/, '').trim() || String(first.sku || '')
      : String(first.sku || '').trim();

    const legacyIds = group.products.map((p) => Number(p.id));
    const parent = mapParentRow(parentId, parentName, parentSku, first, group.products.length > 1, legacyIds);

    for (const product of group.products) {
      const legacyId = Number(product.id);
      legacyProductToParent[String(legacyId)] = parentId;
      const parsed = parseDesignBaseName(product.name);
      const vars = variationsByProduct.get(legacyId) || [];
      if (vars.length) {
        for (const v of vars) {
          parent.variations.push(
            mapVariantRow(v, product, productVariations, legacyId, parsed.suffix),
          );
        }
      } else {
        parent.variations.push({
          id: legacyToUuid('product_variations', legacyId),
          sku: String(product.sku || '').trim(),
          attributes: parsed.suffix ? { Code: parsed.suffix } : {},
          price: 0,
          stock: 0,
          costPrice: 0,
          legacyProductId: legacyId,
          legacyVariationId: legacyId,
        });
      }
    }

    parent.costPrice =
      Math.min(...parent.variations.map((v) => v.costPrice).filter((n) => n > 0), Infinity) || 0;
    parent.retailPrice = Math.max(...parent.variations.map((v) => v.price), 0);
    parent.wholesalePrice = parent.retailPrice;
    parent.hasVariations = parent.variations.length > 1;

    parents.push(parent);
    parentById.set(parentId, parent);
    stats.parentProducts++;
    stats.variants += parent.variations.length;
  }

  parents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return { parents, stats, legacyProductToParent };
}
