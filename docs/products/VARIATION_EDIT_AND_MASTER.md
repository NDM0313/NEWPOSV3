# Product variations — edit hydration, pricing, master, decimals

## Root cause (edit showed zeros)

1. **`productService` embed select was too narrow** — `VARIATION_SELECT_SAFE` only requested `id, product_id, sku, attributes`. Saved **retail_price / cost_price / barcode / stock (or price/stock)** never reached the client.
2. **Hydration mapped wrong fields** — the form read `v.price` and `v.stock`, while many databases use **`retail_price` + `current_stock`** (or **`price` + `stock`** on the minimal migration).
3. **Edit save never updated variations** — only the product row was updated; variation rows were unchanged on save (and the UI looked “wiped” after reload because of (1)+(2)).

## Fixes (summary)

- **Layered `VARIATION_SELECT_LAYERS`** in `productService.ts`: try the richest `product_variations` column set, fall back on missing-column errors.
- **`mapProductVariationApiToFormRow`** normalizes API rows to form shape (selling + purchase + barcode + stock column fallback).
- **Movement-based stock on edit** — after mapping, per-variation qty is loaded with `inventoryService.getStock(companyId, productId, variationId, branch)` so the grid matches ledger truth.
- **`productService.updateVariation`** + **`inventoryService.reconcileVariationOpeningStock`** — persist SKU, attributes, purchase/selling prices, barcode; reconcile variation opening only when safe (same rules as parent opening).
- **Create path** uses **`productService.createVariation`** per row (schema-tolerant) + opening movements.
- **`generateVariations` merge** — regenerating combinations preserves existing row `id`, SKU, prices, stock, barcode when the attribute tuple matches.
- **Purchase price column** on each row; labels **Purchase price** / **Selling price**.
- **Decimal qty** when selected unit has `allow_decimal` (variation opening stock + parse).
- **Settings → Inventory → Variations** — `variation_attributes_master` in `settings` table (JSON); UI to manage attribute names and values; product form can pick from master and quick-add to master.

## Files touched

- `src/app/utils/variationFieldMap.ts` (variation pricing + attribute parsing / minimal-schema embed)
- `src/app/services/productService.ts`
- `src/app/services/inventoryService.ts`
- `src/app/services/variationMasterService.ts` (new)
- `src/app/components/products/EnhancedProductForm.tsx`
- `src/app/components/inventory/InventoryDashboardNew.tsx`
- `src/app/components/inventory/InventoryDesignTestPage.tsx`
- `src/app/components/settings/inventory/InventoryMasters.tsx`
- `src/app/components/settings/inventory/VariationAttributesMaster.tsx` (new)
- `src/app/components/settings/SettingsPageNew.tsx`

## Decimal inheritance rule

`unit.allow_decimal === true` → variation opening stock inputs use `step="any"` and `parseFloat`; otherwise `step={1}` and integer parse.

## Root cause — “only SUPPLIER” in product variation picker (master)

1. **`variationMasterService.normalize()` dropped non-array attribute values** — only `Array.isArray(val)` was accepted under `attributes`. If `COLOR` / `SIZE` were stored as a single string, object, or other JSON shape, those keys were omitted while `SUPPLIER` (often a proper string array) remained.
2. **Legacy / mixed JSON shape** — some rows may store attribute maps at the **root** of `settings.value` instead of only under `value.attributes`. The normalizer ignored root-level keys except via `attributes`, so part of the master disappeared in the client.
3. **Product form loaded master only when `enableVariations` was true** — the datalist stayed empty until the toggle fired; users could mistake the **Details** supplier `<Select>` for the variation master and report “only supplier.”

**Fix:** `normalize()` coerces values to string lists (array / string / `{ values: [] }`), merges **both** `value.attributes` and **non-reserved root keys**, and optionally parses a stringified JSON `value`. The product form loads the master whenever `companyId` is set.

## Root cause — thin inventory variation sub-rows

`getInventoryOverview` selected **`product_variations` as `id, product_id, sku` only**, so **`attributes` and pricing columns never loaded**. The UI could not show Color/Size text from JSONB, and **stock value used parent `sellingPrice`** instead of cost × qty per variation.

**Fix:** Layered select (same idea as `VARIATION_SELECT_LAYERS`) to fetch `attributes`, `cost_price`, `retail_price`, etc. when present; map **`purchasePrice`**, **`sellingPrice`**, **`stockValueAtCost`**, **`retailStockValue`** for child rows. Dashboard sub-rows render SKU, summary, both prices, cost-based stock value, and a small retail-value line.

## Authoritative field map (UI → service → DB)

Shared helpers: `src/app/utils/variationFieldMap.ts` (`variationPurchaseFromApiRow`, `variationRetailFromApiRow`, `parseVariationAttributesRaw`, `publicVariationAttributes`, minimal-schema embed).

| UI / form row | `productService` / payload | `product_variations` (ERP) | `product_variations` (minimal: `03_frontend_driven_schema`) |
|---------------|----------------------------|----------------------------|------------------------------------------------------------|
| `combination` (Color, Size, …) | `attributes` | `attributes` JSONB | `attributes` JSONB |
| `purchasePrice` | `cost_price` (+ embed see below) | `cost_price` | **`attributes.__erp_purchase_price`** (string) when no cost column |
| `price` (selling) | `retail_price`, `price` on fallback update | `retail_price` | **`price`** |
| `sku` | `sku` | `sku` | `sku` |
| `barcode` | `barcode` | `barcode` | `barcode` |
| `id` | row id | `id` | `id` |
| `name` (generated) | `name` | `name` (if column exists) | from insert payload when required |
| Opening / on-hand qty | movements + optional `current_stock` on create | movements; optional `current_stock` legacy | `stock` column on create only; live qty from **stock_movements** |

**Stock:** Ledger truth remains `stock_movements`; form “opening stock” is reconciled via `reconcileVariationOpeningStock` / opening movements, not silent DB column wipes.

## Root cause — purchase price 0 on edit + inventory looked “parent priced”

1. **Minimal `product_variations` schema** has only **`price`** (used as selling). **`updateVariation` fallback** updated `price` with **retail** but **never persisted purchase** — `cost_price` column missing, and **`price` was previously set to `retail ?? cost`**, clobbering the single column with the wrong semantic.
2. **`mapProductVariationApiToFormRow`** only read `cost_price` for purchase; **embedded purchase in JSON** was ignored → **0** after reload.
3. **Inventory overview** used `numOrNaN(cost_price)` only; with no column, **purchase fell back to parent `avgCost`**, so every child row looked parent-priced.
4. **Attributes as JSON string** from PostgREST in some paths → `typeof attributes === 'object'` failed → **empty `combination`** and broken attribute grid restore.

**Fix:** Embed purchase in **`attributes.__erp_purchase_price`** on **minimal-schema** create/update fallbacks; read purchase with **`variationPurchaseFromApiRow`** (columns + embed); parse attributes via **`parseVariationAttributesRaw`**; strip internal keys with **`publicVariationAttributes`** for UI and inventory labels; add optional **`purchase_price`** column to select layers when present.
