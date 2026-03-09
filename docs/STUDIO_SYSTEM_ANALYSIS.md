# Studio System Architecture Analysis

**Plan:** MASTER_PROMPT_STUDIO_SAFETY.md — STEP 1  
**Branch:** studio-architecture-test  
**Date:** 2026-03-09  

---

## 1. Database Tables Overview

### 1.1 `studio_productions`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| branch_id | UUID | FK → branches |
| production_no | VARCHAR(50) | Unique per company |
| production_date | DATE | |
| product_id | UUID | FK → products (fabric/base product) |
| variation_id | UUID | FK → product_variations (optional) |
| quantity, boxes, pieces, unit | NUMERIC/VARCHAR | |
| estimated_cost, actual_cost | NUMERIC | |
| status | studio_production_status | draft \| in_progress \| completed \| cancelled |
| start_date, expected_date, completed_at | DATE/TIMESTAMPTZ | |
| assigned_worker_id | UUID | FK → workers (optional) |
| notes, instructions | TEXT | |
| created_by | UUID | FK → users |
| created_at, updated_at | TIMESTAMPTZ | |
| **sale_id** | UUID | FK → sales (added by fix_get_sale_studio_charges_batch / studio_production_sale_linked) |
| **generated_product_id** | UUID | FK → products (generated studio product; added by studio_productions_generated_invoice_item) |
| **generated_invoice_item_id** | UUID | sales_items.id of generated studio line (same migration) |

**Relationships:**

- `studio_productions.sale_id` → `sales.id` (one production per sale in current design; can be extended to multiple)
- `studio_productions.product_id` → `products.id` (fabric/material)
- `studio_productions.generated_product_id` → `products.id` (studio-created product)
- `studio_productions.generated_invoice_item_id` → `sales_items.id` (invoice line for pricing sync)

---

### 1.2 `studio_production_stages`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| production_id | UUID | FK → studio_productions ON DELETE CASCADE |
| stage_type | studio_production_stage_type | dyer \| stitching \| handwork (and dyeing etc. in later migrations) |
| assigned_worker_id | UUID | FK → workers |
| cost | NUMERIC(15,2) | Actual/expected cost |
| status | studio_production_stage_status | pending \| assigned \| in_progress \| completed |
| completed_at | TIMESTAMPTZ | |
| notes | TEXT | |
| stage_order | INT | Optional ordering |
| expected_cost | NUMERIC(15,2) | |
| expected_completion_date | DATE | |
| assigned_at | TIMESTAMPTZ | |
| journal_entry_id | UUID | Optional accounting link |
| created_at, updated_at | TIMESTAMPTZ | |

**Relationships:**

- `studio_production_stages.production_id` → `studio_productions.id`

**RPC / app:** Worker costs from stages are summed per production; `get_sale_studio_charges_batch` sums by `studio_productions.sale_id`.

---

### 1.3 `sales`

Standard sales header: id, company_id, branch_id, invoice_no, invoice_date, customer_id, status (draft | quotation | order | final | cancelled), total, paid_amount, due_amount, etc.  
**Relevant for studio:** `sales.studio_charges` (optional column, sum of studio costs); `sales.is_studio` (optional); status `final` triggers stock movements when trigger is applied.

---

### 1.4 `sales_items` (primary) / `sale_items` (legacy)

**sales_items:** sale_id, product_id, product_name, sku, quantity, unit_price, total, discount_amount, tax_amount, packing_details, is_studio_product (optional).  
**sale_items:** similar; some schemas use `price` instead of `unit_price`.

**Relationships:**

- `sales_items.sale_id` → `sales.id`
- `sales_items.product_id` → `products.id`
- `studio_productions.generated_invoice_item_id` → `sales_items.id` (for the one generated studio line)

---

### 1.5 `products`

Standard product master. Used as fabric (`studio_productions.product_id`) and as generated studio product (`studio_productions.generated_product_id`).

---

### 1.6 `stock_movements`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| company_id | UUID | |
| branch_id | UUID | |
| product_id | UUID | FK → products |
| variation_id | UUID | Optional |
| quantity | NUMERIC | Positive = IN, negative = OUT |
| unit_cost, total_cost | NUMERIC | |
| movement_type | TEXT | e.g. PURCHASE, SALE, RETURN, ADJUSTMENT, … (CHECK in verify_stock_movements_schema) |
| reference_type | TEXT | e.g. 'sale' |
| reference_id | UUID | e.g. sale id |
| notes | TEXT | |
| created_by | UUID | |
| created_at, updated_at | TIMESTAMP | |

**Relationships:**

- `stock_movements.reference_type = 'sale'` and `reference_id = sales.id` for sale OUT movements.
- Stock is derived from SUM(quantity) per product (and optionally variation); no WIP layer in current schema.

---

## 2. Current Workflow (As Implemented)

```
Studio Sale created (sales + sales_items with fabric/material lines only)
    ↓
User opens Studio Production → ensureProductionForSale() creates studio_productions row (if none)
    ↓
Customize Tasks → Save → persistAllStagesToBackend()
    → Updates/creates studio_production_stages only (no product, no invoice, no stock)
    ↓
User completes stages (worker, cost, status)
    ↓
User clicks "Generate Invoice" (Create Product + Generate Invoice)
    → Creates product, inserts sales_items row, sets studio_productions.generated_product_id & generated_invoice_item_id
    ↓
Optional: "Sync invoice pricing" updates that one sales_items row from production cost + profit
    ↓
Sale marked Final (status = 'final')
    → Trigger handle_sale_final_stock_movement creates stock_movements (OUT) per sales_items/sale_items line
    → Inventory and stock ledger update
```

---

## 3. Relationship Summary

| From | To | Relationship |
|------|-----|--------------|
| studio_productions.sale_id | sales.id | Production belongs to one sale |
| studio_production_stages.production_id | studio_productions.id | Stages belong to one production |
| sales_items.sale_id | sales.id | Line items belong to one sale |
| studio_productions.generated_invoice_item_id | sales_items.id | Generated studio line (for pricing sync) |
| stock_movements.reference_id (reference_type='sale') | sales.id | Movements for that sale |

---

## 4. Detected Issues (Pre–Test Fixes)

| Issue | Status / Mitigation |
|-------|---------------------|
| Missing stock movements when sale finalized | Addressed by migration `sale_final_stock_movement_trigger.sql`: trigger creates OUT movements when status → final. Idempotent (skips if movements exist). |
| Auto product/invoice on Customize Tasks Save | Addressed in app: Save only updates studio_production_stages; product/invoice only on "Generate Invoice". |
| Invoice line targeting (wrong item updated) | Addressed: sync uses generated_invoice_item_id / generated_product_id; only that line updated. |
| Worker payment status not reflecting in UI | Addressed: ledger status loaded via getLedgerStatusForStages and passed to stagesToProductionSteps. |
| No WIP inventory layer | Not implemented. Raw material → WIP → finished goods would require schema and flow changes (design in STEP 5). |

---

## 5. Recommendations for Test Phase

1. **Stock movements:** Ensure `sale_final_stock_movement_trigger` is applied in **test** DB only; validate with test sales and check stock_movements and ledger.
2. **Studio flow:** Keep strict separation: Customize Tasks Save = stages only; Generate Invoice = product + invoice line + link.
3. **WIP layer:** Treat as new design (docs only in this phase); no production schema change until approved.

---

*End of STEP 1 — Studio System Analysis.*
