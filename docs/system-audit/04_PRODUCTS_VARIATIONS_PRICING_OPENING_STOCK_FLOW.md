# 04 — Products, Variations, Pricing & Opening Stock Flow

_Stack: Next.js 14 + Supabase (multi-tenant). Last audited: 2026-04-12._

---

## Business Purpose

The product module is the catalog backbone of the ERP. Every sellable or purchasable item must exist here before it can appear on a sale, purchase order, or stock adjustment. The module handles:

- Simple products (no variants) and variable products (Size × Color, etc.)
- Three price tiers: retail, wholesale, and unit (purchase/cost)
- Opening stock entry for new or migrated products — creating the first `stock_movements` row and an optional GL journal entry
- SKU auto-generation via the `documentNumberService` numbering engine
- Soft-delete lifecycle (`is_active = false`)

---

## UI Entry Points

| Route / Drawer | Purpose |
|---|---|
| `view: products` | `ProductsPage` — list all active products, search, filter by category |
| `drawer: addProduct` | `ProductForm` (create mode) — fill name, SKU, category, prices, variations, opening stock |
| `drawer: edit-product` | `ProductForm` (edit mode) — same form pre-populated; restricted opening stock reconcile when history exists |
| `ImportProductsModal` | Bulk CSV import; calls `productService.createProduct` + `createVariation` per row |

---

## Frontend Files

| File | Role |
|---|---|
| `ProductsPage` | Parent page component; owns product list state, search query, category filter |
| `ProductForm` | Create/edit drawer form; handles both simple and variable product workflows; calls `productService.createProduct`, `updateProduct`, `createVariation`, `updateVariation`, and `inventoryService.reconcileParentLevelOpeningStock` / `reconcileVariationOpeningStock` |
| `ProductList` | Table/card rendering of product rows; links to edit drawer |
| `ProductDrawer` | Wrapper that conditionally renders `ProductForm` in create or edit mode |
| `ImportProductsModal` | CSV upload; maps columns to product fields; bulk calls service layer |

---

## Backend Services

