# Product Import — Database Structure Analysis

This document analyses the database schema relevant to product CSV import. Source: `supabase-extract/CLEAN_COMPLETE_SCHEMA.sql`, migrations (units, brands, combos, rental, stock_movements).

---

## 1. `products`

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | uuid_generate_v4() | Auto-generated |
| company_id | UUID | Yes | No | — | FK → companies(id) ON DELETE CASCADE |
| category_id | UUID | No | Yes | — | FK → product_categories(id) ON DELETE SET NULL |
| name | VARCHAR(255) | Yes | No | — | |
| sku | VARCHAR(100) | Yes | No | — | **UNIQUE(company_id, sku)** — duplicate SKU per company blocked |
| barcode | VARCHAR(100) | No | Yes | — | Not auto-generated |
| description | TEXT | No | Yes | — | |
| unit | VARCHAR(50) | No | Yes | 'piece' | Legacy; app uses unit_id |
| unit_id | UUID | No | Yes | — | **From migration** — FK → units(id) ON DELETE SET NULL |
| cost_price | DECIMAL(15,2) | No | Yes | 0 | |
| retail_price | DECIMAL(15,2) | No | Yes | 0 | |
| wholesale_price | DECIMAL(15,2) | No | Yes | 0 | |
| rental_price_daily | DECIMAL(15,2) | No | Yes | 0 | |
| rental_price_weekly | DECIMAL(15,2) | No | Yes | 0 | |
| rental_price_monthly | DECIMAL(15,2) | No | Yes | 0 | |
| current_stock | DECIMAL(15,2) | No | Yes | 0 | App may derive from stock_movements |
| min_stock | DECIMAL(15,2) | No | Yes | 0 | |
| max_stock | DECIMAL(15,2) | No | Yes | 0 | |
| reorder_point | DECIMAL(15,2) | No | Yes | 0 | |
| has_variations | BOOLEAN | No | Yes | false | |
| image_url | TEXT | No | Yes | — | |
| gallery_urls | JSONB | No | Yes | '[]' | |
| is_rentable | BOOLEAN | No | Yes | false | |
| is_sellable | BOOLEAN | No | Yes | true | |
| is_purchasable | BOOLEAN | No | Yes | true | |
| track_stock | BOOLEAN | No | Yes | true | |
| is_active | BOOLEAN | No | Yes | true | |
| is_combo_product | BOOLEAN | No | Yes | false | **From migration** — true if product is a combo |
| created_by | UUID | No | Yes | — | FK → users(id) |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |
| updated_at | TIMESTAMPTZ | No | Yes | NOW() | |
| brand_id | UUID | No | Yes | — | **From migration** — FK → brands(id) ON DELETE SET NULL |

**Unique constraints:** `(company_id, sku)`  
**Auto-generated:** `id`, `created_at`, `updated_at`. SKU is **not** auto-generated at DB level; app can generate it.

---

## 2. `product_variations`

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | uuid_generate_v4() | Auto-generated |
| product_id | UUID | Yes | No | — | FK → products(id) ON DELETE CASCADE |
| name | VARCHAR(255) | Yes | No | — | e.g. "Size: Large, Color: Red" |
| sku | VARCHAR(100) | Yes | No | — | **UNIQUE(product_id, sku)** — per-product unique |
| barcode | VARCHAR(100) | No | Yes | — | |
| attributes | JSONB | Yes | No | — | e.g. {"size": "Large", "color": "Red"} |
| cost_price | DECIMAL(15,2) | No | Yes | — | Override parent |
| retail_price | DECIMAL(15,2) | No | Yes | — | |
| wholesale_price | DECIMAL(15,2) | No | Yes | — | |
| current_stock | DECIMAL(15,2) | No | Yes | 0 | |
| image_url | TEXT | No | Yes | — | |
| is_active | BOOLEAN | No | Yes | true | |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |
| updated_at | TIMESTAMPTZ | No | Yes | NOW() | |

**Unique constraints:** `(product_id, sku)`  
**Auto-generated:** `id`, `created_at`, `updated_at`. Variation SKU is not auto-generated at DB level.

---

## 3. `product_combos` (combo definition)

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | uuid_generate_v4() | |
| company_id | UUID | Yes | No | — | FK → companies(id) |
| combo_product_id | UUID | Yes | No | — | FK → products(id) — the virtual “bundle” product |
| combo_name | TEXT | Yes | No | — | |
| combo_price | DECIMAL(15,2) | No | Yes | 0 | |
| is_active | BOOLEAN | No | Yes | true | |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |
| updated_at | TIMESTAMPTZ | No | Yes | NOW() | |

**Note:** Combo product is a normal product with `is_combo_product = true`; it does not hold stock. Stock is deducted from components.

---

## 4. `product_combo_items` (combo components)

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | uuid_generate_v4() | |
| company_id | UUID | Yes | No | — | FK → companies(id) |
| combo_id | UUID | Yes | No | — | FK → product_combos(id) |
| product_id | UUID | Yes | No | — | FK → products(id) |
| variation_id | UUID | No | Yes | — | FK → product_variations(id) |
| qty | DECIMAL(15,2) | No | Yes | 1 | Must be > 0 |
| unit_price | DECIMAL(15,2) | No | Yes | — | Optional |

