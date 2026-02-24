# Add Product Page — Structure Analysis

This document analyses the **Add Product** flow (Simple + Variation only). It aligns with `EnhancedProductForm.tsx`, `ProductDrawer.tsx`, and the database schema. **Rental and Studio logic are out of scope.**

---

## 1. Entry point and DB tables

| Item | Detail |
|------|--------|
| **UI entry** | Products page → "Add Product" opens a drawer; `GlobalDrawer` / `ProductDrawer` render `EnhancedProductForm`. |
| **Tables used** | `products`, `product_variations`, `product_categories` (category + subcategory), `units`, `brands`, `stock_movements` (opening balance). |
| **Scoping** | `company_id` from `useSupabase()`; all inserts are company-scoped. Branch used only for opening-stock movement (`branch_id`). |

---

## 2. Required vs optional fields (form schema)

From `productSchema` (zod) and submit logic:

| Field | Required | Notes |
|-------|----------|--------|
| **name** | Yes | `z.string().min(1)` |
| **sku** | Yes (in schema) | Auto-generated if blank via `generateDocumentNumberSafe('production')`; user can override. |
| **sellingPrice** | Yes | `min(0.01)`; maps to `retail_price`. |
| **category** | No | Optional in schema; form allows empty. |
| **subCategory** | No | Optional; loaded when category selected; must belong to selected category. |
| **unit** | No | Optional in schema; default from Settings → Inventory → Default Unit or first unit. |
| **brand** | No | Optional. |
| **purchasePrice / cost_price** | No | Default 0. |
| **wholesalePrice** | No | Defaults to selling price. |
| **initialStock / opening_stock** | No | Default 0; when variations ON, parent stock = 0, stock per variation. |
| **track_stock (stockManagement)** | No | Default true. |
| **barcode, description, supplier** | No | Optional. |

**Mandatory for DB insert:** `company_id`, `name`, `sku` (unique per company). Other columns have defaults or are nullable.

---

## 2b. Quick reference — Simple vs Variation (for CSV import)

**SIMPLE PRODUCT (Has Variations = OFF)**

| Field | Required for entry | Optional |
|-------|--------------------|----------|
| **name** | Yes | — |
| **sku** | Auto if empty | Can provide manually |
| **selling_price** | Yes (min 0.01) | — |
| **category, subcategory** | No | Must exist if provided; subcategory must belong to category |
| **unit** | No | Must exist if provided |
| **brand** | No | Must exist if provided |
| **cost_price** | No | Default 0 |
| **opening_stock** | No | Default 0 |
| **track_stock, barcode, description, image_url** | No | Optional |

**VARIATION PRODUCT (Has Variations = ON)**

- **Parent product:** Same as above; parent holds **no stock** (opening_stock only on variation rows).
- **Per variation row:** **variation_name** required (e.g. "Size: S"); **variation_sku** optional (auto from parent SKU + name); cost_price, selling_price, opening_stock per row.
- **Rule:** Multiple CSV rows with the **same name** (and same sku or both empty) where **at least one row has variation_name** → import creates one product with variations. Rows **without** variation_name are ignored when the group has variations (only the first row’s product-level fields are used; do not put a “parent-only” row with opening_stock 0 — use the first variation row for product-level data).

---

## 3. Auto-generated fields

| Field | How |
|-------|-----|
| **id** | DB default `uuid_generate_v4()`. |
| **sku** | If empty: `generateDocumentNumberSafe('production')` (Settings → Numbering → Production: PREFIX + incremental). After create, `incrementNextNumber('production')`. |
| **created_at / updated_at** | DB defaults. |

---

## 4. Variation toggle logic

| Aspect | Behavior |
|--------|----------|
| **Toggle** | `enableVariations` state; default `false` for new product; from DB `has_variations` in edit. |
| **Parent product** | When variations ON: `has_variations: true`, `current_stock: 0` (parent does **not** hold stock). |
| **Opening stock** | Simple product: one opening-balance movement at product level. Variation product: opening balance **per variation** via `insertOpeningBalanceMovement(..., variationId)`. |
| **Variation rows** | Stored in `product_variations`: `product_id`, `name` (e.g. "Size: S"), `sku` (unique per product), `attributes` (e.g. `{"Size":"S"}`), `retail_price`, `cost_price`, `current_stock`. |
| **Variation SKU** | User or generated; must be unique per `product_id` (DB `UNIQUE(product_id, sku)`). |

---

## 5. Category and subcategory logic