| Service | Key Functions |
|---|---|
| `productService` (`productService.ts`) | `getAllProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `createVariation`, `updateVariation`, `searchProducts`, `getStockMovements`, `getStockForProducts`, `createStockMovement` |
| `inventoryService` (`inventoryService.ts`) | `insertOpeningBalanceMovement`, `reconcileParentLevelOpeningStock`, `reconcileVariationOpeningStock`, `getMovementCountForProduct`, `allowsParentOpeningReconcileFromProductForm`, `allowsVariationOpeningReconcileFromProductForm`, `syncOpeningJournalIfApplicable` |
| `openingBalanceJournalService` (`openingBalanceJournalService.ts`) | `syncInventoryOpeningFromStockMovementId` — posts Dr Inventory 1200 / Cr Owner Capital 3000 |
| `variationMasterService` (`variationMasterService.ts`) | `get`, `save` — stores reusable attribute name/value lists (e.g. `{ SIZE: ["S","M","L"] }`) in `company_settings` under key `variation_attributes_master` |
| `productCategoryService` (`productCategoryService.ts`) | `getAllCategoriesFlat`, `create`, `update`, `setActive` — two-level hierarchy (`parent_id IS NULL` = top-level) |
| `brandService` (`brandService.ts`) | `getAll`, `create`, `update`, `setActive` — flat brand list per company |
| `unitService` (`unitService.ts`) | `getAll`, `create`, `update`, `getDefaultUnit` — measurement units; "Piece" is protected default |
| `documentNumberService` | `getNextProductSKU(companyId, null)` — generates next SKU on duplicate conflict |

---

## DB Tables

| Table | Purpose |
|---|---|
| `products` | Master product record. Key columns: `id`, `company_id`, `category_id`, `brand_id`, `unit_id`, `name`, `sku`, `barcode`, `cost_price`, `retail_price`, `wholesale_price`, `has_variations`, `is_active`, `track_stock`, `product_type` (`normal`\|`production`), `source_type` (`studio`\|`manual`\|`purchase`\|`pos`), `min_stock`, `max_stock` |
| `product_variations` | One row per variant combination (e.g. Size=M, Color=Red). Key columns: `id`, `product_id`, `sku`, `barcode`, `attributes` (JSONB), `cost_price`, `retail_price`, `wholesale_price`, `current_stock` (legacy — not read for stock), `name`, `price` (minimal-schema alias for retail), `stock` (minimal-schema alias), `is_active` |
| `product_categories` | Two-level hierarchy; `parent_id IS NULL` = top-level category |
| `brands` | Flat brand list; `company_id`-scoped |
| `units` | Measurement units; `is_default = true` = Piece (protected) |
| `stock_movements` | Every opening stock entry creates one row with `movement_type = 'adjustment'` and `reference_type = 'opening_balance'` |
| `journal_entries` / `journal_entry_lines` | GL journal created by `openingBalanceJournalService`; `reference_type = 'opening_balance_inventory'`, `reference_id = stock_movement.id` |

**Important:** The `products` table does NOT have a reliable `current_stock` column for runtime use. All stock is derived from `SUM(stock_movements.quantity)`. The constant `PRODUCT_SELECT_SAFE` in `productService.ts` explicitly omits `current_stock` from every query.

---

## Product Create Flow (With / Without Variations)

### Simple Product (no variations)

1. User fills `ProductForm`: name, SKU (or auto-generated), category, brand, unit, prices, `track_stock`, optional opening qty + unit cost.
2. `productService.createProduct` is called:
   - Strips `current_stock` from payload before insert.
   - Calls `ensureProductIds` to default `unit_id`, `category_id`, `brand_id` to `null` if absent.
   - Inserts into `products`; on duplicate-SKU error (`23505`), calls `documentNumberService.getNextProductSKU` and retries once.
3. If opening stock qty > 0:
   - `inventoryService.insertOpeningBalanceMovement(companyId, branchId, productId, qty, unitCost)` inserts a `stock_movements` row:
     - `movement_type = 'adjustment'`
     - `reference_type = 'opening_balance'`
     - `reference_id = null`
     - `notes = 'Opening stock'`
   - After insert, `openingBalanceJournalService.syncInventoryOpeningFromStockMovementId(movementId)` is called to create the GL entry.

### Variable Product (has_variations = true)

1. Product header is created first (same as above, `has_variations = true`).
2. For each variation row in the form, `productService.createVariation` is called:
   - Attempts full schema insert: `{ product_id, name, sku, barcode, attributes, cost_price, retail_price, wholesale_price, current_stock, is_active }`.
   - On column-not-found error (`42703` / PGRST), falls back to minimal schema: `{ product_id, name, sku, barcode, attributes, price, stock, is_active }`, embedding purchase price in `attributes.__erp_purchase_price`.
3. If variation has opening qty > 0:
   - `inventoryService.insertOpeningBalanceMovement(companyId, branchId, productId, qty, unitCost, variationId)` — same as above but with `variation_id` set.
   - GL entry is created per variation movement.

---

## Variation Create / Edit Flow

**Create:** `productService.createVariation(params)` — supports dual schema (full ERP or minimal). Variation attributes are stored as a JSONB object in `product_variations.attributes` (e.g. `{ "SIZE": "M", "COLOR": "Red" }`). Internal ERP metadata keys are prefixed `__erp` (e.g. `__erp_purchase_price`) to separate them from display attributes.

**Edit:** `productService.updateVariation(variationId, params)` — updates `sku`, `barcode`, `attributes`, `name`, `cost_price`, `retail_price`, `wholesale_price`. Does NOT touch stock columns (`current_stock`, `stock`) — stock is always movement-based.

**Attribute Master:** `variationMasterService.get/save` stores a company-wide reusable attribute dictionary in `company_settings` under key `variation_attributes_master`. Shape saved: `{ attributes: { SIZE: ["S","M","L"], COLOR: ["Red","Blue"] }, updated_at: "..." }`. The `normalize()` function handles legacy flat-key shapes.

**Variation Name Display:** `formatVariationName(attributes)` produces a human-readable string (e.g. `"SIZE: M, COLOR: Red"`) by calling `publicVariationAttributes()` to strip `__erp` internal keys before display.

---

## Pricing Fields

| Field | DB Column | Applies To | Description |
|---|---|---|---|
| `retail_price` | `products.retail_price` / `product_variations.retail_price` (or `price` in minimal schema) | Selling to end customers (retail) | Primary selling price; used in POS sales and inventory valuation display |
| `wholesale_price` | `products.wholesale_price` / `product_variations.wholesale_price` | Bulk / wholesale customers | Lower price tier; shown on wholesale invoices |
| `unit_price` / `cost_price` | `products.cost_price` / `product_variations.cost_price` (or `__erp_purchase_price` in attributes in minimal schema) | Purchase / landed cost reference | Used for gross-margin calculations and inventory valuation at cost; NOT the value stored in `stock_movements.total_cost` for sales (see Stock Valuation section in doc 05) |

**Caution on `total_cost` in sales movements:** The system uses the **retail inventory method** for `stock_movements`. For a `movement_type = 'sale'`, `total_cost` is written as **negative selling price** (not purchase cost). The `cost_price` / `unit_price` fields on the product/variation record are reference data only and are not automatically pushed into movement rows during POS sales.

---

## Opening Stock Flow

When a user enters opening qty (and optionally unit cost) on a product form for a new product:

1. **Guard check:** `inventoryService.allowsParentOpeningReconcileFromProductForm` (or `allowsVariationOpeningReconcileFromProductForm` for variations) queries `stock_movements` for existing rows. Returns `true` only if:
   - Zero existing movements (fresh product), OR
   - Exactly one movement and that movement has `reference_type = 'opening_balance'`.
   If false, the form blocks the opening stock edit (history already exists beyond the opening row).

2. **Insert or update movement:**
   - If no opening row exists and qty > 0: calls `inventoryService.insertOpeningBalanceMovement` → inserts `stock_movements` row:
     ```
     movement_type  = 'adjustment'
     reference_type = 'opening_balance'
     reference_id   = null
     quantity       = <user-entered qty>
     unit_cost      = <user-entered cost>
     total_cost     = quantity × unit_cost
     notes          = 'Opening stock' | 'Opening stock (variation)'
     ```
   - If exactly one opening row exists: calls `reconcileParentLevelOpeningStock` / `reconcileVariationOpeningStock` → updates `quantity`, `unit_cost`, `total_cost` on the existing row in place.

3. **GL journal sync:** After insert or update, `openingBalanceJournalService.syncInventoryOpeningFromStockMovementId(movementId)` is called:
   - Validates `reference_type = 'opening_balance'` and `movement_type = 'adjustment'` on the movement.
   - Voids any legacy misclassified `stock_adjustment` JEs for the same movement ID.
   - Resolves inventory asset account (code `1200`; fallback: any account with `type = 'inventory'`).
   - Resolves equity account (code `3000`; fallback: any equity account matching `/capital|owner|opening/i`).
   - Posts a balanced journal entry:
     - **Dr** Account 1200 (Inventory Asset) for `total_cost`
     - **Cr** Account 3000 (Owner Capital / Opening Balance Equity) for `total_cost`
   - Idempotent: uses `reconcileOrVoidOpeningJe` — if an active JE already exists with matching net on the inventory account, it is kept unchanged; if the amount changed, the old JE is voided and a new one is posted.
   - Entry no format: `INV-OB-{first 12 chars of movement UUID stripped of hyphens}`.
   - `reference_type` on `journal_entries` = `'opening_balance_inventory'`.

4. **Browser event:** After any `createStockMovement` call succeeds, `window.dispatchEvent(new CustomEvent('inventory-updated'))` is fired to trigger UI refresh.

---

## Product Edit Flow

1. `productService.getProduct(id)` loads product with joined `product_variations` using layered SELECT fallback (tries richest schema first, degrades gracefully on `42703`).
2. `productService.updateProduct(id, updates)` strips `current_stock` before sending to DB (column may not exist).
3. Variation edits call `updateVariation` — no stock columns are written.
4. Opening stock reconcile on edit: allowed only if `allowsParentOpeningReconcileFromProductForm` / `allowsVariationOpeningReconcileFromProductForm` returns `true` (zero or one opening movement only). If trade history exists, the opening stock field is read-only on the form.

---

## Product Delete / Deactivate

`productService.deleteProduct(id)` performs a **soft delete**: sets `is_active = false` on the `products` row. No cascade to `product_variations` or `stock_movements`. Products with `is_active = false` are excluded from all `getAllProducts` and `searchProducts` queries via `.eq('is_active', true)`.

There is no hard-delete path in the service layer. Variations are not automatically deactivated when the parent product is soft-deleted.

---

## Stock Effect (Opening Stock → stock_movements Row)

```
stock_movements row created by insertOpeningBalanceMovement:
  company_id     = <company>
  branch_id      = <branch or null>
  product_id     = <product>
  variation_id   = <variation or null>
  movement_type  = 'adjustment'
  reference_type = 'opening_balance'
  reference_id   = null
  quantity       = <opening qty>          -- positive integer
  unit_cost      = <cost per unit>
  total_cost     = quantity × unit_cost
  notes          = 'Opening stock' | 'Opening stock (variation)'
