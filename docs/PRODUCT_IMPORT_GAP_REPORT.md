# Product Import — Gap Report (Current vs Required)

Based on `PRODUCT_IMPORT_DB_ANALYSIS.md` and current `ImportProductsModal.tsx` + `productService` behaviour.

---

## Current CSV import — what it does

| Aspect | Status | Details |
|--------|--------|---------|
| **Required columns** | name (required), sku (optional — auto `PRD-IMP-{ts}-{i}` if empty) | category, unit, brand optional; matched by name to existing masters |
| **Variations** | Supported | Same name+sku + `variation_name` (and optional variation_sku, variation_barcode); creates product with has_variations and product_variations rows |
| **Combo** | Not supported | No combo_name, component_product, component_qty; no product_combos / product_combo_items creation |
| **Rental** | Partially supported | CSV has is_rentable (yes/no); no rental_price_*, rental_security, rental_duration_type columns |
| **SKU** | Manual or auto | If empty → `PRD-IMP-${Date.now()}-${i}`. No configurable prefix; no use of documentNumberService for SKU. Duplicate SKU → DB unique constraint error (company_id, sku). |
| **Duplicate SKUs** | Blocked by DB | UNIQUE(company_id, sku); error message shown on insert failure |
| **Stock quantities** | Supported | opening_stock → insertOpeningBalanceMovement (product or variation); branch = current context branchId |
| **Branch-specific prices** | Not supported | No branch-level or warehouse-level price columns; only product/variation retail/cost/wholesale |
| **Validation before insert** | Partial | Category/unit/brand resolved by name; no upfront “exists” check; no warehouse/branch validation for opening_stock |
| **Transaction / rollback** | No | Each product/variation inserted one-by-one; one failure does not roll back previous inserts |
| **Preview** | Yes | First 10 rows in table (name, sku, variation, cost, price, stock) |
| **Per-row errors** | No | Single importError string; no row index or “row X failed” |
| **Summary (created/skipped/failed)** | Partial | Only “Imported X product(s)”; no skipped/failed counts |
| **Error report CSV** | No | No download of failed rows or error report |

---

## Gaps to address

### 1. Validation (pre-insert)

- Validate category (by name) exists for company; else skip or fail row with reason.
- Validate unit (by name/short_code) exists; else skip or fail.
- Validate brand (by name) if provided; else skip or fail.
- Validate branch/warehouse for opening_stock: branch_id from context must exist (or allow null for “no location” if schema allows).
- Optional: enforce “no duplicate product name” only if product name uniqueness is a business rule (currently not in DB).

### 2. SKU logic

- **Auto SKU:** If “SKU auto” is enabled (or CSV SKU empty and config says auto): generate SKU as `PREFIX + incremental` (e.g. PRD-00001), ensure uniqueness per company (e.g. use documentNumberService or max existing + 1). Do not allow manual override in CSV when auto is ON, or document that “manual SKU in CSV is ignored when auto is ON”.
- **Manual SKU:** If provided in CSV and auto is OFF: use as-is; duplicate SKU will still be rejected by DB.

### 3. Transaction safety

- Wrap full import (all products + variations + opening stock for one file) in a logical transaction: on any row failure, roll back all inserts for that import (Supabase/PostgREST does not support multi-statement transaction from client; options: single RPC that does everything, or “dry run” then insert with rollback-on-first-error and track created IDs to delete on failure).
- Document current limitation if full rollback is not implemented (e.g. “best-effort rollback” or “manual cleanup required”).

### 4. Combo support

- CSV structure for combo: e.g. combo_name, component_product (name or SKU), component_qty; or separate sheet/section.
- Import logic: create product with is_combo_product = true; create product_combos row; create product_combo_items (resolve component by product name/SKU, validate exists, prevent circular reference).
- Not implemented in current import.

### 5. Rental support

- CSV: is_rental (true/false), rental_price_daily (or weekly/monthly), optional rental_security, rental_duration_type if such columns exist in DB (currently only rental_price_* on products).
- Validate rental fields before insert; set is_rentable and rental_price_* on product.
- Partially present (is_rentable); rental price columns can be added to CSV and mapping.

### 6. Warehouse / branch

- No warehouses table; “warehouse” in CSV can map to branch_id for opening_stock (branch = location).
- Validate branch exists (by code or name) when opening_stock or warehouse column is used.

### 7. UI improvements

- Preview: show all parsed rows (or paginated), with validation errors per row before user clicks Import.
- Per-row errors: list “Row N: error message” (e.g. “Category not found”, “Duplicate SKU”).
- Summary: Created count, Skipped count (with reason), Failed count.
- Error report: download CSV of failed rows + error column (and optionally skipped rows with reason).

---

## Compatibility

- **Sales / Purchase:** Use product_id, variation_id, unit from product/unit_id; current import sets product and variation correctly; no change needed for sales/purchase.
- **Rental:** Uses product_id (and optional variation) and is_rentable; rental_price_* on product used for rates; adding rental columns to CSV keeps compatibility.
- **Combo:** Combo import would create product_combos + product_combo_items; sales/combo logic already uses these; no breaking change.
- **Stock:** Opening balance via stock_movements with branch_id and optional variation_id; compatible with existing inventory and stock_movements usage.

---

## Recommended order of work

1. **Validation:** Category, unit, brand, branch existence before insert; per-row validation and collect errors.
2. **SKU auto:** Optional config (e.g. env or UI) for “auto-generate SKU”; prefix + next number; use when CSV SKU empty (or when “ignore CSV SKU” is on).
3. **Transaction / rollback:** Design approach (RPC vs client-side rollback) and implement so one failed row does not leave partial data.
4. **UI:** Preview with per-row errors; summary (created/skipped/failed); download error report CSV.
5. **Rental:** Add rental_price_* (and optional security/duration) to CSV and import.
6. **Combo:** Define CSV format for combos; implement combo + combo_items creation and validation (no circular ref, components exist).
