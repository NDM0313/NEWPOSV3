# Product Import — Revised CSV Format

This document defines the supported CSV structure for product import. It aligns with the database schema and the gap report.

---

## 1. Simple product

| Column | Required | Description |
|--------|----------|-------------|
| name (product_name) | Yes | Product name |
| category | No | Must match a category name from Settings → Inventory (Product Categories) |
| brand | No | Must match a brand name from Settings → Inventory (Brands) |
| unit | No | Must match unit name or short_code from Settings → Inventory (Units) |
| cost_price | No | Default 0 |
| selling_price (retail price) | No | Default 0 |
| wholesale_price | No | Optional |
| opening_stock | No | Default 0; applied at current branch when > 0 |
| warehouse / branch | No | Opening stock is applied at the **current branch** in the app context (no separate warehouses table) |
| is_rental (is_rentable) | No | true/false or yes/no; default false |
| is_combo | No | true/false or yes/no; default false (combo definition via separate flow or future combo CSV) |
| sku | No | If empty and “SKU auto” is ON → auto-generated (PREFIX + incremental). If provided and auto is OFF → used as-is. Duplicate SKU per company is rejected. |
| barcode | No | Optional |
| description | No | Optional |
| min_stock, max_stock, track_stock, is_sellable | No | Optional; see existing template |

**Rental-specific (when is_rental = true):**

| Column | Required | Description |
|--------|----------|-------------|
| rental_price_daily | No | Decimal; stored on product |
| rental_price_weekly | No | Decimal |
| rental_price_monthly | No | Decimal |

Validation: If `is_rental` is true, at least one of the rental price columns can be set (recommended). No separate `rental_security` or `rental_duration_type` columns in products table.

---

## 2. Variation product (grouped rows)

Same product is represented by **multiple rows** with the same `name` and `sku` (or same name and auto SKU), and at least one row must have a variation identifier.

**Option A (current):** Use `variation_name` (e.g. "Size: S", "Size: M").

**Option B (alternate):** Use separate columns:

| Column | Description |
|--------|-------------|
| parent_name | Same as name – product name |
| variation_type | e.g. "Size", "Color" |
| variation_value | e.g. "Small", "Medium", "Red" |
| sale_price, cost_price, opening_stock | Per variation |

**Example (Option A – variation_name):**

```csv
name,sku,category,unit,cost_price,selling_price,opening_stock,variation_name,variation_sku
Shirt,SH-001,Apparel,Piece,1500,2500,10,Size: Small,SH-001-S
Shirt,SH-001,Apparel,Piece,1500,2500,15,Size: Medium,SH-001-M
Shirt,SH-001,Apparel,Piece,1500,2500,12,Size: Large,SH-001-L
```

**Example (Option B – variation_type + variation_value):**

```csv
parent_name,variation_type,variation_value,cost_price,sale_price,opening_stock
Shirt,Size,Small,1500,2500,10
Shirt,Size,Medium,1500,2500,15
Shirt,Size,Large,1500,2500,12
```

Import logic:

1. Create parent product (once) with `has_variations: true`.
2. For each variation row: create `product_variations` row with unique SKU (e.g. parent SKU + "-" + variation_value), link to parent.
3. Apply opening_stock per variation via `stock_movements` with `variation_id`.

---

## 3. Combo product

Combos are defined as: one **virtual product** (the combo) and N **component** products with quantities.

**CSV format (future / optional):**

| Column | Description |
|--------|-------------|
| combo_name | Name of the bundle product |
| component_product | Product name or SKU (must exist in the company) |
| component_qty | Quantity per component (decimal) |

Multiple rows with the same `combo_name` define multiple components. Example:

```csv
combo_name,component_product,component_qty
Bundle A,Product X,2
Bundle A,Product Y,1
```

Import logic (when implemented):

1. Validate all component products exist (by name or SKU).
2. Prevent circular reference (combo cannot contain itself or another combo that contains it).
3. Create product with `is_combo_product: true` and optional SKU.
4. Create `product_combos` row (combo_product_id = new product id).
5. Create `product_combo_items` for each component (product_id, qty).

**Current status:** Combo import is **not** implemented in the import modal; combos are created via the product/combo UI. This format is documented for a future phase.

---

## 4. SKU behaviour

- **Auto SKU (when enabled or when CSV SKU is empty and app uses auto):**  
  Generate SKU = `PREFIX + incremental number` (e.g. PRD-0001). Prefix and next number come from Settings → Numbering Rules → Production. Uniqueness is ensured (e.g. via document number service). When auto is ON, SKU from CSV can be **ignored** for new products.
- **Manual SKU:** If provided in CSV and auto is OFF, use as-is. Duplicate SKU within the same company is rejected by the database (unique constraint).

---

## 5. Data integrity (validation before insert)

- **Category:** If provided, must exist in `product_categories` for the company (match by name).
- **Unit:** If provided, must exist in `units` for the company (match by name or short_code).
- **Brand:** If provided, must exist in `brands` for the company (match by name).
- **Branch:** Opening stock is posted to the **current branch**; that branch must exist when branch_id is set.
- **Duplicate product name:** Not enforced at DB level; optional business rule (e.g. warn or skip).
- **Transaction:** Import should run in a logical transaction: on any row failure, roll back all inserts for that import (see implementation notes for Supabase client limitations).

---

## 6. Template and encoding

- Encoding: UTF-8.
- First row: header (column names). Column names are case-insensitive; spaces can be replaced with underscores (e.g. `cost price` or `cost_price`).
- Download the in-app CSV template for the exact column set supported by the current import (simple + variations + optional rental columns).