```

This row is the single source of truth for opening qty. `getInventoryOverview` sums ALL `stock_movements.quantity` rows, so the opening row is included in the running balance automatically.

---

## Accounting Effect (Opening Stock Journal Entry)

```
Journal Entry (journal_entries):
  reference_type = 'opening_balance_inventory'
  reference_id   = stock_movements.id
  entry_no       = 'INV-OB-{movementId prefix}'
  entry_date     = movement created_at date

Journal Entry Lines (journal_entry_lines):
  Dr  Account 1200  (Inventory Asset)         total_cost
  Cr  Account 3000  (Owner Capital / Equity)  total_cost
```

The entry is idempotent per `reference_id`. If `total_cost = 0` or less than `MONEY_EPS` (0.02), any existing JE is voided and no new one is posted. If `unit_cost` is not provided, `total_cost` defaults to 0 and no GL entry is created (stock movement still exists).

---

## Source of Truth for Stock Qty

The `inventory_balance` table stores a running cached balance per `(company_id, branch_id, product_id, variation_id)`. However, `inventoryService.getInventoryOverview` does **not** use `inventory_balance` — it queries `stock_movements` directly and sums `quantity` in application code. The `getStock` function likewise queries `stock_movements` directly:

```typescript
// inventoryService.getStock — direct SUM from stock_movements
SUM(quantity) FROM stock_movements
  WHERE company_id = X AND product_id = Y
  [AND variation_id = Z | AND variation_id IS NULL]
  [AND branch_id = B]