**Unique constraints:** `(combo_id, product_id, variation_id)` — no duplicate component in same combo.

---

## 5. Rental (no separate `rental_products` table)

Rental uses **products** with `is_rentable = true` and optional `rental_price_daily`, `rental_price_weekly`, `rental_price_monthly`.  
Tables: `rentals`, `rental_items` (product_id → products). No dedicated rental_products table.

---

## 6. `stock_movements`

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | uuid_generate_v4() | |
| company_id | UUID | Yes | No | — | FK → companies(id) |
| branch_id | UUID | No | Yes | — | FK → branches(id). Some schemas NOT NULL |
| product_id | UUID | Yes | No | — | FK → products(id) |
| variation_id | UUID | No | Yes | — | FK → product_variations(id) |
| movement_type | VARCHAR | Yes | No | — | purchase, sale, adjustment, rental_out, etc. |
| quantity | DECIMAL(15,2) | Yes | No | — | |
| unit_cost | DECIMAL(15,2) | No | Yes | — | |
| total_cost | DECIMAL(15,2) | No | Yes | — | |
| reference_type | VARCHAR(50) | No | Yes | — | e.g. 'opening_balance', 'sale' |
| reference_id | UUID | No | Yes | — | |
| notes | TEXT | No | Yes | — | |
| created_by | UUID | No | Yes | — | |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |

**Note:** App uses `movement_type`; some schemas use enum `type`. Opening balance is stored as `movement_type = 'adjustment'`, `reference_type = 'opening_balance'`.

---

## 7. `units`

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | gen_random_uuid() | |
| company_id | UUID | Yes | No | — | FK → companies(id) |
| name | VARCHAR(100) | Yes | No | — | e.g. "Piece", "Meter" |
| short_code | VARCHAR(20) | No | Yes | — | e.g. "pc", "m" |
| symbol | VARCHAR(20) | No | Yes | — | |
| allow_decimal | BOOLEAN | No | Yes | false | |
| is_default | BOOLEAN | No | Yes | false | |
| is_active | BOOLEAN | No | Yes | true | |
| sort_order | INT | No | Yes | 0 | |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |
| updated_at | TIMESTAMPTZ | No | Yes | NOW() | |

**Unique constraints:** `(company_id, name)`.

---

## 8. `product_categories`

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | uuid_generate_v4() | |
| company_id | UUID | Yes | No | — | FK → companies(id) |
| name | VARCHAR(255) | Yes | No | — | |
| description | TEXT | No | Yes | — | |
| parent_id | UUID | No | Yes | — | FK → product_categories(id) — for sub-categories |
| is_active | BOOLEAN | No | Yes | true | |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |
| updated_at | TIMESTAMPTZ | No | Yes | NOW() | |

---

## 9. `brands`

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | gen_random_uuid() | |
| company_id | UUID | Yes | No | — | FK → companies(id) |
| name | VARCHAR(255) | Yes | No | — | |
| is_active | BOOLEAN | No | Yes | true | |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |
| updated_at | TIMESTAMPTZ | No | Yes | NOW() | |

**Unique constraints:** `(company_id, name)`.

---

## 10. `branches`

| Column | Type | Required | Nullable | Default | Notes |
|--------|------|----------|----------|---------|-------|
| id | UUID | Yes (PK) | No | uuid_generate_v4() | |
| company_id | UUID | Yes | No | — | FK → companies(id) |
| name | VARCHAR(255) | Yes | No | — | |
| code | VARCHAR(50) | Yes | No | — | |
| email | VARCHAR(255) | No | Yes | — | |
| phone | VARCHAR(50) | No | Yes | — | |
| address | TEXT | No | Yes | — | |
| city | VARCHAR(100) | No | Yes | — | |
| is_active | BOOLEAN | No | Yes | true | |
| created_at | TIMESTAMPTZ | No | Yes | NOW() | |
| updated_at | TIMESTAMPTZ | No | Yes | NOW() | |

**Unique constraints:** `(company_id, code)`.

---

## 11. Warehouses & price lists

- **Warehouses:** No separate `warehouses` table. Stock is tracked per `branch_id` in `stock_movements`. Branch acts as location.
- **Price lists:** No dedicated price_list table in schema. Product pricing: `retail_price`, `wholesale_price`, and rental columns on `products`; variations can override cost/retail/wholesale.

---

## Summary for import

| Table | Key for import |
|-------|----------------|
| products | company_id, name, sku (unique per company), category_id, unit_id, brand_id optional; rental/combo flags |
| product_variations | product_id, name, sku (unique per product), attributes JSONB |
| product_combos | combo_product_id = product.id, combo_name, combo_price |
| product_combo_items | combo_id, product_id, variation_id (optional), qty |
| stock_movements | Opening balance: product_id, variation_id (if variation), branch_id, movement_type 'adjustment', reference_type 'opening_balance' |
| units | Lookup by company_id + name (or short_code) |
| product_categories | Lookup by company_id + name (flat or hierarchical by parent_id) |
| brands | Lookup by company_id + name |
| branches | Lookup by company_id + code or name — for opening_stock location |

SKU is **not** auto-generated at DB level; the app may generate it (e.g. prefix + incremental) when not provided. Duplicate SKU per company is rejected by `UNIQUE(company_id, sku)`.
