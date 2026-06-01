import { legacyToUuid } from './legacyId.js';

/**
 * Parent-Variant catalog: legacy products (parent/design) + variations (SKU level).
 * Modern: products.id ← products table, product_variations.id ← variations table.
 */
export function buildProductCatalog(products, variations) {
  const productById = new Map();
  for (const p of products) {
    productById.set(Number(p.id), p);
  }

  const variationById = new Map();
  for (const v of variations) {
    if (v.deleted_at) continue;
    variationById.set(Number(v.id), v);
  }

  return { productById, variationById };
}

function displayProductName(product, variation) {
  const base = String(product?.name || 'Unknown').trim();
  if (!variation) return base;
  const vName = String(variation.name || '').trim();
  if (!vName || vName.toUpperCase() === 'DUMMY') return base;
  return `${base} — ${vName}`;
}

function resolveSku(product, variation) {
  const sub = variation?.sub_sku != null ? String(variation.sub_sku).trim() : '';
  if (sub) return sub;
  return product?.sku != null ? String(product.sku).trim() : '';
}

/**
 * Map one sell/purchase line to modern item shape.
 * @param {Record<string, unknown>} line Legacy sell or purchase line
 * @param {'sell'|'purchase'} kind
 * @param {{ productById: Map<number, object>, variationById: Map<number, object> }} catalog
 */
export function mapLineItem(line, kind, catalog) {
  const legacyProductId = Number(line.product_id);
  const legacyVariationId = Number(line.variation_id);
  const product = catalog.productById.get(legacyProductId);
  const variation = catalog.variationById.get(legacyVariationId);

  const qty = Number(line.quantity) || 0;
  let unitPrice = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  if (kind === 'sell') {
    unitPrice = Number(line.unit_price ?? line.unit_price_inc_tax) || 0;
    discountAmount = Number(line.line_discount_amount) || 0;
    taxAmount = (Number(line.item_tax) || 0) * qty;
  } else {
    unitPrice = Number(line.purchase_price ?? line.purchase_price_inc_tax) || 0;
    discountAmount = 0;
    taxAmount = (Number(line.item_tax) || 0) * qty;
  }

  const total = Math.max(0, qty * unitPrice - discountAmount + taxAmount);

  return {
    id: legacyToUuid(kind === 'sell' ? 'transaction_sell_lines' : 'purchase_lines', line.id),
    productId: legacyProductId ? legacyToUuid('products', legacyProductId) : null,
    variationId: legacyVariationId ? legacyToUuid('product_variations', legacyVariationId) : null,
    productName: displayProductName(product, variation),
    sku: resolveSku(product, variation) || null,
    quantity: qty,
    unitPrice,
    discountAmount,
    taxAmount,
    total,
    legacyProductId,
    legacyVariationId,
    legacyLineId: Number(line.id),
    parentProductType: product?.type != null ? String(product.type) : null,
    variationLabel: variation?.name != null ? String(variation.name) : null,
  };
}