```

**Rule (from service header comments):**
1. Stock = movement-based only (`stock_movements`); `products.current_stock` and `product_variations.current_stock`/`stock` columns are never read for stock levels.
2. Parent product stock (when `has_variations = true`) = SUM of all variation stocks + any orphan parent-level movements (`variation_id IS NULL`).
3. Variation stock is shown as-is; negative stock is allowed (no clamping).

---

## Known Failure Points

1. **Schema mismatch / dual schema proliferation:** `product_variations` has two supported schemas (full ERP columns vs. minimal `price`/`stock` only). The fallback chain in `createVariation` and `VARIATION_SELECT_LAYERS` masks which schema is actually deployed; a mismatch causes silent purchase-price data loss (embedded in `attributes.__erp_purchase_price`).

2. **`is_active` filter missing on some fallback paths:** In `getAllProducts`, one fallback branch omits `.eq('is_active', true)` (the `company_id` missing column path), which could return deactivated products.

3. **Orphan variations on soft delete:** `deleteProduct` only flags `products.is_active = false`; `product_variations` rows remain active. Queries that join variations without checking parent product status may expose orphaned rows.

4. **Opening stock edit blocked silently:** If `allowsParentOpeningReconcileFromProductForm` returns `false` (> 1 movement), the form silently skips the opening stock update with no user-facing error. The user may believe the opening stock was saved.

5. **Multiple opening rows not cleaned up:** `reconcileParentLevelOpeningStock` logs a warning and returns no-op if `openings.length > 1`. Duplicate `reference_type = 'opening_balance'` rows cause permanently incorrect stock counts.

6. **GL sync failure is non-fatal:** `insertOpeningBalanceMovement` catches GL sync errors with `console.warn` and returns `{ error: null }`. Stock movement exists but no journal entry — AR/Inventory balance is wrong with no alert to the user.

7. **`documentNumberService.getNextProductSKU` on retry:** SKU auto-retry only fires on `isSkuConflict` (checks for `sku|SKU` in the error message). If the duplicate is on a non-SKU unique index, the retry loop still runs but generates a new SKU unnecessarily.

---

## Recommended Standard

1. **Enforce single schema for `product_variations`:** Run a migration to standardise all tenants on the full ERP schema (`cost_price`, `retail_price`, `wholesale_price`, `current_stock`, `name`). Remove the dual-schema fallback chains from `createVariation`, `updateVariation`, and all SELECT layers once confirmed deployed everywhere.

2. **Cascade soft-delete to variations:** When `deleteProduct` is called, also set `product_variations.is_active = false` for all child rows.

3. **Surface opening stock errors to the user:** Change the GL sync failure in `insertOpeningBalanceMovement` from a silent `console.warn` to a UI-visible warning/toast so operators know to reconcile manually.

4. **Deduplicate opening balance rows:** Add a DB-level unique constraint on `stock_movements (company_id, product_id, variation_id, branch_id, reference_type)` filtered to `movement_type = 'adjustment' AND reference_type = 'opening_balance'` to prevent multiple opening rows from being created.

5. **Use `inventory_balance` for cached reads:** For high-frequency stock checks (e.g. POS availability), read from the `inventory_balance` table and update it transactionally. Reserve direct `stock_movements` SUM queries for the inventory overview/analytics screens where correctness is critical and latency is acceptable.