| Aspect | Detail |
|--------|--------|
| **DB** | Single `category_id` on `products` → `product_categories(id)`. No separate `subcategory_id`. |
| **Categories** | Top-level: `product_categories` where `parent_id IS NULL`. |
| **Subcategories** | Rows where `parent_id = <category_id>`; loaded via `productCategoryService.getSubCategories(companyId, categoryId)`. |
| **Form** | User picks category; subcategories load for that category. On save: `categoryId = subCategory ?? category` (prefer subcategory if selected). So `products.category_id` = subcategory id if selected, else category id. |
| **Validation** | Subcategory must belong to selected category (same company, `parent_id = category.id`). |

---

## 6. Product image handling

| Aspect | Detail |
|--------|--------|
| **Form** | `images` (File[]) for new uploads; `existingImageUrls` for edit. |
| **Upload** | `uploadProductImages(companyId, productId, images)` → storage; returns URLs; saved to product via `updateProduct(id, { image_urls })`. |
| **Schema** | `image_url` (TEXT) or `gallery_urls` (JSONB) depending on schema; form uses `image_urls` array. |
| **Optional** | No image → no upload; product can have null/empty image. |

---

## 7. SKU and uniqueness

| Rule | Implementation |
|------|-----------------|
| **Auto** | Empty SKU → `generateDocumentNumberSafe('production')`; then `incrementNextNumber('production')` after create. |
| **Uniqueness** | DB `UNIQUE(company_id, sku)`; duplicate insert throws; form shows toast and refreshes SKU on duplicate. |
| **Variation SKU** | Per variation; `UNIQUE(product_id, sku)` in `product_variations`. |

---

## 8. Simple product (Has Variations = OFF)

- Insert **only** into `products`.
- Required for insert: `company_id`, `name`, `sku`.
- Optional but commonly set: `category_id` (or subcategory id), `unit_id`, `brand_id`, `cost_price`, `retail_price`, `wholesale_price`, `min_stock`, `max_stock`, `track_stock`, `current_stock` (or 0 + opening balance movement).
- Opening stock: if `initialStock > 0`, after insert call `insertOpeningBalanceMovement(companyId, branchId, productId, qty, unitCost)`.
- No rows in `product_variations`.

---

## 9. Variation product (Has Variations = ON)

- Insert **one** row in `products`: `has_variations: true`, `current_stock: 0` (parent never holds stock).
- Insert **multiple** rows in `product_variations`: each with `product_id`, `name`, `sku`, `attributes`, `retail_price`, `cost_price`, `current_stock` (0); then opening balance movement per variation with `variation_id`.
- Variation `name` is display (e.g. "Size: S"); `attributes` is structured (e.g. `{"Size":"S"}`).
- Each variation SKU must be unique within that product.

---

## 10. Branch / company scoping

- **Company:** All product and category data scoped by `company_id`.
- **Branch:** Used only for `stock_movements.branch_id` when recording opening balance; can be null.

---

## 11. Summary for CSV import alignment

- **Simple:** One row per product; `products` only; category_id (or subcategory id); unit_id; cost/retail; opening_stock via movement; SKU auto if blank.
- **Variation:** Multiple CSV rows same name + `variation_name`; one parent product (no stock) + `product_variations` rows; opening stock per variation.
- **Category/Subcategory:** Resolve category by name; if subcategory given, resolve by name and validate `parent_id = category.id`; set `products.category_id` to subcategory id or category id.
- **SKU:** Auto-generate when blank (PREFIX + incremental); reject duplicate.
- **Image:** Optional; store URL from CSV or leave empty; do not break import if missing.
- **No rental/studio** in import scope.

---

## 12. CSV import format (aligned with Add Product)

**SIMPLE PRODUCT** — one row, no `variation_name`:

| Column | Required | Description |
|--------|----------|-------------|
| name | Yes | Product name |
| category | No | Top-level category name (must exist) |
| subcategory | No | Subcategory name (must belong to category) |
| unit | No | Unit name or short_code |
| cost_price | No | Default 0 |
| selling_price | No | Default 0 |
| opening_stock | No | Default 0 |
| sku | No | Auto-generated if blank |
| track_stock | No | yes/no, default yes |
| image_url | No | Single URL (optional) |
| barcode, description, brand | No | Optional |

**VARIATION PRODUCT** — multiple rows, same name, with `variation_name`:

| Column | Same as simple, plus |
|--------|----------------------|
| variation_name | e.g. "Size: S", "Size: M" — required on variation rows |
| variation_sku | Optional; auto-derived from parent SKU + variation name if blank |
| variation_barcode | Optional |

**Rules:**

- If **variation_name** is empty → treat row as **simple product** (one product per row/group).
- If multiple rows share the same **name** and at least one has **variation_name** → treat as **variation product**: one parent (no stock) + one `product_variations` row per variation row; opening_stock per variation.
- Category must exist. If subcategory is provided, it must belong to the given category.
- SKU: blank → auto-generate (Settings → Numbering → Production). Duplicate SKU → row fails (logged, import continues).
- One row failure does not stop the import; errors are collected and available via error report download.
