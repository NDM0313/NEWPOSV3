import { parseCsvToStructured } from "/src/app/modules/csv-workbench/parseCsv.ts";
import { serializeCsvMatrix } from "/src/app/modules/csv-workbench/serializeCsv.ts";
import { DEFAULT_IMPORT_CHUNK_SIZE, runChunkedAllSettled } from "/src/app/modules/csv-workbench/chunkedCommit.ts";
import { productService } from "/src/app/services/productService.ts?t=1779915133644";
import { productCategoryService } from "/src/app/services/productCategoryService.ts";
import { unitService } from "/src/app/services/unitService.ts";
import { brandService } from "/src/app/services/brandService.ts";
export const PRODUCT_CANONICAL_HEADERS = [
  "name",
  "sku",
  "category",
  "subcategory",
  "unit",
  "brand",
  "cost_price",
  "selling_price",
  "wholesale_price",
  "opening_stock",
  "min_stock",
  "max_stock",
  "track_stock",
  "is_sellable",
  "barcode",
  "description",
  "image_url",
  "variation_name",
  "variation_sku",
  "variation_barcode"
];
export const PRODUCT_PREVIEW_COLUMNS = PRODUCT_CANONICAL_HEADERS.map((key) => ({
  key,
  label: key
}));
export const PRODUCT_CSV_HEADER_ALIASES = {
  name: "name",
  "product name": "name",
  sku: "sku",
  category: "category",
  unit: "unit",
  brand: "brand",
  "cost price": "cost_price",
  "purchase price": "cost_price",
  purchase_price: "cost_price",
  cost_price: "cost_price",
  "selling price": "selling_price",
  "retail price": "selling_price",
  retail_price: "selling_price",
  selling_price: "selling_price",
  "wholesale price": "wholesale_price",
  wholesale_price: "wholesale_price",
  "opening stock": "opening_stock",
  opening_stock: "opening_stock",
  "initial stock": "opening_stock",
  quantity: "opening_stock",
  qty: "opening_stock",
  "min stock": "min_stock",
  min_stock: "min_stock",
  "max stock": "max_stock",
  max_stock: "max_stock",
  "track stock": "track_stock",
  track_stock: "track_stock",
  "is rentable": "is_rentable",
  is_rentable: "is_rentable",
  "is sellable": "is_sellable",
  is_sellable: "is_sellable",
  barcode: "barcode",
  description: "description",
  "variation name": "variation_name",
  variation_name: "variation_name",
  variation: "variation_name",
  variant: "variation_name",
  "variation sku": "variation_sku",
  variation_sku: "variation_sku",
  "variation barcode": "variation_barcode",
  variation_barcode: "variation_barcode",
  subcategory: "subcategory",
  "sub category": "subcategory",
  sub_category: "subcategory",
  "image url": "image_url",
  image_url: "image_url"
};
function parseBool(v) {
  const t = (v ?? "").trim().toLowerCase();
  return t === "yes" || t === "1" || t === "true" || t === "y";
}
export function buildProductsBlankTemplate() {
  const emptyRow = PRODUCT_CANONICAL_HEADERS.map(() => "");
  return serializeCsvMatrix([[...PRODUCT_CANONICAL_HEADERS], emptyRow]);
}
export function buildProductsSampleTemplate() {
  return serializeCsvMatrix([
    [...PRODUCT_CANONICAL_HEADERS],
    [
      "Design 1000",
      "DSN-1000",
      "Bridal",
      "",
      "Piece",
      "",
      "5000",
      "12000",
      "10000",
      "0",
      "2",
      "50",
      "yes",
      "yes",
      "",
      "Shamooz design parent",
      "",
      "",
      "",
      ""
    ],
    [
      "Design 1000",
      "",
      "Bridal",
      "",
      "Piece",
      "",
      "4500",
      "15000",
      "12000",
      "3",
      "",
      "",
      "yes",
      "yes",
      "",
      "",
      "",
      "Master Copy",
      "DSN-1000-MC",
      ""
    ],
    [
      "Design 1000",
      "",
      "Bridal",
      "",
      "Piece",
      "",
      "3000",
      "9000",
      "7500",
      "5",
      "",
      "",
      "yes",
      "yes",
      "",
      "",
      "",
      "Replica",
      "DSN-1000-REP",
      ""
    ],
    [
      "Design 1000",
      "",
      "Bridal",
      "",
      "Piece",
      "",
      "2500",
      "8000",
      "6500",
      "2",
      "",
      "",
      "yes",
      "yes",
      "",
      "",
      "",
      "Chiffon",
      "DSN-1000-CHF",
      ""
    ]
  ]);
}
function buildHeaderIndexMap(headers) {
  const colMap = {};
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase();
    const key = PRODUCT_CSV_HEADER_ALIASES[h] ?? h.replace(/\s+/g, "_");
    colMap[key] = i;
  });
  return colMap;
}
export function rowsFromParsedCsv(parsed) {
  const header = parsed.headers.map((h) => h.trim().toLowerCase());
  const colMap = buildHeaderIndexMap(parsed.headers);
  const nameIdx = colMap.name ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === "name");
  const skuIdx = colMap.sku ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === "sku");
  if (nameIdx < 0) return [];
  const rows = [];
  for (const cells of parsed.rows) {
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) continue;
    const skuRaw = (cells[skuIdx] ?? "").trim();
    const costPrice = parseFloat(cells[colMap.cost_price ?? -1] ?? "0") || 0;
    const sellingPrice = parseFloat(cells[colMap.selling_price ?? -1] ?? "0") || 0;
    const wholesalePrice = parseFloat(cells[colMap.wholesale_price ?? -1] ?? "") || void 0;
    const openingStock = parseFloat(cells[colMap.opening_stock ?? -1] ?? "0") || 0;
    const minStock = parseInt(cells[colMap.min_stock ?? -1] ?? "", 10);
    const maxStock = parseInt(cells[colMap.max_stock ?? -1] ?? "", 10);
    const variationName = (cells[colMap.variation_name ?? -1] ?? "").trim() || void 0;
    const variationSku = (cells[colMap.variation_sku ?? -1] ?? "").trim() || void 0;
    const variationBarcode = (cells[colMap.variation_barcode ?? -1] ?? "").trim() || void 0;
    const trackStockRaw = (cells[colMap.track_stock ?? -1] ?? "").trim().toLowerCase();
    const isSellableRaw = (cells[colMap.is_sellable ?? -1] ?? "").trim().toLowerCase();
    const subcategory = (cells[colMap.subcategory ?? -1] ?? "").trim() || void 0;
    const imageUrl = (cells[colMap.image_url ?? -1] ?? "").trim() || void 0;
    rows.push({
      name,
      sku: skuRaw || "",
      category: (cells[colMap.category ?? -1] ?? "").trim() || void 0,
      subcategory,
      unit: (cells[colMap.unit ?? -1] ?? "").trim() || void 0,
      brand: (cells[colMap.brand ?? -1] ?? "").trim() || void 0,
      cost_price: costPrice,
      selling_price: sellingPrice,
      wholesale_price: wholesalePrice,
      opening_stock: openingStock,
      min_stock: Number.isNaN(minStock) ? void 0 : minStock,
      max_stock: Number.isNaN(maxStock) ? void 0 : maxStock,
      track_stock: trackStockRaw ? parseBool(trackStockRaw) : void 0,
      is_sellable: isSellableRaw ? parseBool(isSellableRaw) : void 0,
      barcode: (cells[colMap.barcode ?? -1] ?? "").trim() || void 0,
      description: (cells[colMap.description ?? -1] ?? "").trim() || void 0,
      variation_name: variationName,
      variation_sku: variationSku,
      variation_barcode: variationBarcode,
      image_url: imageUrl
    });
  }
  return rows;
}
const VARIANT_LIKE = /^(Size|Color|Variant|Style):\s*.+|^(SMALL|MEDIUM|LARGE|S|M|L|XL|XXL)$/i;
export function normalizeProductVariationHeuristics(groups) {
  for (const rows of groups.values()) {
    for (const row of rows) {
      if (row.variation_name) continue;
      if (row.description && VARIANT_LIKE.test(row.description.trim())) {
        row.variation_name = row.description.trim();
        row.description = void 0;
      }
      if (row.image_url && !/^https?:\/\//i.test(row.image_url) && row.image_url.length <= 20 && !row.variation_sku) {
        row.variation_sku = row.image_url.trim();
        row.image_url = void 0;
      }
    }
  }
}
export function isMatrixVariantRow(row) {
  return !!row.variation_name?.trim();
}
export function groupNameKeyForProduct(row) {
  return row.name.trim().toLowerCase();
}
export function groupProductRowsByName(rows) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = groupNameKeyForProduct(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}
export function resolveParentRow(rows) {
  const parentRows = rows.filter((r) => !isMatrixVariantRow(r));
  const hasVariants = rows.some((r) => isMatrixVariantRow(r));
  if (!hasVariants) {
    if (parentRows.length === 0) return { error: "No product rows in group" };
    if (parentRows.length > 1) return { error: "Simple product group must have one row" };
    return { parent: parentRows[0] };
  }
  if (parentRows.length === 0) {
    return { error: "Matrix group requires one parent row (empty variation_name)" };
  }
  if (parentRows.length > 1) {
    return { error: "Matrix group must have exactly one parent row (empty variation_name)" };
  }
  return { parent: parentRows[0] };
}
export function resolveVariantRows(rows) {
  return rows.filter((r) => isMatrixVariantRow(r));
}
export function groupKeyForProduct(row, autoSkuLabel) {
  const skuPart = row.sku || (autoSkuLabel ? "(auto)" : "");
  return `${row.name}|${skuPart || "(auto)"}`;
}
export function groupProductRows(rows, autoSkuLabel) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = groupKeyForProduct(row, autoSkuLabel);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}
export function rowsFromParsedCsvWithIndices(parsed) {
  const header = parsed.headers.map((h) => h.trim().toLowerCase());
  const colMap = buildHeaderIndexMap(parsed.headers);
  const nameIdx = colMap.name ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === "name");
  const skuIdx = colMap.sku ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === "sku");
  if (nameIdx < 0) return [];
  const out = [];
  for (let ri = 0; ri < parsed.rows.length; ri++) {
    const cells = parsed.rows[ri];
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) continue;
    const skuRaw = (cells[skuIdx] ?? "").trim();
    const costPrice = parseFloat(cells[colMap.cost_price ?? -1] ?? "0") || 0;
    const sellingPrice = parseFloat(cells[colMap.selling_price ?? -1] ?? "0") || 0;
    const wholesalePrice = parseFloat(cells[colMap.wholesale_price ?? -1] ?? "") || void 0;
    const openingStock = parseFloat(cells[colMap.opening_stock ?? -1] ?? "0") || 0;
    const minStock = parseInt(cells[colMap.min_stock ?? -1] ?? "", 10);
    const maxStock = parseInt(cells[colMap.max_stock ?? -1] ?? "", 10);
    const variationName = (cells[colMap.variation_name ?? -1] ?? "").trim() || void 0;
    const variationSku = (cells[colMap.variation_sku ?? -1] ?? "").trim() || void 0;
    const variationBarcode = (cells[colMap.variation_barcode ?? -1] ?? "").trim() || void 0;
    const trackStockRaw = (cells[colMap.track_stock ?? -1] ?? "").trim().toLowerCase();
    const isSellableRaw = (cells[colMap.is_sellable ?? -1] ?? "").trim().toLowerCase();
    const subcategory = (cells[colMap.subcategory ?? -1] ?? "").trim() || void 0;
    const imageUrl = (cells[colMap.image_url ?? -1] ?? "").trim() || void 0;
    out.push({
      _sourceRowIndex: ri + 2,
      name,
      sku: skuRaw || "",
      category: (cells[colMap.category ?? -1] ?? "").trim() || void 0,
      subcategory,
      unit: (cells[colMap.unit ?? -1] ?? "").trim() || void 0,
      brand: (cells[colMap.brand ?? -1] ?? "").trim() || void 0,
      cost_price: costPrice,
      selling_price: sellingPrice,
      wholesale_price: wholesalePrice,
      opening_stock: openingStock,
      min_stock: Number.isNaN(minStock) ? void 0 : minStock,
      max_stock: Number.isNaN(maxStock) ? void 0 : maxStock,
      track_stock: trackStockRaw ? parseBool(trackStockRaw) : void 0,
      is_sellable: isSellableRaw ? parseBool(isSellableRaw) : void 0,
      barcode: (cells[colMap.barcode ?? -1] ?? "").trim() || void 0,
      description: (cells[colMap.description ?? -1] ?? "").trim() || void 0,
      variation_name: variationName,
      variation_sku: variationSku,
      variation_barcode: variationBarcode,
      image_url: imageUrl
    });
  }
  return out;
}
function stripIndex(row) {
  const { _sourceRowIndex: _idx, ...rest } = row;
  void _idx;
  return rest;
}
export function validateProductsStructuralIndexed(rows, autoGenerateSku) {
  const issues = [];
  const plainRows = rows.map(stripIndex);
  const groups = groupProductRowsByName(plainRows);
  const indexByRow = /* @__PURE__ */ new Map();
  rows.forEach((r) => indexByRow.set(stripIndex(r), r._sourceRowIndex));
  for (const [, groupRows] of groups) {
    const hasVariants = groupRows.some((r) => isMatrixVariantRow(r));
    const parentResult = resolveParentRow(groupRows);
    const parent = parentResult.parent;
    const parentRowIndex = parent ? indexByRow.get(parent) ?? groupRows[0]?.name.length : 0;
    if (parentResult.error) {
      const firstIndexed = rows.find((r) => groupNameKeyForProduct(r) === groupNameKeyForProduct(groupRows[0]));
      issues.push({
        rowIndex: firstIndexed?._sourceRowIndex ?? 1,
        severity: "error",
        message: parentResult.error
      });
      continue;
    }
    if (parent) {
      if (!Number.isFinite(parent.selling_price)) {
        issues.push({
          rowIndex: indexByRow.get(parent) ?? parentRowIndex,
          severity: "error",
          field: "selling_price",
          message: "Selling price must be a valid number on parent row"
        });
      }
      if (!autoGenerateSku && !parent.sku?.trim()) {
        issues.push({
          rowIndex: indexByRow.get(parent) ?? parentRowIndex,
          severity: "error",
          field: "sku",
          message: "Parent row SKU required unless auto-generate is enabled"
        });
      }
    }
    if (hasVariants && parent) {
      const parentIdx = indexByRow.get(parent) ?? 0;
      const variantRows = resolveVariantRows(groupRows);
      const seenVarSkus = /* @__PURE__ */ new Set();
      for (const vRow of variantRows) {
        const vIdx = indexByRow.get(vRow) ?? parentIdx;
        if (!vRow.variation_name?.trim()) {
          issues.push({
            rowIndex: vIdx,
            severity: "error",
            field: "variation_name",
            message: "Variant row requires variation_name"
          });
        }
        if (!vRow.variation_sku?.trim()) {
          issues.push({
            rowIndex: vIdx,
            severity: "error",
            field: "variation_sku",
            message: "Variant row requires variation_sku"
          });
        } else {
          const skuKey = vRow.variation_sku.trim().toLowerCase();
          if (seenVarSkus.has(skuKey)) {
            issues.push({
              rowIndex: vIdx,
              severity: "error",
              field: "variation_sku",
              message: `Duplicate variation_sku "${vRow.variation_sku}" in group`
            });
          }
          seenVarSkus.add(skuKey);
        }
        if (!Number.isFinite(vRow.selling_price)) {
          issues.push({
            rowIndex: vIdx,
            severity: "error",
            field: "selling_price",
            message: "Variant selling price must be a valid number"
          });
        }
      }
      const firstVariantIdx = variantRows.length ? indexByRow.get(variantRows[0]) ?? parentIdx : null;
      if (firstVariantIdx != null && parentIdx > 0 && firstVariantIdx < parentIdx) {
        issues.push({
          rowIndex: firstVariantIdx,
          severity: "warning",
          message: "Variant row appears before parent row; import will still use empty variation_name as parent"
        });
      }
    } else {
      for (const r of groupRows) {
        if (!Number.isFinite(r.selling_price)) {
          issues.push({
            rowIndex: indexByRow.get(r) ?? 1,
            severity: "error",
            field: "selling_price",
            message: "Selling price must be a valid number"
          });
        }
        if (!autoGenerateSku && !r.sku?.trim()) {
          issues.push({
            rowIndex: indexByRow.get(r) ?? 1,
            severity: "error",
            field: "sku",
            message: "SKU required unless auto-generate is enabled"
          });
        }
      }
    }
  }
  return issues;
}
export async function loadProductCatalogContext(companyId) {
  const [categoriesFlat, units, brands] = await Promise.all([
    productCategoryService.getAllCategoriesFlat(companyId, { includeInactive: true }),
    unitService.getAll(companyId, { includeInactive: true }),
    brandService.getAll(companyId, { includeInactive: true })
  ]);
  const topLevelCategories = categoriesFlat.filter((c) => !c.parent_id);
  const categoryByName = new Map(
    topLevelCategories.map((c) => [c.name.toLowerCase(), c.id])
  );
  const subcategoryByCategoryAndName = /* @__PURE__ */ new Map();
  categoriesFlat.forEach((c) => {
    if (c.parent_id) {
      subcategoryByCategoryAndName.set(`${c.parent_id}|${c.name.toLowerCase()}`, c.id);
    }
  });
  const unitPairs = [
    ...units.map((u) => [u.name.toLowerCase(), u.id]),
    ...units.map((u) => [(u.short_code || "").toLowerCase(), u.id]).filter(([k]) => k.length > 0)
  ];
  const unitByName = new Map(unitPairs);
  const brandByName = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));
  return { categoryByName, subcategoryByCategoryAndName, unitByName, units, brandByName };
}
export async function resolveProductCatalogIds(companyId, catalog, first, autoCreateMissing) {
  const { categoryByName, subcategoryByCategoryAndName, unitByName, units, brandByName } = catalog;
  if (first.subcategory && !first.category) {
    return { categoryId: null, unitId: null, brandId: null, error: "Subcategory requires category" };
  }
  let categoryId = null;
  if (first.category) {
    const catKey = first.category.toLowerCase();
    let catId = categoryByName.get(catKey) ?? null;
    if (!catId && autoCreateMissing) {
      try {
        const created = await productCategoryService.create({
          company_id: companyId,
          name: first.category.trim()
        });
        catId = created.id;
        categoryByName.set(catKey, catId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create category";
        return { categoryId: null, unitId: null, brandId: null, error: msg };
      }
    }
    if (!catId) {
      return {
        categoryId: null,
        unitId: null,
        brandId: null,
        error: `Category "${first.category}" not found`
      };
    }
    if (first.subcategory) {
      const subKey = `${catId}|${first.subcategory.trim().toLowerCase()}`;
      let subId = subcategoryByCategoryAndName.get(subKey) ?? null;
      if (!subId && autoCreateMissing) {
        try {
          const created = await productCategoryService.create({
            company_id: companyId,
            name: first.subcategory.trim(),
            parent_id: catId
          });
          subId = created.id;
          subcategoryByCategoryAndName.set(subKey, subId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to create subcategory";
          return { categoryId: null, unitId: null, brandId: null, error: msg };
        }
      }
      if (!subId) {
        return {
          categoryId: null,
          unitId: null,
          brandId: null,
          error: `Subcategory "${first.subcategory}" not found or does not belong to category "${first.category}"`
        };
      }
      categoryId = subId;
    } else {
      categoryId = catId;
    }
  }
  let unitId = null;
  if (first.unit) {
    const uKey = first.unit.trim().toLowerCase();
    unitId = unitByName.get(uKey) ?? units.find((u) => (u.short_code || "").toLowerCase() === uKey)?.id ?? null;
    if (!unitId && autoCreateMissing) {
      try {
        const created = await unitService.create({
          company_id: companyId,
          name: first.unit.trim(),
          short_code: first.unit.trim().slice(0, 10)
        });
        unitId = created.id;
        unitByName.set(uKey, unitId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create unit";
        return { categoryId, unitId: null, brandId: null, error: msg };
      }
    }
    if (!unitId) {
      return { categoryId, unitId: null, brandId: null, error: `Unit "${first.unit}" not found` };
    }
  }
  let brandId = null;
  if (first.brand) {
    const bKey = first.brand.toLowerCase();
    if (!brandByName.has(bKey)) {
      if (autoCreateMissing) {
        try {
          const created = await brandService.create({ company_id: companyId, name: first.brand.trim() });
          brandByName.set(bKey, created.id);
          brandId = created.id;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to create brand";
          return { categoryId, unitId, brandId: null, error: msg };
        }
      } else {
        return { categoryId, unitId, brandId: null, error: `Brand "${first.brand}" not found` };
      }
    } else {
      brandId = brandByName.get(bKey) ?? null;
    }
  }
  return { categoryId, unitId, brandId };
}
export function checkProductCatalogRefsDry(catalog, first) {
  if (first.subcategory && !first.category) return "Subcategory requires category";
  if (first.category) {
    const catId = catalog.categoryByName.get(first.category.toLowerCase());
    if (!catId) return `Category "${first.category}" not found`;
    if (first.subcategory) {
      const subId = catalog.subcategoryByCategoryAndName.get(
        `${catId}|${first.subcategory.trim().toLowerCase()}`
      );
      if (!subId) {
        return `Subcategory "${first.subcategory}" not found or does not belong to category "${first.category}"`;
      }
    }
  }
  if (first.unit) {
    const uKey = first.unit.trim().toLowerCase();
    const unitId = catalog.unitByName.get(uKey) ?? catalog.units.find((u) => (u.short_code || "").toLowerCase() === uKey)?.id;
    if (!unitId) return `Unit "${first.unit}" not found`;
  }
  if (first.brand && !catalog.brandByName.has(first.brand.toLowerCase())) {
    return `Brand "${first.brand}" not found`;
  }
  return void 0;
}
export async function validateProductsCatalogForPreview(companyId, rows, autoCreateCatalog) {
  const catalog = await loadProductCatalogContext(companyId);
  const issues = [];
  const seenGroups = /* @__PURE__ */ new Set();
  for (const row of rows) {
    const gk = groupNameKeyForProduct(row);
    if (seenGroups.has(gk)) continue;
    seenGroups.add(gk);
    const groupRows = rows.filter((r) => groupNameKeyForProduct(r) === gk);
    const parentResult = resolveParentRow(groupRows.map(stripIndex));
    const catalogRow = parentResult.parent ?? row;
    const dryError = checkProductCatalogRefsDry(catalog, catalogRow);
    if (dryError) {
      if (autoCreateCatalog) {
        const hints = [];
        if (row.category && dryError.includes("Category")) hints.push(`will create category "${catalogRow.category}"`);
        if (row.unit && dryError.includes("Unit")) hints.push(`will create unit "${catalogRow.unit}"`);
        if (row.brand && dryError.includes("Brand")) hints.push(`will create brand "${catalogRow.brand}"`);
        if (catalogRow.subcategory && dryError.includes("Subcategory")) {
          hints.push(`will create subcategory "${catalogRow.subcategory}"`);
        }
        if (hints.length) {
          issues.push({ rowIndex: row._sourceRowIndex, severity: "warning", message: hints.join("; ") });
        } else {
          issues.push({ rowIndex: row._sourceRowIndex, severity: "error", message: dryError });
        }
      } else {
        issues.push({ rowIndex: row._sourceRowIndex, severity: "error", message: dryError });
      }
    }
  }
  return issues;
}
export function rowErrorsMapForPreview(rows, validations) {
  const bySourceRow = /* @__PURE__ */ new Map();
  for (const v of validations) {
    const list = bySourceRow.get(v.rowIndex) ?? [];
    list.push(v);
    bySourceRow.set(v.rowIndex, list);
  }
  const map = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const list = bySourceRow.get(r._sourceRowIndex);
    if (list?.length) map.set(i, list);
  });
  return map;
}
export function productRowToPreviewRecord(row) {
  return {
    name: row.name,
    sku: row.sku || "(auto)",
    category: row.category ?? "",
    variation_name: row.variation_name ?? "",
    cost_price: row.cost_price,
    selling_price: row.selling_price,
    opening_stock: row.opening_stock
  };
}
function representativeRowIndex(rowsWithIndex, parent) {
  const indices = rowsWithIndex.filter((r) => groupNameKeyForProduct(r) === groupNameKeyForProduct(parent)).map((r) => r._sourceRowIndex);
  return indices.length ? Math.min(...indices) : 1;
}
async function importOneProductGroup(key, rows, rowsWithIndex, deps) {
  const {
    companyId,
    branchIdOrNull,
    catalog,
    autoGenerateSku,
    autoCreateCatalog,
    generateDocumentNumberSafe,
    incrementNextNumber
  } = deps;
  const parentResult = resolveParentRow(rows);
  if (parentResult.error || !parentResult.parent) {
    const rowIndex2 = rowsWithIndex.find((r) => groupNameKeyForProduct(r) === key)?._sourceRowIndex ?? 1;
    return {
      status: "skipped",
      error: {
        groupKey: key,
        productName: rows[0]?.name ?? "",
        rowIndex: rowIndex2,
        message: parentResult.error ?? "Could not resolve parent row",
        type: "validation"
      }
    };
  }
  const parentRow = parentResult.parent;
  const variantRows = resolveVariantRows(rows);
  const hasVariations = variantRows.length > 0;
  const rowIndex = representativeRowIndex(rowsWithIndex, parentRow);
  const resolved = await resolveProductCatalogIds(companyId, catalog, parentRow, autoCreateCatalog);
  if (resolved.error) {
    return {
      status: "skipped",
      error: {
        groupKey: key,
        productName: parentRow.name,
        rowIndex,
        message: resolved.error,
        type: "validation"
      }
    };
  }
  const { categoryId, unitId, brandId } = resolved;
  let skuToUse = parentRow.sku?.trim() || "";
  if (!skuToUse && !autoGenerateSku) {
    return {
      status: "skipped",
      error: {
        groupKey: key,
        productName: parentRow.name,
        rowIndex,
        message: "Parent row SKU required unless auto-generate is enabled",
        type: "validation"
      }
    };
  }
  if (!skuToUse) {
    try {
      skuToUse = await generateDocumentNumberSafe("production");
    } catch {
      return {
        status: "failed",
        error: {
          groupKey: key,
          productName: parentRow.name,
          rowIndex,
          message: "Failed to generate SKU",
          type: "failed"
        }
      };
    }
  }
  try {
    const productData = {
      company_id: companyId,
      category_id: categoryId,
      brand_id: brandId,
      unit_id: unitId,
      name: parentRow.name,
      sku: skuToUse,
      barcode: parentRow.barcode || null,
      description: parentRow.description || null,
      cost_price: parentRow.cost_price,
      retail_price: parentRow.selling_price,
      wholesale_price: parentRow.wholesale_price ?? parentRow.selling_price,
      min_stock: parentRow.min_stock ?? 0,
      max_stock: parentRow.max_stock ?? 1e3,
      has_variations: hasVariations,
      is_rentable: false,
      is_sellable: parentRow.is_sellable ?? true,
      track_stock: parentRow.track_stock ?? true,
      is_active: true,
      is_combo_product: false,
      opening_stock: hasVariations ? 0 : parentRow.opening_stock
    };
    if (parentRow.image_url) {
      productData.image_urls = [parentRow.image_url];
    }
    const variations = variantRows.map((row) => ({
      name: row.variation_name.trim(),
      sku: row.variation_sku.trim(),
      barcode: row.variation_barcode || null,
      attributes: { variant: row.variation_name.trim() },
      cost_price: row.cost_price,
      retail_price: row.selling_price,
      wholesale_price: row.wholesale_price ?? row.selling_price,
      opening_stock: row.opening_stock
    }));
    const saveResult = await productService.saveProductWithVariations({
      companyId,
      branchIdOrNull,
      parent: productData,
      variations
    });
    if (autoGenerateSku && !parentRow.sku?.trim()) {
      incrementNextNumber("production");
    }
    return { status: saveResult.parentCreated ? "created" : "updated" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "failed",
      error: { groupKey: key, productName: parentRow.name, rowIndex, message: msg, type: "failed" }
    };
  }
}
export async function commitProductImport(rowsWithIndex, deps) {
  const errors = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const plainRows = rowsWithIndex.map(stripIndex);
  const groups = groupProductRowsByName(plainRows);
  const groupEntries = Array.from(groups.entries());
  const settled = await runChunkedAllSettled(
    groupEntries,
    DEFAULT_IMPORT_CHUNK_SIZE,
    ([key, rows]) => importOneProductGroup(key, rows, rowsWithIndex, deps)
  );
  let gi = 0;
  for (const s of settled) {
    const [key, rows] = groupEntries[gi++];
    const parentResult = resolveParentRow(rows);
    const parent = parentResult.parent ?? rows[0];
    const rowIndex = parent ? representativeRowIndex(rowsWithIndex, parent) : 0;
    if (s.status === "rejected") {
      failed++;
      const msg = s.reason instanceof Error ? s.reason.message : String(s.reason ?? "Unknown error");
      errors.push({
        groupKey: key,
        productName: parent?.name ?? "",
        rowIndex,
        message: msg,
        type: "failed"
      });
      continue;
    }
    const r = s.value;
    if (r.status === "created") {
      created++;
    } else if (r.status === "updated") {
      updated++;
    } else if (r.status === "skipped") {
      skipped++;
      if (r.error) errors.push(r.error);
    } else {
      failed++;
      if (r.error) errors.push(r.error);
    }
  }
  return { created, updated, skipped, failed, errors };
}
export function productsToCanonicalCsv(products) {
  const dataRows = products.map(
    (p) => PRODUCT_CANONICAL_HEADERS.map((h) => {
      const v = p[h];
      if (v === null || v === void 0) return "";
      return String(v);
    })
  );
  return serializeCsvMatrix([[...PRODUCT_CANONICAL_HEADERS], ...dataRows]);
}
export function parseProductsCsvFile(text) {
  const structured = parseCsvToStructured(text);
  if ("error" in structured) {
    return { ok: false, error: structured.error };
  }
  const rows = rowsFromParsedCsvWithIndices(structured);
  return { ok: true, data: { parsed: structured, rows } };
}
const productsProfileEntity = {
  id: "products",
  displayName: "Products",
  canonicalHeaders: [...PRODUCT_CANONICAL_HEADERS],
  buildBlankTemplate: buildProductsBlankTemplate,
  parseFile: parseProductsCsvFile,
  isImplemented: true
};
export { productsProfileEntity as productsProfile };

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInByb2R1Y3RzUHJvZmlsZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogUHJvZHVjdHMgQ1NWIHByb2ZpbGUg4oCUIGNhbm9uaWNhbCBoZWFkZXJzLCBwYXJzZSwgY2F0YWxvZyB2YWxpZGF0aW9uLCBjb21taXQuXHJcbiAqIENsaWVudC1vbmx5OyB1c2VzIGV4aXN0aW5nIHNlcnZpY2VzIChubyBzY2hlbWEgLyB0cmlnZ2VyIGNoYW5nZXMpLlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IHBhcnNlQ3N2VG9TdHJ1Y3R1cmVkIH0gZnJvbSAnLi4vcGFyc2VDc3YnO1xyXG5pbXBvcnQgeyBzZXJpYWxpemVDc3ZNYXRyaXggfSBmcm9tICcuLi9zZXJpYWxpemVDc3YnO1xyXG5pbXBvcnQgeyBERUZBVUxUX0lNUE9SVF9DSFVOS19TSVpFLCBydW5DaHVua2VkQWxsU2V0dGxlZCB9IGZyb20gJy4uL2NodW5rZWRDb21taXQnO1xyXG5pbXBvcnQgdHlwZSB7IENzdkVudGl0eVByb2ZpbGUsIENzdlJvd1ZhbGlkYXRpb24sIENzdldvcmtiZW5jaFJlc3VsdCwgUGFyc2VkQ3N2IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgdHlwZSB7IENzdlByZXZpZXdDb2x1bW4gfSBmcm9tICcuLi9jb21wb25lbnRzL0NzdlByZXZpZXdEYXRhR3JpZCc7XHJcbmltcG9ydCB7IHByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnQC9hcHAvc2VydmljZXMvcHJvZHVjdFNlcnZpY2UnO1xyXG5pbXBvcnQgeyBwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlIH0gZnJvbSAnQC9hcHAvc2VydmljZXMvcHJvZHVjdENhdGVnb3J5U2VydmljZSc7XHJcbmltcG9ydCB7IHVuaXRTZXJ2aWNlIH0gZnJvbSAnQC9hcHAvc2VydmljZXMvdW5pdFNlcnZpY2UnO1xyXG5pbXBvcnQgeyBicmFuZFNlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy9icmFuZFNlcnZpY2UnO1xyXG5pbXBvcnQgdHlwZSB7IERvY3VtZW50VHlwZSB9IGZyb20gJ0AvYXBwL2hvb2tzL3VzZURvY3VtZW50TnVtYmVyaW5nJztcclxuXHJcbi8qKiBIZWFkZXIgb3JkZXIgPSB0ZW1wbGF0ZSA9IGV4cG9ydCByb3VuZC10cmlwIChtYXRjaGVzIGxlZ2FjeSBJbXBvcnRQcm9kdWN0c01vZGFsKS4gKi9cclxuZXhwb3J0IGNvbnN0IFBST0RVQ1RfQ0FOT05JQ0FMX0hFQURFUlMgPSBbXHJcbiAgJ25hbWUnLFxyXG4gICdza3UnLFxyXG4gICdjYXRlZ29yeScsXHJcbiAgJ3N1YmNhdGVnb3J5JyxcclxuICAndW5pdCcsXHJcbiAgJ2JyYW5kJyxcclxuICAnY29zdF9wcmljZScsXHJcbiAgJ3NlbGxpbmdfcHJpY2UnLFxyXG4gICd3aG9sZXNhbGVfcHJpY2UnLFxyXG4gICdvcGVuaW5nX3N0b2NrJyxcclxuICAnbWluX3N0b2NrJyxcclxuICAnbWF4X3N0b2NrJyxcclxuICAndHJhY2tfc3RvY2snLFxyXG4gICdpc19zZWxsYWJsZScsXHJcbiAgJ2JhcmNvZGUnLFxyXG4gICdkZXNjcmlwdGlvbicsXHJcbiAgJ2ltYWdlX3VybCcsXHJcbiAgJ3ZhcmlhdGlvbl9uYW1lJyxcclxuICAndmFyaWF0aW9uX3NrdScsXHJcbiAgJ3ZhcmlhdGlvbl9iYXJjb2RlJyxcclxuXSBhcyBjb25zdDtcclxuXHJcbi8qKiBDb2x1bW4gbGF5b3V0IGZvciBgQ3N2UHJldmlld0RhdGFHcmlkYCAoY2Fub25pY2FsIGtleXMpLiAqL1xyXG5leHBvcnQgY29uc3QgUFJPRFVDVF9QUkVWSUVXX0NPTFVNTlM6IENzdlByZXZpZXdDb2x1bW5bXSA9IFBST0RVQ1RfQ0FOT05JQ0FMX0hFQURFUlMubWFwKChrZXkpID0+ICh7XHJcbiAga2V5LFxyXG4gIGxhYmVsOiBrZXksXHJcbn0pKTtcclxuXHJcblxyXG4vKiogQ2FzZS1pbnNlbnNpdGl2ZSBoZWFkZXIgYWxpYXNlcyDihpIgY2Fub25pY2FsIGZpZWxkIGtleXMgKi9cclxuZXhwb3J0IGNvbnN0IFBST0RVQ1RfQ1NWX0hFQURFUl9BTElBU0VTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xyXG4gIG5hbWU6ICduYW1lJyxcclxuICAncHJvZHVjdCBuYW1lJzogJ25hbWUnLFxyXG4gIHNrdTogJ3NrdScsXHJcbiAgY2F0ZWdvcnk6ICdjYXRlZ29yeScsXHJcbiAgdW5pdDogJ3VuaXQnLFxyXG4gIGJyYW5kOiAnYnJhbmQnLFxyXG4gICdjb3N0IHByaWNlJzogJ2Nvc3RfcHJpY2UnLFxyXG4gICdwdXJjaGFzZSBwcmljZSc6ICdjb3N0X3ByaWNlJyxcclxuICBwdXJjaGFzZV9wcmljZTogJ2Nvc3RfcHJpY2UnLFxyXG4gIGNvc3RfcHJpY2U6ICdjb3N0X3ByaWNlJyxcclxuICAnc2VsbGluZyBwcmljZSc6ICdzZWxsaW5nX3ByaWNlJyxcclxuICAncmV0YWlsIHByaWNlJzogJ3NlbGxpbmdfcHJpY2UnLFxyXG4gIHJldGFpbF9wcmljZTogJ3NlbGxpbmdfcHJpY2UnLFxyXG4gIHNlbGxpbmdfcHJpY2U6ICdzZWxsaW5nX3ByaWNlJyxcclxuICAnd2hvbGVzYWxlIHByaWNlJzogJ3dob2xlc2FsZV9wcmljZScsXHJcbiAgd2hvbGVzYWxlX3ByaWNlOiAnd2hvbGVzYWxlX3ByaWNlJyxcclxuICAnb3BlbmluZyBzdG9jayc6ICdvcGVuaW5nX3N0b2NrJyxcclxuICBvcGVuaW5nX3N0b2NrOiAnb3BlbmluZ19zdG9jaycsXHJcbiAgJ2luaXRpYWwgc3RvY2snOiAnb3BlbmluZ19zdG9jaycsXHJcbiAgcXVhbnRpdHk6ICdvcGVuaW5nX3N0b2NrJyxcclxuICBxdHk6ICdvcGVuaW5nX3N0b2NrJyxcclxuICAnbWluIHN0b2NrJzogJ21pbl9zdG9jaycsXHJcbiAgbWluX3N0b2NrOiAnbWluX3N0b2NrJyxcclxuICAnbWF4IHN0b2NrJzogJ21heF9zdG9jaycsXHJcbiAgbWF4X3N0b2NrOiAnbWF4X3N0b2NrJyxcclxuICAndHJhY2sgc3RvY2snOiAndHJhY2tfc3RvY2snLFxyXG4gIHRyYWNrX3N0b2NrOiAndHJhY2tfc3RvY2snLFxyXG4gICdpcyByZW50YWJsZSc6ICdpc19yZW50YWJsZScsXHJcbiAgaXNfcmVudGFibGU6ICdpc19yZW50YWJsZScsXHJcbiAgJ2lzIHNlbGxhYmxlJzogJ2lzX3NlbGxhYmxlJyxcclxuICBpc19zZWxsYWJsZTogJ2lzX3NlbGxhYmxlJyxcclxuICBiYXJjb2RlOiAnYmFyY29kZScsXHJcbiAgZGVzY3JpcHRpb246ICdkZXNjcmlwdGlvbicsXHJcbiAgJ3ZhcmlhdGlvbiBuYW1lJzogJ3ZhcmlhdGlvbl9uYW1lJyxcclxuICB2YXJpYXRpb25fbmFtZTogJ3ZhcmlhdGlvbl9uYW1lJyxcclxuICB2YXJpYXRpb246ICd2YXJpYXRpb25fbmFtZScsXHJcbiAgdmFyaWFudDogJ3ZhcmlhdGlvbl9uYW1lJyxcclxuICAndmFyaWF0aW9uIHNrdSc6ICd2YXJpYXRpb25fc2t1JyxcclxuICB2YXJpYXRpb25fc2t1OiAndmFyaWF0aW9uX3NrdScsXHJcbiAgJ3ZhcmlhdGlvbiBiYXJjb2RlJzogJ3ZhcmlhdGlvbl9iYXJjb2RlJyxcclxuICB2YXJpYXRpb25fYmFyY29kZTogJ3ZhcmlhdGlvbl9iYXJjb2RlJyxcclxuICBzdWJjYXRlZ29yeTogJ3N1YmNhdGVnb3J5JyxcclxuICAnc3ViIGNhdGVnb3J5JzogJ3N1YmNhdGVnb3J5JyxcclxuICBzdWJfY2F0ZWdvcnk6ICdzdWJjYXRlZ29yeScsXHJcbiAgJ2ltYWdlIHVybCc6ICdpbWFnZV91cmwnLFxyXG4gIGltYWdlX3VybDogJ2ltYWdlX3VybCcsXHJcbn07XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFByb2R1Y3RSb3cge1xyXG4gIG5hbWU6IHN0cmluZztcclxuICBza3U6IHN0cmluZztcclxuICBjYXRlZ29yeT86IHN0cmluZztcclxuICB1bml0Pzogc3RyaW5nO1xyXG4gIGJyYW5kPzogc3RyaW5nO1xyXG4gIGNvc3RfcHJpY2U6IG51bWJlcjtcclxuICBzZWxsaW5nX3ByaWNlOiBudW1iZXI7XHJcbiAgd2hvbGVzYWxlX3ByaWNlPzogbnVtYmVyO1xyXG4gIG9wZW5pbmdfc3RvY2s6IG51bWJlcjtcclxuICBtaW5fc3RvY2s/OiBudW1iZXI7XHJcbiAgbWF4X3N0b2NrPzogbnVtYmVyO1xyXG4gIHRyYWNrX3N0b2NrPzogYm9vbGVhbjtcclxuICBpc19zZWxsYWJsZT86IGJvb2xlYW47XHJcbiAgYmFyY29kZT86IHN0cmluZztcclxuICBkZXNjcmlwdGlvbj86IHN0cmluZztcclxuICB2YXJpYXRpb25fbmFtZT86IHN0cmluZztcclxuICB2YXJpYXRpb25fc2t1Pzogc3RyaW5nO1xyXG4gIHZhcmlhdGlvbl9iYXJjb2RlPzogc3RyaW5nO1xyXG4gIHN1YmNhdGVnb3J5Pzogc3RyaW5nO1xyXG4gIGltYWdlX3VybD86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJbXBvcnRSb3dFcnJvciB7XHJcbiAgZ3JvdXBLZXk6IHN0cmluZztcclxuICBwcm9kdWN0TmFtZTogc3RyaW5nO1xyXG4gIHJvd0luZGV4OiBudW1iZXI7XHJcbiAgbWVzc2FnZTogc3RyaW5nO1xyXG4gIHR5cGU6ICd2YWxpZGF0aW9uJyB8ICdmYWlsZWQnO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEltcG9ydFN1bW1hcnkge1xyXG4gIGNyZWF0ZWQ6IG51bWJlcjtcclxuICB1cGRhdGVkOiBudW1iZXI7XHJcbiAgc2tpcHBlZDogbnVtYmVyO1xyXG4gIGZhaWxlZDogbnVtYmVyO1xyXG4gIGVycm9yczogSW1wb3J0Um93RXJyb3JbXTtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgUHJvZHVjdENhdGFsb2dDb250ZXh0ID0ge1xyXG4gIGNhdGVnb3J5QnlOYW1lOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xyXG4gIHN1YmNhdGVnb3J5QnlDYXRlZ29yeUFuZE5hbWU6IE1hcDxzdHJpbmcsIHN0cmluZz47XHJcbiAgdW5pdEJ5TmFtZTogTWFwPHN0cmluZywgc3RyaW5nPjtcclxuICB1bml0czogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IHNob3J0X2NvZGU/OiBzdHJpbmcgfCBudWxsIH1bXTtcclxuICBicmFuZEJ5TmFtZTogTWFwPHN0cmluZywgc3RyaW5nPjtcclxufTtcclxuXHJcbmZ1bmN0aW9uIHBhcnNlQm9vbCh2OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICBjb25zdCB0ID0gKHYgPz8gJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gIHJldHVybiB0ID09PSAneWVzJyB8fCB0ID09PSAnMScgfHwgdCA9PT0gJ3RydWUnIHx8IHQgPT09ICd5JztcclxufVxyXG5cclxuLyoqIEJsYW5rIHRlbXBsYXRlOiBoZWFkZXIgcm93ICsgb25lIGVtcHR5IGRhdGEgcm93IChFeGNlbC1mcmllbmRseSkuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBidWlsZFByb2R1Y3RzQmxhbmtUZW1wbGF0ZSgpOiBzdHJpbmcge1xyXG4gIGNvbnN0IGVtcHR5Um93ID0gUFJPRFVDVF9DQU5PTklDQUxfSEVBREVSUy5tYXAoKCkgPT4gJycpO1xyXG4gIHJldHVybiBzZXJpYWxpemVDc3ZNYXRyaXgoW1suLi5QUk9EVUNUX0NBTk9OSUNBTF9IRUFERVJTXSwgZW1wdHlSb3ddKTtcclxufVxyXG5cclxuLyoqIEV4YW1wbGUgcm93cyDigJQgTWF0cml4IC8gQmVzcG9rZTogcGFyZW50IHJvdyArIHZhcmlhbnQgcm93cyBncm91cGVkIGJ5IG5hbWUuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBidWlsZFByb2R1Y3RzU2FtcGxlVGVtcGxhdGUoKTogc3RyaW5nIHtcclxuICByZXR1cm4gc2VyaWFsaXplQ3N2TWF0cml4KFtcclxuICAgIFsuLi5QUk9EVUNUX0NBTk9OSUNBTF9IRUFERVJTXSxcclxuICAgIFtcclxuICAgICAgJ0Rlc2lnbiAxMDAwJyxcclxuICAgICAgJ0RTTi0xMDAwJyxcclxuICAgICAgJ0JyaWRhbCcsXHJcbiAgICAgICcnLFxyXG4gICAgICAnUGllY2UnLFxyXG4gICAgICAnJyxcclxuICAgICAgJzUwMDAnLFxyXG4gICAgICAnMTIwMDAnLFxyXG4gICAgICAnMTAwMDAnLFxyXG4gICAgICAnMCcsXHJcbiAgICAgICcyJyxcclxuICAgICAgJzUwJyxcclxuICAgICAgJ3llcycsXHJcbiAgICAgICd5ZXMnLFxyXG4gICAgICAnJyxcclxuICAgICAgJ1NoYW1vb3ogZGVzaWduIHBhcmVudCcsXHJcbiAgICAgICcnLFxyXG4gICAgICAnJyxcclxuICAgICAgJycsXHJcbiAgICAgICcnLFxyXG4gICAgXSxcclxuICAgIFtcclxuICAgICAgJ0Rlc2lnbiAxMDAwJyxcclxuICAgICAgJycsXHJcbiAgICAgICdCcmlkYWwnLFxyXG4gICAgICAnJyxcclxuICAgICAgJ1BpZWNlJyxcclxuICAgICAgJycsXHJcbiAgICAgICc0NTAwJyxcclxuICAgICAgJzE1MDAwJyxcclxuICAgICAgJzEyMDAwJyxcclxuICAgICAgJzMnLFxyXG4gICAgICAnJyxcclxuICAgICAgJycsXHJcbiAgICAgICd5ZXMnLFxyXG4gICAgICAneWVzJyxcclxuICAgICAgJycsXHJcbiAgICAgICcnLFxyXG4gICAgICAnJyxcclxuICAgICAgJ01hc3RlciBDb3B5JyxcclxuICAgICAgJ0RTTi0xMDAwLU1DJyxcclxuICAgICAgJycsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAnRGVzaWduIDEwMDAnLFxyXG4gICAgICAnJyxcclxuICAgICAgJ0JyaWRhbCcsXHJcbiAgICAgICcnLFxyXG4gICAgICAnUGllY2UnLFxyXG4gICAgICAnJyxcclxuICAgICAgJzMwMDAnLFxyXG4gICAgICAnOTAwMCcsXHJcbiAgICAgICc3NTAwJyxcclxuICAgICAgJzUnLFxyXG4gICAgICAnJyxcclxuICAgICAgJycsXHJcbiAgICAgICd5ZXMnLFxyXG4gICAgICAneWVzJyxcclxuICAgICAgJycsXHJcbiAgICAgICcnLFxyXG4gICAgICAnJyxcclxuICAgICAgJ1JlcGxpY2EnLFxyXG4gICAgICAnRFNOLTEwMDAtUkVQJyxcclxuICAgICAgJycsXHJcbiAgICBdLFxyXG4gICAgW1xyXG4gICAgICAnRGVzaWduIDEwMDAnLFxyXG4gICAgICAnJyxcclxuICAgICAgJ0JyaWRhbCcsXHJcbiAgICAgICcnLFxyXG4gICAgICAnUGllY2UnLFxyXG4gICAgICAnJyxcclxuICAgICAgJzI1MDAnLFxyXG4gICAgICAnODAwMCcsXHJcbiAgICAgICc2NTAwJyxcclxuICAgICAgJzInLFxyXG4gICAgICAnJyxcclxuICAgICAgJycsXHJcbiAgICAgICd5ZXMnLFxyXG4gICAgICAneWVzJyxcclxuICAgICAgJycsXHJcbiAgICAgICcnLFxyXG4gICAgICAnJyxcclxuICAgICAgJ0NoaWZmb24nLFxyXG4gICAgICAnRFNOLTEwMDAtQ0hGJyxcclxuICAgICAgJycsXHJcbiAgICBdLFxyXG4gIF0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZEhlYWRlckluZGV4TWFwKGhlYWRlcnM6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgbnVtYmVyPiB7XHJcbiAgY29uc3QgY29sTWFwOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XHJcbiAgaGVhZGVycy5mb3JFYWNoKChyYXcsIGkpID0+IHtcclxuICAgIGNvbnN0IGggPSByYXcudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBjb25zdCBrZXkgPSBQUk9EVUNUX0NTVl9IRUFERVJfQUxJQVNFU1toXSA/PyBoLnJlcGxhY2UoL1xccysvZywgJ18nKTtcclxuICAgIGNvbE1hcFtrZXldID0gaTtcclxuICB9KTtcclxuICByZXR1cm4gY29sTWFwO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcm93c0Zyb21QYXJzZWRDc3YocGFyc2VkOiBQYXJzZWRDc3YpOiBQYXJzZWRQcm9kdWN0Um93W10ge1xyXG4gIGNvbnN0IGhlYWRlciA9IHBhcnNlZC5oZWFkZXJzLm1hcCgoaCkgPT4gaC50cmltKCkudG9Mb3dlckNhc2UoKSk7XHJcbiAgY29uc3QgY29sTWFwID0gYnVpbGRIZWFkZXJJbmRleE1hcChwYXJzZWQuaGVhZGVycyk7XHJcbiAgY29uc3QgbmFtZUlkeCA9IGNvbE1hcC5uYW1lID8/IGhlYWRlci5maW5kSW5kZXgoKGgpID0+IFBST0RVQ1RfQ1NWX0hFQURFUl9BTElBU0VTW2hdID09PSAnbmFtZScpO1xyXG4gIGNvbnN0IHNrdUlkeCA9IGNvbE1hcC5za3UgPz8gaGVhZGVyLmZpbmRJbmRleCgoaCkgPT4gUFJPRFVDVF9DU1ZfSEVBREVSX0FMSUFTRVNbaF0gPT09ICdza3UnKTtcclxuICBpZiAobmFtZUlkeCA8IDApIHJldHVybiBbXTtcclxuXHJcbiAgY29uc3Qgcm93czogUGFyc2VkUHJvZHVjdFJvd1tdID0gW107XHJcbiAgZm9yIChjb25zdCBjZWxscyBvZiBwYXJzZWQucm93cykge1xyXG4gICAgY29uc3QgbmFtZSA9IChjZWxsc1tuYW1lSWR4XSA/PyAnJykudHJpbSgpO1xyXG4gICAgaWYgKCFuYW1lKSBjb250aW51ZTtcclxuICAgIGNvbnN0IHNrdVJhdyA9IChjZWxsc1tza3VJZHhdID8/ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBjb3N0UHJpY2UgPSBwYXJzZUZsb2F0KGNlbGxzW2NvbE1hcC5jb3N0X3ByaWNlID8/IC0xXSA/PyAnMCcpIHx8IDA7XHJcbiAgICBjb25zdCBzZWxsaW5nUHJpY2UgPSBwYXJzZUZsb2F0KGNlbGxzW2NvbE1hcC5zZWxsaW5nX3ByaWNlID8/IC0xXSA/PyAnMCcpIHx8IDA7XHJcbiAgICBjb25zdCB3aG9sZXNhbGVQcmljZSA9IHBhcnNlRmxvYXQoY2VsbHNbY29sTWFwLndob2xlc2FsZV9wcmljZSA/PyAtMV0gPz8gJycpIHx8IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IG9wZW5pbmdTdG9jayA9IHBhcnNlRmxvYXQoY2VsbHNbY29sTWFwLm9wZW5pbmdfc3RvY2sgPz8gLTFdID8/ICcwJykgfHwgMDtcclxuICAgIGNvbnN0IG1pblN0b2NrID0gcGFyc2VJbnQoY2VsbHNbY29sTWFwLm1pbl9zdG9jayA/PyAtMV0gPz8gJycsIDEwKTtcclxuICAgIGNvbnN0IG1heFN0b2NrID0gcGFyc2VJbnQoY2VsbHNbY29sTWFwLm1heF9zdG9jayA/PyAtMV0gPz8gJycsIDEwKTtcclxuICAgIGNvbnN0IHZhcmlhdGlvbk5hbWUgPSAoY2VsbHNbY29sTWFwLnZhcmlhdGlvbl9uYW1lID8/IC0xXSA/PyAnJykudHJpbSgpIHx8IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IHZhcmlhdGlvblNrdSA9IChjZWxsc1tjb2xNYXAudmFyaWF0aW9uX3NrdSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCB2YXJpYXRpb25CYXJjb2RlID0gKGNlbGxzW2NvbE1hcC52YXJpYXRpb25fYmFyY29kZSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCB0cmFja1N0b2NrUmF3ID0gKGNlbGxzW2NvbE1hcC50cmFja19zdG9jayA/PyAtMV0gPz8gJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgY29uc3QgaXNTZWxsYWJsZVJhdyA9IChjZWxsc1tjb2xNYXAuaXNfc2VsbGFibGUgPz8gLTFdID8/ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGNvbnN0IHN1YmNhdGVnb3J5ID0gKGNlbGxzW2NvbE1hcC5zdWJjYXRlZ29yeSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpbWFnZVVybCA9IChjZWxsc1tjb2xNYXAuaW1hZ2VfdXJsID8/IC0xXSA/PyAnJykudHJpbSgpIHx8IHVuZGVmaW5lZDtcclxuICAgIHJvd3MucHVzaCh7XHJcbiAgICAgIG5hbWUsXHJcbiAgICAgIHNrdTogc2t1UmF3IHx8ICcnLFxyXG4gICAgICBjYXRlZ29yeTogKGNlbGxzW2NvbE1hcC5jYXRlZ29yeSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQsXHJcbiAgICAgIHN1YmNhdGVnb3J5LFxyXG4gICAgICB1bml0OiAoY2VsbHNbY29sTWFwLnVuaXQgPz8gLTFdID8/ICcnKS50cmltKCkgfHwgdW5kZWZpbmVkLFxyXG4gICAgICBicmFuZDogKGNlbGxzW2NvbE1hcC5icmFuZCA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQsXHJcbiAgICAgIGNvc3RfcHJpY2U6IGNvc3RQcmljZSxcclxuICAgICAgc2VsbGluZ19wcmljZTogc2VsbGluZ1ByaWNlLFxyXG4gICAgICB3aG9sZXNhbGVfcHJpY2U6IHdob2xlc2FsZVByaWNlLFxyXG4gICAgICBvcGVuaW5nX3N0b2NrOiBvcGVuaW5nU3RvY2ssXHJcbiAgICAgIG1pbl9zdG9jazogTnVtYmVyLmlzTmFOKG1pblN0b2NrKSA/IHVuZGVmaW5lZCA6IG1pblN0b2NrLFxyXG4gICAgICBtYXhfc3RvY2s6IE51bWJlci5pc05hTihtYXhTdG9jaykgPyB1bmRlZmluZWQgOiBtYXhTdG9jayxcclxuICAgICAgdHJhY2tfc3RvY2s6IHRyYWNrU3RvY2tSYXcgPyBwYXJzZUJvb2wodHJhY2tTdG9ja1JhdykgOiB1bmRlZmluZWQsXHJcbiAgICAgIGlzX3NlbGxhYmxlOiBpc1NlbGxhYmxlUmF3ID8gcGFyc2VCb29sKGlzU2VsbGFibGVSYXcpIDogdW5kZWZpbmVkLFxyXG4gICAgICBiYXJjb2RlOiAoY2VsbHNbY29sTWFwLmJhcmNvZGUgPz8gLTFdID8/ICcnKS50cmltKCkgfHwgdW5kZWZpbmVkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogKGNlbGxzW2NvbE1hcC5kZXNjcmlwdGlvbiA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQsXHJcbiAgICAgIHZhcmlhdGlvbl9uYW1lOiB2YXJpYXRpb25OYW1lLFxyXG4gICAgICB2YXJpYXRpb25fc2t1OiB2YXJpYXRpb25Ta3UsXHJcbiAgICAgIHZhcmlhdGlvbl9iYXJjb2RlOiB2YXJpYXRpb25CYXJjb2RlLFxyXG4gICAgICBpbWFnZV91cmw6IGltYWdlVXJsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG4gIHJldHVybiByb3dzO1xyXG59XHJcblxyXG5jb25zdCBWQVJJQU5UX0xJS0UgPSAvXihTaXplfENvbG9yfFZhcmlhbnR8U3R5bGUpOlxccyouK3xeKFNNQUxMfE1FRElVTXxMQVJHRXxTfE18THxYTHxYWEwpJC9pO1xyXG5cclxuLyoqIE11dGF0ZXMgcm93cyBpbi1wbGFjZSDigJQgc2FtZSBoZXVyaXN0aWNzIGFzIGxlZ2FjeSBJbXBvcnRQcm9kdWN0c01vZGFsLiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplUHJvZHVjdFZhcmlhdGlvbkhldXJpc3RpY3MoZ3JvdXBzOiBNYXA8c3RyaW5nLCBQYXJzZWRQcm9kdWN0Um93W10+KTogdm9pZCB7XHJcbiAgZm9yIChjb25zdCByb3dzIG9mIGdyb3Vwcy52YWx1ZXMoKSkge1xyXG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xyXG4gICAgICBpZiAocm93LnZhcmlhdGlvbl9uYW1lKSBjb250aW51ZTtcclxuICAgICAgaWYgKHJvdy5kZXNjcmlwdGlvbiAmJiBWQVJJQU5UX0xJS0UudGVzdChyb3cuZGVzY3JpcHRpb24udHJpbSgpKSkge1xyXG4gICAgICAgIHJvdy52YXJpYXRpb25fbmFtZSA9IHJvdy5kZXNjcmlwdGlvbi50cmltKCk7XHJcbiAgICAgICAgcm93LmRlc2NyaXB0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChyb3cuaW1hZ2VfdXJsICYmICEvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KHJvdy5pbWFnZV91cmwpICYmIHJvdy5pbWFnZV91cmwubGVuZ3RoIDw9IDIwICYmICFyb3cudmFyaWF0aW9uX3NrdSkge1xyXG4gICAgICAgIHJvdy52YXJpYXRpb25fc2t1ID0gcm93LmltYWdlX3VybC50cmltKCk7XHJcbiAgICAgICAgcm93LmltYWdlX3VybCA9IHVuZGVmaW5lZDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyoqIE1hdHJpeC9CZXNwb2tlOiB2YXJpYW50IHJvdyBoYXMgbm9uLWVtcHR5IHZhcmlhdGlvbl9uYW1lLiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXNNYXRyaXhWYXJpYW50Um93KHJvdzogUGFyc2VkUHJvZHVjdFJvdyk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiAhIXJvdy52YXJpYXRpb25fbmFtZT8udHJpbSgpO1xyXG59XHJcblxyXG4vKiogR3JvdXAga2V5IGZvciBtYXRyaXggaW1wb3J0IOKAlCBzYW1lIHByb2R1Y3QgbmFtZSA9IG9uZSBwYXJlbnQgKyB2YXJpYW50cy4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdyb3VwTmFtZUtleUZvclByb2R1Y3Qocm93OiBQYXJzZWRQcm9kdWN0Um93KTogc3RyaW5nIHtcclxuICByZXR1cm4gcm93Lm5hbWUudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbn1cclxuXHJcbi8qKiBHcm91cCByb3dzIGJ5IHByb2R1Y3QgbmFtZSAocHJlc2VydmVzIENTViBvcmRlciB3aXRoaW4gZWFjaCBncm91cCkuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBncm91cFByb2R1Y3RSb3dzQnlOYW1lKHJvd3M6IFBhcnNlZFByb2R1Y3RSb3dbXSk6IE1hcDxzdHJpbmcsIFBhcnNlZFByb2R1Y3RSb3dbXT4ge1xyXG4gIGNvbnN0IGdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBQYXJzZWRQcm9kdWN0Um93W10+KCk7XHJcbiAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xyXG4gICAgY29uc3Qga2V5ID0gZ3JvdXBOYW1lS2V5Rm9yUHJvZHVjdChyb3cpO1xyXG4gICAgaWYgKCFncm91cHMuaGFzKGtleSkpIGdyb3Vwcy5zZXQoa2V5LCBbXSk7XHJcbiAgICBncm91cHMuZ2V0KGtleSkhLnB1c2gocm93KTtcclxuICB9XHJcbiAgcmV0dXJuIGdyb3VwcztcclxufVxyXG5cclxuLyoqIFBhcmVudCByb3cgPSBlbXB0eSB2YXJpYXRpb25fbmFtZTsgZXJyb3IgaWYgbWF0cml4IGdyb3VwIGhhcyAwIG9yID4xIHBhcmVudHMuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlUGFyZW50Um93KHJvd3M6IFBhcnNlZFByb2R1Y3RSb3dbXSk6IHsgcGFyZW50PzogUGFyc2VkUHJvZHVjdFJvdzsgZXJyb3I/OiBzdHJpbmcgfSB7XHJcbiAgY29uc3QgcGFyZW50Um93cyA9IHJvd3MuZmlsdGVyKChyKSA9PiAhaXNNYXRyaXhWYXJpYW50Um93KHIpKTtcclxuICBjb25zdCBoYXNWYXJpYW50cyA9IHJvd3Muc29tZSgocikgPT4gaXNNYXRyaXhWYXJpYW50Um93KHIpKTtcclxuICBpZiAoIWhhc1ZhcmlhbnRzKSB7XHJcbiAgICBpZiAocGFyZW50Um93cy5sZW5ndGggPT09IDApIHJldHVybiB7IGVycm9yOiAnTm8gcHJvZHVjdCByb3dzIGluIGdyb3VwJyB9O1xyXG4gICAgaWYgKHBhcmVudFJvd3MubGVuZ3RoID4gMSkgcmV0dXJuIHsgZXJyb3I6ICdTaW1wbGUgcHJvZHVjdCBncm91cCBtdXN0IGhhdmUgb25lIHJvdycgfTtcclxuICAgIHJldHVybiB7IHBhcmVudDogcGFyZW50Um93c1swXSB9O1xyXG4gIH1cclxuICBpZiAocGFyZW50Um93cy5sZW5ndGggPT09IDApIHtcclxuICAgIHJldHVybiB7IGVycm9yOiAnTWF0cml4IGdyb3VwIHJlcXVpcmVzIG9uZSBwYXJlbnQgcm93IChlbXB0eSB2YXJpYXRpb25fbmFtZSknIH07XHJcbiAgfVxyXG4gIGlmIChwYXJlbnRSb3dzLmxlbmd0aCA+IDEpIHtcclxuICAgIHJldHVybiB7IGVycm9yOiAnTWF0cml4IGdyb3VwIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJlbnQgcm93IChlbXB0eSB2YXJpYXRpb25fbmFtZSknIH07XHJcbiAgfVxyXG4gIHJldHVybiB7IHBhcmVudDogcGFyZW50Um93c1swXSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVZhcmlhbnRSb3dzKHJvd3M6IFBhcnNlZFByb2R1Y3RSb3dbXSk6IFBhcnNlZFByb2R1Y3RSb3dbXSB7XHJcbiAgcmV0dXJuIHJvd3MuZmlsdGVyKChyKSA9PiBpc01hdHJpeFZhcmlhbnRSb3cocikpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ3JvdXBLZXlGb3JQcm9kdWN0KHJvdzogUGFyc2VkUHJvZHVjdFJvdywgYXV0b1NrdUxhYmVsOiBib29sZWFuKTogc3RyaW5nIHtcclxuICBjb25zdCBza3VQYXJ0ID0gcm93LnNrdSB8fCAoYXV0b1NrdUxhYmVsID8gJyhhdXRvKScgOiAnJyk7XHJcbiAgcmV0dXJuIGAke3Jvdy5uYW1lfXwke3NrdVBhcnQgfHwgJyhhdXRvKSd9YDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdyb3VwUHJvZHVjdFJvd3Mocm93czogUGFyc2VkUHJvZHVjdFJvd1tdLCBhdXRvU2t1TGFiZWw6IGJvb2xlYW4pOiBNYXA8c3RyaW5nLCBQYXJzZWRQcm9kdWN0Um93W10+IHtcclxuICBjb25zdCBncm91cHMgPSBuZXcgTWFwPHN0cmluZywgUGFyc2VkUHJvZHVjdFJvd1tdPigpO1xyXG4gIGZvciAoY29uc3Qgcm93IG9mIHJvd3MpIHtcclxuICAgIGNvbnN0IGtleSA9IGdyb3VwS2V5Rm9yUHJvZHVjdChyb3csIGF1dG9Ta3VMYWJlbCk7XHJcbiAgICBpZiAoIWdyb3Vwcy5oYXMoa2V5KSkgZ3JvdXBzLnNldChrZXksIFtdKTtcclxuICAgIGdyb3Vwcy5nZXQoa2V5KSEucHVzaChyb3cpO1xyXG4gIH1cclxuICByZXR1cm4gZ3JvdXBzO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBQYXJzZWRQcm9kdWN0Um93V2l0aEluZGV4ID0gUGFyc2VkUHJvZHVjdFJvdyAmIHsgX3NvdXJjZVJvd0luZGV4OiBudW1iZXIgfTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByb3dzRnJvbVBhcnNlZENzdldpdGhJbmRpY2VzKHBhcnNlZDogUGFyc2VkQ3N2KTogUGFyc2VkUHJvZHVjdFJvd1dpdGhJbmRleFtdIHtcclxuICBjb25zdCBoZWFkZXIgPSBwYXJzZWQuaGVhZGVycy5tYXAoKGgpID0+IGgudHJpbSgpLnRvTG93ZXJDYXNlKCkpO1xyXG4gIGNvbnN0IGNvbE1hcCA9IGJ1aWxkSGVhZGVySW5kZXhNYXAocGFyc2VkLmhlYWRlcnMpO1xyXG4gIGNvbnN0IG5hbWVJZHggPSBjb2xNYXAubmFtZSA/PyBoZWFkZXIuZmluZEluZGV4KChoKSA9PiBQUk9EVUNUX0NTVl9IRUFERVJfQUxJQVNFU1toXSA9PT0gJ25hbWUnKTtcclxuICBjb25zdCBza3VJZHggPSBjb2xNYXAuc2t1ID8/IGhlYWRlci5maW5kSW5kZXgoKGgpID0+IFBST0RVQ1RfQ1NWX0hFQURFUl9BTElBU0VTW2hdID09PSAnc2t1Jyk7XHJcbiAgaWYgKG5hbWVJZHggPCAwKSByZXR1cm4gW107XHJcblxyXG4gIGNvbnN0IG91dDogUGFyc2VkUHJvZHVjdFJvd1dpdGhJbmRleFtdID0gW107XHJcbiAgZm9yIChsZXQgcmkgPSAwOyByaSA8IHBhcnNlZC5yb3dzLmxlbmd0aDsgcmkrKykge1xyXG4gICAgY29uc3QgY2VsbHMgPSBwYXJzZWQucm93c1tyaV0hO1xyXG4gICAgY29uc3QgbmFtZSA9IChjZWxsc1tuYW1lSWR4XSA/PyAnJykudHJpbSgpO1xyXG4gICAgaWYgKCFuYW1lKSBjb250aW51ZTtcclxuICAgIGNvbnN0IHNrdVJhdyA9IChjZWxsc1tza3VJZHhdID8/ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBjb3N0UHJpY2UgPSBwYXJzZUZsb2F0KGNlbGxzW2NvbE1hcC5jb3N0X3ByaWNlID8/IC0xXSA/PyAnMCcpIHx8IDA7XHJcbiAgICBjb25zdCBzZWxsaW5nUHJpY2UgPSBwYXJzZUZsb2F0KGNlbGxzW2NvbE1hcC5zZWxsaW5nX3ByaWNlID8/IC0xXSA/PyAnMCcpIHx8IDA7XHJcbiAgICBjb25zdCB3aG9sZXNhbGVQcmljZSA9IHBhcnNlRmxvYXQoY2VsbHNbY29sTWFwLndob2xlc2FsZV9wcmljZSA/PyAtMV0gPz8gJycpIHx8IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IG9wZW5pbmdTdG9jayA9IHBhcnNlRmxvYXQoY2VsbHNbY29sTWFwLm9wZW5pbmdfc3RvY2sgPz8gLTFdID8/ICcwJykgfHwgMDtcclxuICAgIGNvbnN0IG1pblN0b2NrID0gcGFyc2VJbnQoY2VsbHNbY29sTWFwLm1pbl9zdG9jayA/PyAtMV0gPz8gJycsIDEwKTtcclxuICAgIGNvbnN0IG1heFN0b2NrID0gcGFyc2VJbnQoY2VsbHNbY29sTWFwLm1heF9zdG9jayA/PyAtMV0gPz8gJycsIDEwKTtcclxuICAgIGNvbnN0IHZhcmlhdGlvbk5hbWUgPSAoY2VsbHNbY29sTWFwLnZhcmlhdGlvbl9uYW1lID8/IC0xXSA/PyAnJykudHJpbSgpIHx8IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IHZhcmlhdGlvblNrdSA9IChjZWxsc1tjb2xNYXAudmFyaWF0aW9uX3NrdSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCB2YXJpYXRpb25CYXJjb2RlID0gKGNlbGxzW2NvbE1hcC52YXJpYXRpb25fYmFyY29kZSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCB0cmFja1N0b2NrUmF3ID0gKGNlbGxzW2NvbE1hcC50cmFja19zdG9jayA/PyAtMV0gPz8gJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgY29uc3QgaXNTZWxsYWJsZVJhdyA9IChjZWxsc1tjb2xNYXAuaXNfc2VsbGFibGUgPz8gLTFdID8/ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGNvbnN0IHN1YmNhdGVnb3J5ID0gKGNlbGxzW2NvbE1hcC5zdWJjYXRlZ29yeSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpbWFnZVVybCA9IChjZWxsc1tjb2xNYXAuaW1hZ2VfdXJsID8/IC0xXSA/PyAnJykudHJpbSgpIHx8IHVuZGVmaW5lZDtcclxuICAgIG91dC5wdXNoKHtcclxuICAgICAgX3NvdXJjZVJvd0luZGV4OiByaSArIDIsXHJcbiAgICAgIG5hbWUsXHJcbiAgICAgIHNrdTogc2t1UmF3IHx8ICcnLFxyXG4gICAgICBjYXRlZ29yeTogKGNlbGxzW2NvbE1hcC5jYXRlZ29yeSA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQsXHJcbiAgICAgIHN1YmNhdGVnb3J5LFxyXG4gICAgICB1bml0OiAoY2VsbHNbY29sTWFwLnVuaXQgPz8gLTFdID8/ICcnKS50cmltKCkgfHwgdW5kZWZpbmVkLFxyXG4gICAgICBicmFuZDogKGNlbGxzW2NvbE1hcC5icmFuZCA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQsXHJcbiAgICAgIGNvc3RfcHJpY2U6IGNvc3RQcmljZSxcclxuICAgICAgc2VsbGluZ19wcmljZTogc2VsbGluZ1ByaWNlLFxyXG4gICAgICB3aG9sZXNhbGVfcHJpY2U6IHdob2xlc2FsZVByaWNlLFxyXG4gICAgICBvcGVuaW5nX3N0b2NrOiBvcGVuaW5nU3RvY2ssXHJcbiAgICAgIG1pbl9zdG9jazogTnVtYmVyLmlzTmFOKG1pblN0b2NrKSA/IHVuZGVmaW5lZCA6IG1pblN0b2NrLFxyXG4gICAgICBtYXhfc3RvY2s6IE51bWJlci5pc05hTihtYXhTdG9jaykgPyB1bmRlZmluZWQgOiBtYXhTdG9jayxcclxuICAgICAgdHJhY2tfc3RvY2s6IHRyYWNrU3RvY2tSYXcgPyBwYXJzZUJvb2wodHJhY2tTdG9ja1JhdykgOiB1bmRlZmluZWQsXHJcbiAgICAgIGlzX3NlbGxhYmxlOiBpc1NlbGxhYmxlUmF3ID8gcGFyc2VCb29sKGlzU2VsbGFibGVSYXcpIDogdW5kZWZpbmVkLFxyXG4gICAgICBiYXJjb2RlOiAoY2VsbHNbY29sTWFwLmJhcmNvZGUgPz8gLTFdID8/ICcnKS50cmltKCkgfHwgdW5kZWZpbmVkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogKGNlbGxzW2NvbE1hcC5kZXNjcmlwdGlvbiA/PyAtMV0gPz8gJycpLnRyaW0oKSB8fCB1bmRlZmluZWQsXHJcbiAgICAgIHZhcmlhdGlvbl9uYW1lOiB2YXJpYXRpb25OYW1lLFxyXG4gICAgICB2YXJpYXRpb25fc2t1OiB2YXJpYXRpb25Ta3UsXHJcbiAgICAgIHZhcmlhdGlvbl9iYXJjb2RlOiB2YXJpYXRpb25CYXJjb2RlLFxyXG4gICAgICBpbWFnZV91cmw6IGltYWdlVXJsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0cmlwSW5kZXgocm93OiBQYXJzZWRQcm9kdWN0Um93V2l0aEluZGV4KTogUGFyc2VkUHJvZHVjdFJvdyB7XHJcbiAgY29uc3QgeyBfc291cmNlUm93SW5kZXg6IF9pZHgsIC4uLnJlc3QgfSA9IHJvdztcclxuICB2b2lkIF9pZHg7XHJcbiAgcmV0dXJuIHJlc3Q7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVByb2R1Y3RzU3RydWN0dXJhbEluZGV4ZWQoXHJcbiAgcm93czogUGFyc2VkUHJvZHVjdFJvd1dpdGhJbmRleFtdLFxyXG4gIGF1dG9HZW5lcmF0ZVNrdTogYm9vbGVhblxyXG4pOiBDc3ZSb3dWYWxpZGF0aW9uW10ge1xyXG4gIGNvbnN0IGlzc3VlczogQ3N2Um93VmFsaWRhdGlvbltdID0gW107XHJcbiAgY29uc3QgcGxhaW5Sb3dzID0gcm93cy5tYXAoc3RyaXBJbmRleCk7XHJcbiAgY29uc3QgZ3JvdXBzID0gZ3JvdXBQcm9kdWN0Um93c0J5TmFtZShwbGFpblJvd3MpO1xyXG4gIGNvbnN0IGluZGV4QnlSb3cgPSBuZXcgTWFwPFBhcnNlZFByb2R1Y3RSb3csIG51bWJlcj4oKTtcclxuICByb3dzLmZvckVhY2goKHIpID0+IGluZGV4QnlSb3cuc2V0KHN0cmlwSW5kZXgociksIHIuX3NvdXJjZVJvd0luZGV4KSk7XHJcblxyXG4gIGZvciAoY29uc3QgWywgZ3JvdXBSb3dzXSBvZiBncm91cHMpIHtcclxuICAgIGNvbnN0IGhhc1ZhcmlhbnRzID0gZ3JvdXBSb3dzLnNvbWUoKHIpID0+IGlzTWF0cml4VmFyaWFudFJvdyhyKSk7XHJcbiAgICBjb25zdCBwYXJlbnRSZXN1bHQgPSByZXNvbHZlUGFyZW50Um93KGdyb3VwUm93cyk7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXJlbnRSZXN1bHQucGFyZW50O1xyXG4gICAgY29uc3QgcGFyZW50Um93SW5kZXggPSBwYXJlbnQgPyBpbmRleEJ5Um93LmdldChwYXJlbnQpID8/IGdyb3VwUm93c1swXT8ubmFtZS5sZW5ndGggOiAwO1xyXG5cclxuICAgIGlmIChwYXJlbnRSZXN1bHQuZXJyb3IpIHtcclxuICAgICAgY29uc3QgZmlyc3RJbmRleGVkID0gcm93cy5maW5kKChyKSA9PiBncm91cE5hbWVLZXlGb3JQcm9kdWN0KHIpID09PSBncm91cE5hbWVLZXlGb3JQcm9kdWN0KGdyb3VwUm93c1swXSEpKTtcclxuICAgICAgaXNzdWVzLnB1c2goe1xyXG4gICAgICAgIHJvd0luZGV4OiBmaXJzdEluZGV4ZWQ/Ll9zb3VyY2VSb3dJbmRleCA/PyAxLFxyXG4gICAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxyXG4gICAgICAgIG1lc3NhZ2U6IHBhcmVudFJlc3VsdC5lcnJvcixcclxuICAgICAgfSk7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChwYXJlbnQpIHtcclxuICAgICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUocGFyZW50LnNlbGxpbmdfcHJpY2UpKSB7XHJcbiAgICAgICAgaXNzdWVzLnB1c2goe1xyXG4gICAgICAgICAgcm93SW5kZXg6IGluZGV4QnlSb3cuZ2V0KHBhcmVudCkgPz8gcGFyZW50Um93SW5kZXgsXHJcbiAgICAgICAgICBzZXZlcml0eTogJ2Vycm9yJyxcclxuICAgICAgICAgIGZpZWxkOiAnc2VsbGluZ19wcmljZScsXHJcbiAgICAgICAgICBtZXNzYWdlOiAnU2VsbGluZyBwcmljZSBtdXN0IGJlIGEgdmFsaWQgbnVtYmVyIG9uIHBhcmVudCByb3cnLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICghYXV0b0dlbmVyYXRlU2t1ICYmICFwYXJlbnQuc2t1Py50cmltKCkpIHtcclxuICAgICAgICBpc3N1ZXMucHVzaCh7XHJcbiAgICAgICAgICByb3dJbmRleDogaW5kZXhCeVJvdy5nZXQocGFyZW50KSA/PyBwYXJlbnRSb3dJbmRleCxcclxuICAgICAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxyXG4gICAgICAgICAgZmllbGQ6ICdza3UnLFxyXG4gICAgICAgICAgbWVzc2FnZTogJ1BhcmVudCByb3cgU0tVIHJlcXVpcmVkIHVubGVzcyBhdXRvLWdlbmVyYXRlIGlzIGVuYWJsZWQnLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGhhc1ZhcmlhbnRzICYmIHBhcmVudCkge1xyXG4gICAgICBjb25zdCBwYXJlbnRJZHggPSBpbmRleEJ5Um93LmdldChwYXJlbnQpID8/IDA7XHJcbiAgICAgIGNvbnN0IHZhcmlhbnRSb3dzID0gcmVzb2x2ZVZhcmlhbnRSb3dzKGdyb3VwUm93cyk7XHJcbiAgICAgIGNvbnN0IHNlZW5WYXJTa3VzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IHZSb3cgb2YgdmFyaWFudFJvd3MpIHtcclxuICAgICAgICBjb25zdCB2SWR4ID0gaW5kZXhCeVJvdy5nZXQodlJvdykgPz8gcGFyZW50SWR4O1xyXG4gICAgICAgIGlmICghdlJvdy52YXJpYXRpb25fbmFtZT8udHJpbSgpKSB7XHJcbiAgICAgICAgICBpc3N1ZXMucHVzaCh7XHJcbiAgICAgICAgICAgIHJvd0luZGV4OiB2SWR4LFxyXG4gICAgICAgICAgICBzZXZlcml0eTogJ2Vycm9yJyxcclxuICAgICAgICAgICAgZmllbGQ6ICd2YXJpYXRpb25fbmFtZScsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdWYXJpYW50IHJvdyByZXF1aXJlcyB2YXJpYXRpb25fbmFtZScsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF2Um93LnZhcmlhdGlvbl9za3U/LnRyaW0oKSkge1xyXG4gICAgICAgICAgaXNzdWVzLnB1c2goe1xyXG4gICAgICAgICAgICByb3dJbmRleDogdklkeCxcclxuICAgICAgICAgICAgc2V2ZXJpdHk6ICdlcnJvcicsXHJcbiAgICAgICAgICAgIGZpZWxkOiAndmFyaWF0aW9uX3NrdScsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdWYXJpYW50IHJvdyByZXF1aXJlcyB2YXJpYXRpb25fc2t1JyxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb25zdCBza3VLZXkgPSB2Um93LnZhcmlhdGlvbl9za3UudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICBpZiAoc2VlblZhclNrdXMuaGFzKHNrdUtleSkpIHtcclxuICAgICAgICAgICAgaXNzdWVzLnB1c2goe1xyXG4gICAgICAgICAgICAgIHJvd0luZGV4OiB2SWR4LFxyXG4gICAgICAgICAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxyXG4gICAgICAgICAgICAgIGZpZWxkOiAndmFyaWF0aW9uX3NrdScsXHJcbiAgICAgICAgICAgICAgbWVzc2FnZTogYER1cGxpY2F0ZSB2YXJpYXRpb25fc2t1IFwiJHt2Um93LnZhcmlhdGlvbl9za3V9XCIgaW4gZ3JvdXBgLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHNlZW5WYXJTa3VzLmFkZChza3VLZXkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIU51bWJlci5pc0Zpbml0ZSh2Um93LnNlbGxpbmdfcHJpY2UpKSB7XHJcbiAgICAgICAgICBpc3N1ZXMucHVzaCh7XHJcbiAgICAgICAgICAgIHJvd0luZGV4OiB2SWR4LFxyXG4gICAgICAgICAgICBzZXZlcml0eTogJ2Vycm9yJyxcclxuICAgICAgICAgICAgZmllbGQ6ICdzZWxsaW5nX3ByaWNlJyxcclxuICAgICAgICAgICAgbWVzc2FnZTogJ1ZhcmlhbnQgc2VsbGluZyBwcmljZSBtdXN0IGJlIGEgdmFsaWQgbnVtYmVyJyxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZmlyc3RWYXJpYW50SWR4ID0gdmFyaWFudFJvd3MubGVuZ3RoXHJcbiAgICAgICAgPyBpbmRleEJ5Um93LmdldCh2YXJpYW50Um93c1swXSEpID8/IHBhcmVudElkeFxyXG4gICAgICAgIDogbnVsbDtcclxuICAgICAgaWYgKGZpcnN0VmFyaWFudElkeCAhPSBudWxsICYmIHBhcmVudElkeCA+IDAgJiYgZmlyc3RWYXJpYW50SWR4IDwgcGFyZW50SWR4KSB7XHJcbiAgICAgICAgaXNzdWVzLnB1c2goe1xyXG4gICAgICAgICAgcm93SW5kZXg6IGZpcnN0VmFyaWFudElkeCxcclxuICAgICAgICAgIHNldmVyaXR5OiAnd2FybmluZycsXHJcbiAgICAgICAgICBtZXNzYWdlOiAnVmFyaWFudCByb3cgYXBwZWFycyBiZWZvcmUgcGFyZW50IHJvdzsgaW1wb3J0IHdpbGwgc3RpbGwgdXNlIGVtcHR5IHZhcmlhdGlvbl9uYW1lIGFzIHBhcmVudCcsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGZvciAoY29uc3QgciBvZiBncm91cFJvd3MpIHtcclxuICAgICAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShyLnNlbGxpbmdfcHJpY2UpKSB7XHJcbiAgICAgICAgICBpc3N1ZXMucHVzaCh7XHJcbiAgICAgICAgICAgIHJvd0luZGV4OiBpbmRleEJ5Um93LmdldChyKSA/PyAxLFxyXG4gICAgICAgICAgICBzZXZlcml0eTogJ2Vycm9yJyxcclxuICAgICAgICAgICAgZmllbGQ6ICdzZWxsaW5nX3ByaWNlJyxcclxuICAgICAgICAgICAgbWVzc2FnZTogJ1NlbGxpbmcgcHJpY2UgbXVzdCBiZSBhIHZhbGlkIG51bWJlcicsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFhdXRvR2VuZXJhdGVTa3UgJiYgIXIuc2t1Py50cmltKCkpIHtcclxuICAgICAgICAgIGlzc3Vlcy5wdXNoKHtcclxuICAgICAgICAgICAgcm93SW5kZXg6IGluZGV4QnlSb3cuZ2V0KHIpID8/IDEsXHJcbiAgICAgICAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxyXG4gICAgICAgICAgICBmaWVsZDogJ3NrdScsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdTS1UgcmVxdWlyZWQgdW5sZXNzIGF1dG8tZ2VuZXJhdGUgaXMgZW5hYmxlZCcsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBpc3N1ZXM7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkUHJvZHVjdENhdGFsb2dDb250ZXh0KGNvbXBhbnlJZDogc3RyaW5nKTogUHJvbWlzZTxQcm9kdWN0Q2F0YWxvZ0NvbnRleHQ+IHtcclxuICBjb25zdCBbY2F0ZWdvcmllc0ZsYXQsIHVuaXRzLCBicmFuZHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgcHJvZHVjdENhdGVnb3J5U2VydmljZS5nZXRBbGxDYXRlZ29yaWVzRmxhdChjb21wYW55SWQsIHsgaW5jbHVkZUluYWN0aXZlOiB0cnVlIH0pLFxyXG4gICAgdW5pdFNlcnZpY2UuZ2V0QWxsKGNvbXBhbnlJZCwgeyBpbmNsdWRlSW5hY3RpdmU6IHRydWUgfSksXHJcbiAgICBicmFuZFNlcnZpY2UuZ2V0QWxsKGNvbXBhbnlJZCwgeyBpbmNsdWRlSW5hY3RpdmU6IHRydWUgfSksXHJcbiAgXSk7XHJcblxyXG4gIGNvbnN0IHRvcExldmVsQ2F0ZWdvcmllcyA9IGNhdGVnb3JpZXNGbGF0LmZpbHRlcigoYzogeyBwYXJlbnRfaWQ6IHN0cmluZyB8IG51bGwgfSkgPT4gIWMucGFyZW50X2lkKTtcclxuICBjb25zdCBjYXRlZ29yeUJ5TmFtZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KFxyXG4gICAgdG9wTGV2ZWxDYXRlZ29yaWVzLm1hcCgoYzogeyBuYW1lOiBzdHJpbmc7IGlkOiBzdHJpbmcgfSkgPT4gW2MubmFtZS50b0xvd2VyQ2FzZSgpLCBjLmlkXSlcclxuICApO1xyXG4gIGNvbnN0IHN1YmNhdGVnb3J5QnlDYXRlZ29yeUFuZE5hbWUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG4gIGNhdGVnb3JpZXNGbGF0LmZvckVhY2goKGM6IHsgcGFyZW50X2lkOiBzdHJpbmcgfCBudWxsOyBuYW1lOiBzdHJpbmc7IGlkOiBzdHJpbmcgfSkgPT4ge1xyXG4gICAgaWYgKGMucGFyZW50X2lkKSB7XHJcbiAgICAgIHN1YmNhdGVnb3J5QnlDYXRlZ29yeUFuZE5hbWUuc2V0KGAke2MucGFyZW50X2lkfXwke2MubmFtZS50b0xvd2VyQ2FzZSgpfWAsIGMuaWQpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBjb25zdCB1bml0UGFpcnM6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtcclxuICAgIC4uLnVuaXRzLm1hcCgodTogeyBuYW1lOiBzdHJpbmc7IGlkOiBzdHJpbmcgfSkgPT4gW3UubmFtZS50b0xvd2VyQ2FzZSgpLCB1LmlkXSBhcyBbc3RyaW5nLCBzdHJpbmddKSxcclxuICAgIC4uLnVuaXRzXHJcbiAgICAgIC5tYXAoKHU6IHsgc2hvcnRfY29kZT86IHN0cmluZyB8IG51bGw7IGlkOiBzdHJpbmcgfSkgPT4gWyh1LnNob3J0X2NvZGUgfHwgJycpLnRvTG93ZXJDYXNlKCksIHUuaWRdIGFzIFtzdHJpbmcsIHN0cmluZ10pXHJcbiAgICAgIC5maWx0ZXIoKFtrXSkgPT4gay5sZW5ndGggPiAwKSxcclxuICBdO1xyXG4gIGNvbnN0IHVuaXRCeU5hbWUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPih1bml0UGFpcnMpO1xyXG4gIGNvbnN0IGJyYW5kQnlOYW1lID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oYnJhbmRzLm1hcCgoYjogeyBuYW1lOiBzdHJpbmc7IGlkOiBzdHJpbmcgfSkgPT4gW2IubmFtZS50b0xvd2VyQ2FzZSgpLCBiLmlkXSkpO1xyXG5cclxuICByZXR1cm4geyBjYXRlZ29yeUJ5TmFtZSwgc3ViY2F0ZWdvcnlCeUNhdGVnb3J5QW5kTmFtZSwgdW5pdEJ5TmFtZSwgdW5pdHMsIGJyYW5kQnlOYW1lIH07XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIFByb2R1Y3RDb21taXREZXBzID0ge1xyXG4gIGNvbXBhbnlJZDogc3RyaW5nO1xyXG4gIGJyYW5jaElkT3JOdWxsOiBzdHJpbmcgfCBudWxsO1xyXG4gIGNhdGFsb2c6IFByb2R1Y3RDYXRhbG9nQ29udGV4dDtcclxuICBhdXRvR2VuZXJhdGVTa3U6IGJvb2xlYW47XHJcbiAgLyoqIFdoZW4gdHJ1ZSwgY3JlYXRlIG1pc3NpbmcgY2F0ZWdvcnkgLyBzdWJjYXRlZ29yeSAvIHVuaXQgLyBicmFuZCB2aWEgZXhpc3Rpbmcgc2VydmljZXMgKi9cclxuICBhdXRvQ3JlYXRlQ2F0YWxvZzogYm9vbGVhbjtcclxuICBnZW5lcmF0ZURvY3VtZW50TnVtYmVyU2FmZTogKGRvY1R5cGU6IERvY3VtZW50VHlwZSkgPT4gUHJvbWlzZTxzdHJpbmc+O1xyXG4gIGluY3JlbWVudE5leHROdW1iZXI6IChkb2NUeXBlOiBEb2N1bWVudFR5cGUpID0+IHZvaWQ7XHJcbn07XHJcblxyXG5leHBvcnQgdHlwZSBSZXNvbHZlZFByb2R1Y3RDYXRhbG9nSWRzID0ge1xyXG4gIGNhdGVnb3J5SWQ6IHN0cmluZyB8IG51bGw7XHJcbiAgdW5pdElkOiBzdHJpbmcgfCBudWxsO1xyXG4gIGJyYW5kSWQ6IHN0cmluZyB8IG51bGw7XHJcbiAgZXJyb3I/OiBzdHJpbmc7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVzb2x2ZSAoYW5kIG9wdGlvbmFsbHkgY3JlYXRlKSBjYXRlZ29yeSwgdW5pdCwgYnJhbmQgZm9yIG9uZSBwcm9kdWN0IGdyb3VwLlxyXG4gKiBNdXRhdGVzIGBjYXRhbG9nYCBtYXBzIHdoZW4gYXV0by1jcmVhdGUgc3VjY2VlZHMuXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZVByb2R1Y3RDYXRhbG9nSWRzKFxyXG4gIGNvbXBhbnlJZDogc3RyaW5nLFxyXG4gIGNhdGFsb2c6IFByb2R1Y3RDYXRhbG9nQ29udGV4dCxcclxuICBmaXJzdDogUGFyc2VkUHJvZHVjdFJvdyxcclxuICBhdXRvQ3JlYXRlTWlzc2luZzogYm9vbGVhblxyXG4pOiBQcm9taXNlPFJlc29sdmVkUHJvZHVjdENhdGFsb2dJZHM+IHtcclxuICBjb25zdCB7IGNhdGVnb3J5QnlOYW1lLCBzdWJjYXRlZ29yeUJ5Q2F0ZWdvcnlBbmROYW1lLCB1bml0QnlOYW1lLCB1bml0cywgYnJhbmRCeU5hbWUgfSA9IGNhdGFsb2c7XHJcblxyXG4gIGlmIChmaXJzdC5zdWJjYXRlZ29yeSAmJiAhZmlyc3QuY2F0ZWdvcnkpIHtcclxuICAgIHJldHVybiB7IGNhdGVnb3J5SWQ6IG51bGwsIHVuaXRJZDogbnVsbCwgYnJhbmRJZDogbnVsbCwgZXJyb3I6ICdTdWJjYXRlZ29yeSByZXF1aXJlcyBjYXRlZ29yeScgfTtcclxuICB9XHJcblxyXG4gIGxldCBjYXRlZ29yeUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBpZiAoZmlyc3QuY2F0ZWdvcnkpIHtcclxuICAgIGNvbnN0IGNhdEtleSA9IGZpcnN0LmNhdGVnb3J5LnRvTG93ZXJDYXNlKCk7XHJcbiAgICBsZXQgY2F0SWQgPSBjYXRlZ29yeUJ5TmFtZS5nZXQoY2F0S2V5KSA/PyBudWxsO1xyXG4gICAgaWYgKCFjYXRJZCAmJiBhdXRvQ3JlYXRlTWlzc2luZykge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZSh7XHJcbiAgICAgICAgICBjb21wYW55X2lkOiBjb21wYW55SWQsXHJcbiAgICAgICAgICBuYW1lOiBmaXJzdC5jYXRlZ29yeS50cmltKCksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY2F0SWQgPSBjcmVhdGVkLmlkO1xyXG4gICAgICAgIGNhdGVnb3J5QnlOYW1lLnNldChjYXRLZXksIGNhdElkKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnN0IG1zZyA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6ICdGYWlsZWQgdG8gY3JlYXRlIGNhdGVnb3J5JztcclxuICAgICAgICByZXR1cm4geyBjYXRlZ29yeUlkOiBudWxsLCB1bml0SWQ6IG51bGwsIGJyYW5kSWQ6IG51bGwsIGVycm9yOiBtc2cgfTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKCFjYXRJZCkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGNhdGVnb3J5SWQ6IG51bGwsXHJcbiAgICAgICAgdW5pdElkOiBudWxsLFxyXG4gICAgICAgIGJyYW5kSWQ6IG51bGwsXHJcbiAgICAgICAgZXJyb3I6IGBDYXRlZ29yeSBcIiR7Zmlyc3QuY2F0ZWdvcnl9XCIgbm90IGZvdW5kYCxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIGlmIChmaXJzdC5zdWJjYXRlZ29yeSkge1xyXG4gICAgICBjb25zdCBzdWJLZXkgPSBgJHtjYXRJZH18JHtmaXJzdC5zdWJjYXRlZ29yeS50cmltKCkudG9Mb3dlckNhc2UoKX1gO1xyXG4gICAgICBsZXQgc3ViSWQgPSBzdWJjYXRlZ29yeUJ5Q2F0ZWdvcnlBbmROYW1lLmdldChzdWJLZXkpID8/IG51bGw7XHJcbiAgICAgIGlmICghc3ViSWQgJiYgYXV0b0NyZWF0ZU1pc3NpbmcpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByb2R1Y3RDYXRlZ29yeVNlcnZpY2UuY3JlYXRlKHtcclxuICAgICAgICAgICAgY29tcGFueV9pZDogY29tcGFueUlkLFxyXG4gICAgICAgICAgICBuYW1lOiBmaXJzdC5zdWJjYXRlZ29yeS50cmltKCksXHJcbiAgICAgICAgICAgIHBhcmVudF9pZDogY2F0SWQsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHN1YklkID0gY3JlYXRlZC5pZDtcclxuICAgICAgICAgIHN1YmNhdGVnb3J5QnlDYXRlZ29yeUFuZE5hbWUuc2V0KHN1YktleSwgc3ViSWQpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgIGNvbnN0IG1zZyA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6ICdGYWlsZWQgdG8gY3JlYXRlIHN1YmNhdGVnb3J5JztcclxuICAgICAgICAgIHJldHVybiB7IGNhdGVnb3J5SWQ6IG51bGwsIHVuaXRJZDogbnVsbCwgYnJhbmRJZDogbnVsbCwgZXJyb3I6IG1zZyB9O1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBpZiAoIXN1YklkKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIGNhdGVnb3J5SWQ6IG51bGwsXHJcbiAgICAgICAgICB1bml0SWQ6IG51bGwsXHJcbiAgICAgICAgICBicmFuZElkOiBudWxsLFxyXG4gICAgICAgICAgZXJyb3I6IGBTdWJjYXRlZ29yeSBcIiR7Zmlyc3Quc3ViY2F0ZWdvcnl9XCIgbm90IGZvdW5kIG9yIGRvZXMgbm90IGJlbG9uZyB0byBjYXRlZ29yeSBcIiR7Zmlyc3QuY2F0ZWdvcnl9XCJgLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICAgY2F0ZWdvcnlJZCA9IHN1YklkO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY2F0ZWdvcnlJZCA9IGNhdElkO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbGV0IHVuaXRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgaWYgKGZpcnN0LnVuaXQpIHtcclxuICAgIGNvbnN0IHVLZXkgPSBmaXJzdC51bml0LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgdW5pdElkID0gdW5pdEJ5TmFtZS5nZXQodUtleSkgPz8gdW5pdHMuZmluZCgodSkgPT4gKHUuc2hvcnRfY29kZSB8fCAnJykudG9Mb3dlckNhc2UoKSA9PT0gdUtleSk/LmlkID8/IG51bGw7XHJcbiAgICBpZiAoIXVuaXRJZCAmJiBhdXRvQ3JlYXRlTWlzc2luZykge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCB1bml0U2VydmljZS5jcmVhdGUoe1xyXG4gICAgICAgICAgY29tcGFueV9pZDogY29tcGFueUlkLFxyXG4gICAgICAgICAgbmFtZTogZmlyc3QudW5pdC50cmltKCksXHJcbiAgICAgICAgICBzaG9ydF9jb2RlOiBmaXJzdC51bml0LnRyaW0oKS5zbGljZSgwLCAxMCksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdW5pdElkID0gY3JlYXRlZC5pZDtcclxuICAgICAgICB1bml0QnlOYW1lLnNldCh1S2V5LCB1bml0SWQpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc3QgbXNnID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogJ0ZhaWxlZCB0byBjcmVhdGUgdW5pdCc7XHJcbiAgICAgICAgcmV0dXJuIHsgY2F0ZWdvcnlJZCwgdW5pdElkOiBudWxsLCBicmFuZElkOiBudWxsLCBlcnJvcjogbXNnIH07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICghdW5pdElkKSB7XHJcbiAgICAgIHJldHVybiB7IGNhdGVnb3J5SWQsIHVuaXRJZDogbnVsbCwgYnJhbmRJZDogbnVsbCwgZXJyb3I6IGBVbml0IFwiJHtmaXJzdC51bml0fVwiIG5vdCBmb3VuZGAgfTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGxldCBicmFuZElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBpZiAoZmlyc3QuYnJhbmQpIHtcclxuICAgIGNvbnN0IGJLZXkgPSBmaXJzdC5icmFuZC50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKCFicmFuZEJ5TmFtZS5oYXMoYktleSkpIHtcclxuICAgICAgaWYgKGF1dG9DcmVhdGVNaXNzaW5nKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBicmFuZFNlcnZpY2UuY3JlYXRlKHsgY29tcGFueV9pZDogY29tcGFueUlkLCBuYW1lOiBmaXJzdC5icmFuZC50cmltKCkgfSk7XHJcbiAgICAgICAgICBicmFuZEJ5TmFtZS5zZXQoYktleSwgY3JlYXRlZC5pZCk7XHJcbiAgICAgICAgICBicmFuZElkID0gY3JlYXRlZC5pZDtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICBjb25zdCBtc2cgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiAnRmFpbGVkIHRvIGNyZWF0ZSBicmFuZCc7XHJcbiAgICAgICAgICByZXR1cm4geyBjYXRlZ29yeUlkLCB1bml0SWQsIGJyYW5kSWQ6IG51bGwsIGVycm9yOiBtc2cgfTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHsgY2F0ZWdvcnlJZCwgdW5pdElkLCBicmFuZElkOiBudWxsLCBlcnJvcjogYEJyYW5kIFwiJHtmaXJzdC5icmFuZH1cIiBub3QgZm91bmRgIH07XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGJyYW5kSWQgPSBicmFuZEJ5TmFtZS5nZXQoYktleSkgPz8gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiB7IGNhdGVnb3J5SWQsIHVuaXRJZCwgYnJhbmRJZCB9O1xyXG59XHJcblxyXG4vKiogRHJ5LXJ1biBjYXRhbG9nIGNoZWNrIChuZXZlciB3cml0ZXMgdG8gREIpLiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tQcm9kdWN0Q2F0YWxvZ1JlZnNEcnkoXHJcbiAgY2F0YWxvZzogUHJvZHVjdENhdGFsb2dDb250ZXh0LFxyXG4gIGZpcnN0OiBQYXJzZWRQcm9kdWN0Um93XHJcbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XHJcbiAgaWYgKGZpcnN0LnN1YmNhdGVnb3J5ICYmICFmaXJzdC5jYXRlZ29yeSkgcmV0dXJuICdTdWJjYXRlZ29yeSByZXF1aXJlcyBjYXRlZ29yeSc7XHJcbiAgaWYgKGZpcnN0LmNhdGVnb3J5KSB7XHJcbiAgICBjb25zdCBjYXRJZCA9IGNhdGFsb2cuY2F0ZWdvcnlCeU5hbWUuZ2V0KGZpcnN0LmNhdGVnb3J5LnRvTG93ZXJDYXNlKCkpO1xyXG4gICAgaWYgKCFjYXRJZCkgcmV0dXJuIGBDYXRlZ29yeSBcIiR7Zmlyc3QuY2F0ZWdvcnl9XCIgbm90IGZvdW5kYDtcclxuICAgIGlmIChmaXJzdC5zdWJjYXRlZ29yeSkge1xyXG4gICAgICBjb25zdCBzdWJJZCA9IGNhdGFsb2cuc3ViY2F0ZWdvcnlCeUNhdGVnb3J5QW5kTmFtZS5nZXQoXHJcbiAgICAgICAgYCR7Y2F0SWR9fCR7Zmlyc3Quc3ViY2F0ZWdvcnkudHJpbSgpLnRvTG93ZXJDYXNlKCl9YFxyXG4gICAgICApO1xyXG4gICAgICBpZiAoIXN1YklkKSB7XHJcbiAgICAgICAgcmV0dXJuIGBTdWJjYXRlZ29yeSBcIiR7Zmlyc3Quc3ViY2F0ZWdvcnl9XCIgbm90IGZvdW5kIG9yIGRvZXMgbm90IGJlbG9uZyB0byBjYXRlZ29yeSBcIiR7Zmlyc3QuY2F0ZWdvcnl9XCJgO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIGlmIChmaXJzdC51bml0KSB7XHJcbiAgICBjb25zdCB1S2V5ID0gZmlyc3QudW5pdC50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGNvbnN0IHVuaXRJZCA9XHJcbiAgICAgIGNhdGFsb2cudW5pdEJ5TmFtZS5nZXQodUtleSkgPz9cclxuICAgICAgY2F0YWxvZy51bml0cy5maW5kKCh1KSA9PiAodS5zaG9ydF9jb2RlIHx8ICcnKS50b0xvd2VyQ2FzZSgpID09PSB1S2V5KT8uaWQ7XHJcbiAgICBpZiAoIXVuaXRJZCkgcmV0dXJuIGBVbml0IFwiJHtmaXJzdC51bml0fVwiIG5vdCBmb3VuZGA7XHJcbiAgfVxyXG4gIGlmIChmaXJzdC5icmFuZCAmJiAhY2F0YWxvZy5icmFuZEJ5TmFtZS5oYXMoZmlyc3QuYnJhbmQudG9Mb3dlckNhc2UoKSkpIHtcclxuICAgIHJldHVybiBgQnJhbmQgXCIke2ZpcnN0LmJyYW5kfVwiIG5vdCBmb3VuZGA7XHJcbiAgfVxyXG4gIHJldHVybiB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbi8qKiBQcmV2aWV3LXRpbWUgY2F0YWxvZyBjaGVja3MgKG9uZSB2YWxpZGF0aW9uIHBhc3MgcGVyIHByb2R1Y3QgZ3JvdXA7IHJlYWQtb25seSkuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2YWxpZGF0ZVByb2R1Y3RzQ2F0YWxvZ0ZvclByZXZpZXcoXHJcbiAgY29tcGFueUlkOiBzdHJpbmcsXHJcbiAgcm93czogUGFyc2VkUHJvZHVjdFJvd1dpdGhJbmRleFtdLFxyXG4gIGF1dG9DcmVhdGVDYXRhbG9nOiBib29sZWFuXHJcbik6IFByb21pc2U8Q3N2Um93VmFsaWRhdGlvbltdPiB7XHJcbiAgY29uc3QgY2F0YWxvZyA9IGF3YWl0IGxvYWRQcm9kdWN0Q2F0YWxvZ0NvbnRleHQoY29tcGFueUlkKTtcclxuICBjb25zdCBpc3N1ZXM6IENzdlJvd1ZhbGlkYXRpb25bXSA9IFtdO1xyXG4gIGNvbnN0IHNlZW5Hcm91cHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuXHJcbiAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xyXG4gICAgY29uc3QgZ2sgPSBncm91cE5hbWVLZXlGb3JQcm9kdWN0KHJvdyk7XHJcbiAgICBpZiAoc2Vlbkdyb3Vwcy5oYXMoZ2spKSBjb250aW51ZTtcclxuICAgIHNlZW5Hcm91cHMuYWRkKGdrKTtcclxuXHJcbiAgICBjb25zdCBncm91cFJvd3MgPSByb3dzLmZpbHRlcigocikgPT4gZ3JvdXBOYW1lS2V5Rm9yUHJvZHVjdChyKSA9PT0gZ2spO1xyXG4gICAgY29uc3QgcGFyZW50UmVzdWx0ID0gcmVzb2x2ZVBhcmVudFJvdyhncm91cFJvd3MubWFwKHN0cmlwSW5kZXgpKTtcclxuICAgIGNvbnN0IGNhdGFsb2dSb3cgPSBwYXJlbnRSZXN1bHQucGFyZW50ID8/IHJvdztcclxuXHJcbiAgICBjb25zdCBkcnlFcnJvciA9IGNoZWNrUHJvZHVjdENhdGFsb2dSZWZzRHJ5KGNhdGFsb2csIGNhdGFsb2dSb3cpO1xyXG4gICAgaWYgKGRyeUVycm9yKSB7XHJcbiAgICAgIGlmIChhdXRvQ3JlYXRlQ2F0YWxvZykge1xyXG4gICAgICAgIGNvbnN0IGhpbnRzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgIGlmIChyb3cuY2F0ZWdvcnkgJiYgZHJ5RXJyb3IuaW5jbHVkZXMoJ0NhdGVnb3J5JykpIGhpbnRzLnB1c2goYHdpbGwgY3JlYXRlIGNhdGVnb3J5IFwiJHtjYXRhbG9nUm93LmNhdGVnb3J5fVwiYCk7XHJcbiAgICAgICAgaWYgKHJvdy51bml0ICYmIGRyeUVycm9yLmluY2x1ZGVzKCdVbml0JykpIGhpbnRzLnB1c2goYHdpbGwgY3JlYXRlIHVuaXQgXCIke2NhdGFsb2dSb3cudW5pdH1cImApO1xyXG4gICAgICAgIGlmIChyb3cuYnJhbmQgJiYgZHJ5RXJyb3IuaW5jbHVkZXMoJ0JyYW5kJykpIGhpbnRzLnB1c2goYHdpbGwgY3JlYXRlIGJyYW5kIFwiJHtjYXRhbG9nUm93LmJyYW5kfVwiYCk7XHJcbiAgICAgICAgaWYgKGNhdGFsb2dSb3cuc3ViY2F0ZWdvcnkgJiYgZHJ5RXJyb3IuaW5jbHVkZXMoJ1N1YmNhdGVnb3J5JykpIHtcclxuICAgICAgICAgIGhpbnRzLnB1c2goYHdpbGwgY3JlYXRlIHN1YmNhdGVnb3J5IFwiJHtjYXRhbG9nUm93LnN1YmNhdGVnb3J5fVwiYCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChoaW50cy5sZW5ndGgpIHtcclxuICAgICAgICAgIGlzc3Vlcy5wdXNoKHsgcm93SW5kZXg6IHJvdy5fc291cmNlUm93SW5kZXgsIHNldmVyaXR5OiAnd2FybmluZycsIG1lc3NhZ2U6IGhpbnRzLmpvaW4oJzsgJykgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGlzc3Vlcy5wdXNoKHsgcm93SW5kZXg6IHJvdy5fc291cmNlUm93SW5kZXgsIHNldmVyaXR5OiAnZXJyb3InLCBtZXNzYWdlOiBkcnlFcnJvciB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaXNzdWVzLnB1c2goeyByb3dJbmRleDogcm93Ll9zb3VyY2VSb3dJbmRleCwgc2V2ZXJpdHk6ICdlcnJvcicsIG1lc3NhZ2U6IGRyeUVycm9yIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gaXNzdWVzO1xyXG59XHJcblxyXG4vKiogTWFwIHZhbGlkYXRpb25zIGtleWVkIGJ5IDAtYmFzZWQgaW5kZXggaW50byBgcm93c2AgZm9yIENzdlByZXZpZXdEYXRhR3JpZC4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJvd0Vycm9yc01hcEZvclByZXZpZXcoXHJcbiAgcm93czogUGFyc2VkUHJvZHVjdFJvd1dpdGhJbmRleFtdLFxyXG4gIHZhbGlkYXRpb25zOiBDc3ZSb3dWYWxpZGF0aW9uW11cclxuKTogTWFwPG51bWJlciwgQ3N2Um93VmFsaWRhdGlvbltdPiB7XHJcbiAgY29uc3QgYnlTb3VyY2VSb3cgPSBuZXcgTWFwPG51bWJlciwgQ3N2Um93VmFsaWRhdGlvbltdPigpO1xyXG4gIGZvciAoY29uc3QgdiBvZiB2YWxpZGF0aW9ucykge1xyXG4gICAgY29uc3QgbGlzdCA9IGJ5U291cmNlUm93LmdldCh2LnJvd0luZGV4KSA/PyBbXTtcclxuICAgIGxpc3QucHVzaCh2KTtcclxuICAgIGJ5U291cmNlUm93LnNldCh2LnJvd0luZGV4LCBsaXN0KTtcclxuICB9XHJcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxudW1iZXIsIENzdlJvd1ZhbGlkYXRpb25bXT4oKTtcclxuICByb3dzLmZvckVhY2goKHIsIGkpID0+IHtcclxuICAgIGNvbnN0IGxpc3QgPSBieVNvdXJjZVJvdy5nZXQoci5fc291cmNlUm93SW5kZXgpO1xyXG4gICAgaWYgKGxpc3Q/Lmxlbmd0aCkgbWFwLnNldChpLCBsaXN0KTtcclxuICB9KTtcclxuICByZXR1cm4gbWFwO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcHJvZHVjdFJvd1RvUHJldmlld1JlY29yZChyb3c6IFBhcnNlZFByb2R1Y3RSb3dXaXRoSW5kZXgpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBudW1iZXI+IHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogcm93Lm5hbWUsXHJcbiAgICBza3U6IHJvdy5za3UgfHwgJyhhdXRvKScsXHJcbiAgICBjYXRlZ29yeTogcm93LmNhdGVnb3J5ID8/ICcnLFxyXG4gICAgdmFyaWF0aW9uX25hbWU6IHJvdy52YXJpYXRpb25fbmFtZSA/PyAnJyxcclxuICAgIGNvc3RfcHJpY2U6IHJvdy5jb3N0X3ByaWNlLFxyXG4gICAgc2VsbGluZ19wcmljZTogcm93LnNlbGxpbmdfcHJpY2UsXHJcbiAgICBvcGVuaW5nX3N0b2NrOiByb3cub3BlbmluZ19zdG9jayxcclxuICB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiByZXByZXNlbnRhdGl2ZVJvd0luZGV4KHJvd3NXaXRoSW5kZXg6IFBhcnNlZFByb2R1Y3RSb3dXaXRoSW5kZXhbXSwgcGFyZW50OiBQYXJzZWRQcm9kdWN0Um93KTogbnVtYmVyIHtcclxuICBjb25zdCBpbmRpY2VzID0gcm93c1dpdGhJbmRleFxyXG4gICAgLmZpbHRlcigocikgPT4gZ3JvdXBOYW1lS2V5Rm9yUHJvZHVjdChyKSA9PT0gZ3JvdXBOYW1lS2V5Rm9yUHJvZHVjdChwYXJlbnQpKVxyXG4gICAgLm1hcCgocikgPT4gci5fc291cmNlUm93SW5kZXgpO1xyXG4gIHJldHVybiBpbmRpY2VzLmxlbmd0aCA/IE1hdGgubWluKC4uLmluZGljZXMpIDogMTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gaW1wb3J0T25lUHJvZHVjdEdyb3VwKFxyXG4gIGtleTogc3RyaW5nLFxyXG4gIHJvd3M6IFBhcnNlZFByb2R1Y3RSb3dbXSxcclxuICByb3dzV2l0aEluZGV4OiBQYXJzZWRQcm9kdWN0Um93V2l0aEluZGV4W10sXHJcbiAgZGVwczogUHJvZHVjdENvbW1pdERlcHNcclxuKTogUHJvbWlzZTx7IHN0YXR1czogJ2NyZWF0ZWQnIHwgJ3VwZGF0ZWQnIHwgJ3NraXBwZWQnIHwgJ2ZhaWxlZCc7IGVycm9yPzogSW1wb3J0Um93RXJyb3IgfT4ge1xyXG4gIGNvbnN0IHtcclxuICAgIGNvbXBhbnlJZCxcclxuICAgIGJyYW5jaElkT3JOdWxsLFxyXG4gICAgY2F0YWxvZyxcclxuICAgIGF1dG9HZW5lcmF0ZVNrdSxcclxuICAgIGF1dG9DcmVhdGVDYXRhbG9nLFxyXG4gICAgZ2VuZXJhdGVEb2N1bWVudE51bWJlclNhZmUsXHJcbiAgICBpbmNyZW1lbnROZXh0TnVtYmVyLFxyXG4gIH0gPSBkZXBzO1xyXG5cclxuICBjb25zdCBwYXJlbnRSZXN1bHQgPSByZXNvbHZlUGFyZW50Um93KHJvd3MpO1xyXG4gIGlmIChwYXJlbnRSZXN1bHQuZXJyb3IgfHwgIXBhcmVudFJlc3VsdC5wYXJlbnQpIHtcclxuICAgIGNvbnN0IHJvd0luZGV4ID0gcm93c1dpdGhJbmRleC5maW5kKChyKSA9PiBncm91cE5hbWVLZXlGb3JQcm9kdWN0KHIpID09PSBrZXkpPy5fc291cmNlUm93SW5kZXggPz8gMTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1czogJ3NraXBwZWQnLFxyXG4gICAgICBlcnJvcjoge1xyXG4gICAgICAgIGdyb3VwS2V5OiBrZXksXHJcbiAgICAgICAgcHJvZHVjdE5hbWU6IHJvd3NbMF0/Lm5hbWUgPz8gJycsXHJcbiAgICAgICAgcm93SW5kZXgsXHJcbiAgICAgICAgbWVzc2FnZTogcGFyZW50UmVzdWx0LmVycm9yID8/ICdDb3VsZCBub3QgcmVzb2x2ZSBwYXJlbnQgcm93JyxcclxuICAgICAgICB0eXBlOiAndmFsaWRhdGlvbicsXHJcbiAgICAgIH0sXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgY29uc3QgcGFyZW50Um93ID0gcGFyZW50UmVzdWx0LnBhcmVudDtcclxuICBjb25zdCB2YXJpYW50Um93cyA9IHJlc29sdmVWYXJpYW50Um93cyhyb3dzKTtcclxuICBjb25zdCBoYXNWYXJpYXRpb25zID0gdmFyaWFudFJvd3MubGVuZ3RoID4gMDtcclxuICBjb25zdCByb3dJbmRleCA9IHJlcHJlc2VudGF0aXZlUm93SW5kZXgocm93c1dpdGhJbmRleCwgcGFyZW50Um93KTtcclxuXHJcbiAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlUHJvZHVjdENhdGFsb2dJZHMoY29tcGFueUlkLCBjYXRhbG9nLCBwYXJlbnRSb3csIGF1dG9DcmVhdGVDYXRhbG9nKTtcclxuICBpZiAocmVzb2x2ZWQuZXJyb3IpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1czogJ3NraXBwZWQnLFxyXG4gICAgICBlcnJvcjoge1xyXG4gICAgICAgIGdyb3VwS2V5OiBrZXksXHJcbiAgICAgICAgcHJvZHVjdE5hbWU6IHBhcmVudFJvdy5uYW1lLFxyXG4gICAgICAgIHJvd0luZGV4LFxyXG4gICAgICAgIG1lc3NhZ2U6IHJlc29sdmVkLmVycm9yLFxyXG4gICAgICAgIHR5cGU6ICd2YWxpZGF0aW9uJyxcclxuICAgICAgfSxcclxuICAgIH07XHJcbiAgfVxyXG4gIGNvbnN0IHsgY2F0ZWdvcnlJZCwgdW5pdElkLCBicmFuZElkIH0gPSByZXNvbHZlZDtcclxuXHJcbiAgbGV0IHNrdVRvVXNlID0gcGFyZW50Um93LnNrdT8udHJpbSgpIHx8ICcnO1xyXG4gIGlmICghc2t1VG9Vc2UgJiYgIWF1dG9HZW5lcmF0ZVNrdSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzOiAnc2tpcHBlZCcsXHJcbiAgICAgIGVycm9yOiB7XHJcbiAgICAgICAgZ3JvdXBLZXk6IGtleSxcclxuICAgICAgICBwcm9kdWN0TmFtZTogcGFyZW50Um93Lm5hbWUsXHJcbiAgICAgICAgcm93SW5kZXgsXHJcbiAgICAgICAgbWVzc2FnZTogJ1BhcmVudCByb3cgU0tVIHJlcXVpcmVkIHVubGVzcyBhdXRvLWdlbmVyYXRlIGlzIGVuYWJsZWQnLFxyXG4gICAgICAgIHR5cGU6ICd2YWxpZGF0aW9uJyxcclxuICAgICAgfSxcclxuICAgIH07XHJcbiAgfVxyXG4gIGlmICghc2t1VG9Vc2UpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHNrdVRvVXNlID0gYXdhaXQgZ2VuZXJhdGVEb2N1bWVudE51bWJlclNhZmUoJ3Byb2R1Y3Rpb24nKTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXR1czogJ2ZhaWxlZCcsXHJcbiAgICAgICAgZXJyb3I6IHtcclxuICAgICAgICAgIGdyb3VwS2V5OiBrZXksXHJcbiAgICAgICAgICBwcm9kdWN0TmFtZTogcGFyZW50Um93Lm5hbWUsXHJcbiAgICAgICAgICByb3dJbmRleCxcclxuICAgICAgICAgIG1lc3NhZ2U6ICdGYWlsZWQgdG8gZ2VuZXJhdGUgU0tVJyxcclxuICAgICAgICAgIHR5cGU6ICdmYWlsZWQnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICB0cnkge1xyXG4gICAgY29uc3QgcHJvZHVjdERhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xyXG4gICAgICBjb21wYW55X2lkOiBjb21wYW55SWQsXHJcbiAgICAgIGNhdGVnb3J5X2lkOiBjYXRlZ29yeUlkLFxyXG4gICAgICBicmFuZF9pZDogYnJhbmRJZCxcclxuICAgICAgdW5pdF9pZDogdW5pdElkLFxyXG4gICAgICBuYW1lOiBwYXJlbnRSb3cubmFtZSxcclxuICAgICAgc2t1OiBza3VUb1VzZSxcclxuICAgICAgYmFyY29kZTogcGFyZW50Um93LmJhcmNvZGUgfHwgbnVsbCxcclxuICAgICAgZGVzY3JpcHRpb246IHBhcmVudFJvdy5kZXNjcmlwdGlvbiB8fCBudWxsLFxyXG4gICAgICBjb3N0X3ByaWNlOiBwYXJlbnRSb3cuY29zdF9wcmljZSxcclxuICAgICAgcmV0YWlsX3ByaWNlOiBwYXJlbnRSb3cuc2VsbGluZ19wcmljZSxcclxuICAgICAgd2hvbGVzYWxlX3ByaWNlOiBwYXJlbnRSb3cud2hvbGVzYWxlX3ByaWNlID8/IHBhcmVudFJvdy5zZWxsaW5nX3ByaWNlLFxyXG4gICAgICBtaW5fc3RvY2s6IHBhcmVudFJvdy5taW5fc3RvY2sgPz8gMCxcclxuICAgICAgbWF4X3N0b2NrOiBwYXJlbnRSb3cubWF4X3N0b2NrID8/IDEwMDAsXHJcbiAgICAgIGhhc192YXJpYXRpb25zOiBoYXNWYXJpYXRpb25zLFxyXG4gICAgICBpc19yZW50YWJsZTogZmFsc2UsXHJcbiAgICAgIGlzX3NlbGxhYmxlOiBwYXJlbnRSb3cuaXNfc2VsbGFibGUgPz8gdHJ1ZSxcclxuICAgICAgdHJhY2tfc3RvY2s6IHBhcmVudFJvdy50cmFja19zdG9jayA/PyB0cnVlLFxyXG4gICAgICBpc19hY3RpdmU6IHRydWUsXHJcbiAgICAgIGlzX2NvbWJvX3Byb2R1Y3Q6IGZhbHNlLFxyXG4gICAgICBvcGVuaW5nX3N0b2NrOiBoYXNWYXJpYXRpb25zID8gMCA6IHBhcmVudFJvdy5vcGVuaW5nX3N0b2NrLFxyXG4gICAgfTtcclxuICAgIGlmIChwYXJlbnRSb3cuaW1hZ2VfdXJsKSB7XHJcbiAgICAgIHByb2R1Y3REYXRhLmltYWdlX3VybHMgPSBbcGFyZW50Um93LmltYWdlX3VybF07XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdmFyaWF0aW9ucyA9IHZhcmlhbnRSb3dzLm1hcCgocm93KSA9PiAoe1xyXG4gICAgICBuYW1lOiByb3cudmFyaWF0aW9uX25hbWUhLnRyaW0oKSxcclxuICAgICAgc2t1OiByb3cudmFyaWF0aW9uX3NrdSEudHJpbSgpLFxyXG4gICAgICBiYXJjb2RlOiByb3cudmFyaWF0aW9uX2JhcmNvZGUgfHwgbnVsbCxcclxuICAgICAgYXR0cmlidXRlczogeyB2YXJpYW50OiByb3cudmFyaWF0aW9uX25hbWUhLnRyaW0oKSB9LFxyXG4gICAgICBjb3N0X3ByaWNlOiByb3cuY29zdF9wcmljZSxcclxuICAgICAgcmV0YWlsX3ByaWNlOiByb3cuc2VsbGluZ19wcmljZSxcclxuICAgICAgd2hvbGVzYWxlX3ByaWNlOiByb3cud2hvbGVzYWxlX3ByaWNlID8/IHJvdy5zZWxsaW5nX3ByaWNlLFxyXG4gICAgICBvcGVuaW5nX3N0b2NrOiByb3cub3BlbmluZ19zdG9jayxcclxuICAgIH0pKTtcclxuXHJcbiAgICBjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgcHJvZHVjdFNlcnZpY2Uuc2F2ZVByb2R1Y3RXaXRoVmFyaWF0aW9ucyh7XHJcbiAgICAgIGNvbXBhbnlJZCxcclxuICAgICAgYnJhbmNoSWRPck51bGwsXHJcbiAgICAgIHBhcmVudDogcHJvZHVjdERhdGEsXHJcbiAgICAgIHZhcmlhdGlvbnMsXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoYXV0b0dlbmVyYXRlU2t1ICYmICFwYXJlbnRSb3cuc2t1Py50cmltKCkpIHtcclxuICAgICAgaW5jcmVtZW50TmV4dE51bWJlcigncHJvZHVjdGlvbicpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7IHN0YXR1czogc2F2ZVJlc3VsdC5wYXJlbnRDcmVhdGVkID8gJ2NyZWF0ZWQnIDogJ3VwZGF0ZWQnIH07XHJcbiAgfSBjYXRjaCAoZXJyOiB1bmtub3duKSB7XHJcbiAgICBjb25zdCBtc2cgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzOiAnZmFpbGVkJyxcclxuICAgICAgZXJyb3I6IHsgZ3JvdXBLZXk6IGtleSwgcHJvZHVjdE5hbWU6IHBhcmVudFJvdy5uYW1lLCByb3dJbmRleCwgbWVzc2FnZTogbXNnLCB0eXBlOiAnZmFpbGVkJyB9LFxyXG4gICAgfTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbXBvcnQgcHJvZHVjdCBncm91cHMg4oCUIHNhbWUgYmVoYXZpb3IgYXMgbGVnYWN5IEltcG9ydFByb2R1Y3RzTW9kYWwuaGFuZGxlSW1wb3J0LlxyXG4gKiBHcm91cHMgYXJlIGNvbW1pdHRlZCBpbiBwYXJhbGxlbCBjaHVua3MgKFByb21pc2UuYWxsU2V0dGxlZCkgZm9yIHRocm91Z2hwdXQuXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29tbWl0UHJvZHVjdEltcG9ydChcclxuICByb3dzV2l0aEluZGV4OiBQYXJzZWRQcm9kdWN0Um93V2l0aEluZGV4W10sXHJcbiAgZGVwczogUHJvZHVjdENvbW1pdERlcHNcclxuKTogUHJvbWlzZTxJbXBvcnRTdW1tYXJ5PiB7XHJcbiAgY29uc3QgZXJyb3JzOiBJbXBvcnRSb3dFcnJvcltdID0gW107XHJcbiAgbGV0IGNyZWF0ZWQgPSAwO1xyXG4gIGxldCB1cGRhdGVkID0gMDtcclxuICBsZXQgc2tpcHBlZCA9IDA7XHJcbiAgbGV0IGZhaWxlZCA9IDA7XHJcblxyXG4gIGNvbnN0IHBsYWluUm93cyA9IHJvd3NXaXRoSW5kZXgubWFwKHN0cmlwSW5kZXgpO1xyXG4gIGNvbnN0IGdyb3VwcyA9IGdyb3VwUHJvZHVjdFJvd3NCeU5hbWUocGxhaW5Sb3dzKTtcclxuXHJcbiAgY29uc3QgZ3JvdXBFbnRyaWVzID0gQXJyYXkuZnJvbShncm91cHMuZW50cmllcygpKTtcclxuICBjb25zdCBzZXR0bGVkID0gYXdhaXQgcnVuQ2h1bmtlZEFsbFNldHRsZWQoXHJcbiAgICBncm91cEVudHJpZXMsXHJcbiAgICBERUZBVUxUX0lNUE9SVF9DSFVOS19TSVpFLFxyXG4gICAgKFtrZXksIHJvd3NdKSA9PiBpbXBvcnRPbmVQcm9kdWN0R3JvdXAoa2V5LCByb3dzLCByb3dzV2l0aEluZGV4LCBkZXBzKVxyXG4gICk7XHJcblxyXG4gIGxldCBnaSA9IDA7XHJcbiAgZm9yIChjb25zdCBzIG9mIHNldHRsZWQpIHtcclxuICAgIGNvbnN0IFtrZXksIHJvd3NdID0gZ3JvdXBFbnRyaWVzW2dpKytdITtcclxuICAgIGNvbnN0IHBhcmVudFJlc3VsdCA9IHJlc29sdmVQYXJlbnRSb3cocm93cyk7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXJlbnRSZXN1bHQucGFyZW50ID8/IHJvd3NbMF07XHJcbiAgICBjb25zdCByb3dJbmRleCA9IHBhcmVudCA/IHJlcHJlc2VudGF0aXZlUm93SW5kZXgocm93c1dpdGhJbmRleCwgcGFyZW50KSA6IDA7XHJcbiAgICBpZiAocy5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcclxuICAgICAgZmFpbGVkKys7XHJcbiAgICAgIGNvbnN0IG1zZyA9IHMucmVhc29uIGluc3RhbmNlb2YgRXJyb3IgPyBzLnJlYXNvbi5tZXNzYWdlIDogU3RyaW5nKHMucmVhc29uID8/ICdVbmtub3duIGVycm9yJyk7XHJcbiAgICAgIGVycm9ycy5wdXNoKHtcclxuICAgICAgICBncm91cEtleToga2V5LFxyXG4gICAgICAgIHByb2R1Y3ROYW1lOiBwYXJlbnQ/Lm5hbWUgPz8gJycsXHJcbiAgICAgICAgcm93SW5kZXgsXHJcbiAgICAgICAgbWVzc2FnZTogbXNnLFxyXG4gICAgICAgIHR5cGU6ICdmYWlsZWQnLFxyXG4gICAgICB9KTtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcbiAgICBjb25zdCByID0gcy52YWx1ZTtcclxuICAgIGlmIChyLnN0YXR1cyA9PT0gJ2NyZWF0ZWQnKSB7XHJcbiAgICAgIGNyZWF0ZWQrKztcclxuICAgIH0gZWxzZSBpZiAoci5zdGF0dXMgPT09ICd1cGRhdGVkJykge1xyXG4gICAgICB1cGRhdGVkKys7XHJcbiAgICB9IGVsc2UgaWYgKHIuc3RhdHVzID09PSAnc2tpcHBlZCcpIHtcclxuICAgICAgc2tpcHBlZCsrO1xyXG4gICAgICBpZiAoci5lcnJvcikgZXJyb3JzLnB1c2goci5lcnJvcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBmYWlsZWQrKztcclxuICAgICAgaWYgKHIuZXJyb3IpIGVycm9ycy5wdXNoKHIuZXJyb3IpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHsgY3JlYXRlZCwgdXBkYXRlZCwgc2tpcHBlZCwgZmFpbGVkLCBlcnJvcnMgfTtcclxufVxyXG5cclxuLyoqIFNlcmlhbGl6ZSBwcm9kdWN0cyB0byBjYW5vbmljYWwgQ1NWIChyb3VuZC10cmlwIHdpdGggaW1wb3J0IHRlbXBsYXRlKS4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHByb2R1Y3RzVG9DYW5vbmljYWxDc3YoXHJcbiAgcHJvZHVjdHM6IEFycmF5PFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfCBudWxsIHwgdW5kZWZpbmVkPj5cclxuKTogc3RyaW5nIHtcclxuICBjb25zdCBkYXRhUm93cyA9IHByb2R1Y3RzLm1hcCgocCkgPT5cclxuICAgIFBST0RVQ1RfQ0FOT05JQ0FMX0hFQURFUlMubWFwKChoKSA9PiB7XHJcbiAgICAgIGNvbnN0IHYgPSBwW2hdO1xyXG4gICAgICBpZiAodiA9PT0gbnVsbCB8fCB2ID09PSB1bmRlZmluZWQpIHJldHVybiAnJztcclxuICAgICAgcmV0dXJuIFN0cmluZyh2KTtcclxuICAgIH0pXHJcbiAgKTtcclxuICByZXR1cm4gc2VyaWFsaXplQ3N2TWF0cml4KFtbLi4uUFJPRFVDVF9DQU5PTklDQUxfSEVBREVSU10sIC4uLmRhdGFSb3dzXSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVByb2R1Y3RzQ3N2RmlsZSh0ZXh0OiBzdHJpbmcpOiBDc3ZXb3JrYmVuY2hSZXN1bHQ8eyBwYXJzZWQ6IFBhcnNlZENzdjsgcm93czogUGFyc2VkUHJvZHVjdFJvd1dpdGhJbmRleFtdIH0+IHtcclxuICBjb25zdCBzdHJ1Y3R1cmVkID0gcGFyc2VDc3ZUb1N0cnVjdHVyZWQodGV4dCk7XHJcbiAgaWYgKCdlcnJvcicgaW4gc3RydWN0dXJlZCkge1xyXG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogc3RydWN0dXJlZC5lcnJvciB9O1xyXG4gIH1cclxuICBjb25zdCByb3dzID0gcm93c0Zyb21QYXJzZWRDc3ZXaXRoSW5kaWNlcyhzdHJ1Y3R1cmVkKTtcclxuICByZXR1cm4geyBvazogdHJ1ZSwgZGF0YTogeyBwYXJzZWQ6IHN0cnVjdHVyZWQsIHJvd3MgfSB9O1xyXG59XHJcblxyXG5jb25zdCBwcm9kdWN0c1Byb2ZpbGVFbnRpdHk6IENzdkVudGl0eVByb2ZpbGU8eyBwYXJzZWQ6IFBhcnNlZENzdjsgcm93czogUGFyc2VkUHJvZHVjdFJvd1dpdGhJbmRleFtdIH0+ID0ge1xyXG4gIGlkOiAncHJvZHVjdHMnLFxyXG4gIGRpc3BsYXlOYW1lOiAnUHJvZHVjdHMnLFxyXG4gIGNhbm9uaWNhbEhlYWRlcnM6IFsuLi5QUk9EVUNUX0NBTk9OSUNBTF9IRUFERVJTXSxcclxuICBidWlsZEJsYW5rVGVtcGxhdGU6IGJ1aWxkUHJvZHVjdHNCbGFua1RlbXBsYXRlLFxyXG4gIHBhcnNlRmlsZTogcGFyc2VQcm9kdWN0c0NzdkZpbGUsXHJcbiAgaXNJbXBsZW1lbnRlZDogdHJ1ZSxcclxufTtcclxuXHJcbmV4cG9ydCB7IHByb2R1Y3RzUHJvZmlsZUVudGl0eSBhcyBwcm9kdWN0c1Byb2ZpbGUgfTtcclxuIl0sIm1hcHBpbmdzIjoiQUFLQSxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQiw0QkFBNEI7QUFHaEUsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxvQkFBb0I7QUFJdEIsYUFBTSw0QkFBNEI7QUFBQSxFQUN2QztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjtBQUdPLGFBQU0sMEJBQThDLDBCQUEwQixJQUFJLENBQUMsU0FBUztBQUFBLEVBQ2pHO0FBQUEsRUFDQSxPQUFP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