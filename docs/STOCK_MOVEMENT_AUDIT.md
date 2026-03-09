# Stock Movement Audit

**Plan:** MASTER_PROMPT_STUDIO_SAFETY.md — STEP 2  
**Branch:** studio-architecture-test  

---

## 1. Expected Behaviour

When **sale.status** becomes **'final'**:

- For **each** sale line (sales_items or sale_items row with sale_id = sale.id):
  - Insert one **stock_movements** row:
    - **quantity** = negative of line quantity (stock OUT)
    - **movement_type** = 'sale' (or 'SALE' per schema CHECK)
    - **reference_type** = 'sale', **reference_id** = sale.id
    - **product_id**, **variation_id**, **company_id**, **branch_id**, **unit_cost**, **total_cost**, **notes**, **created_at**

Result: inventory and stock ledger reflect the sale; TOTAL SOLD and CURRENT STOCK are correct.

---

## 2. Current Implementation (Code Paths)

### 2.1 Path A: SalesContext.updateSale (status → final)

**When:** User updates sale with `{ status: 'final' }` via the context (e.g. Sales page “Mark as Final”).

**Logic:**

1. `wasNotFinal && isNowFinal && stockMovementDeltas.length === 0 && effectiveCompanyId`
2. Load items from **sales_items** (else **sale_items**)
3. For each item: call `productService.createStockMovement(...)` with `movement_type: 'sale'`, `quantity: -qty`, `reference_type: 'sale'`, `reference_id: id`
4. Then `saleService.updateSale(id, supabaseUpdates)` updates the row (including status = 'final')

**Result:** Stock movements are created **before** the DB update. When the DB trigger runs (AFTER UPDATE), it sees existing movements and skips (idempotent).

**Gap:** If the UI or another flow calls **saleService.updateSaleStatus(saleId, 'final')** directly (e.g. convertQuotationToInvoice), Path A is **not** run. No app-side creation of stock movements.

### 2.2 Path B: saleService.updateSaleStatus(id, 'final')

**When:** Direct call to `updateSaleStatus` (e.g. quotation → invoice, or any code that only updates status in DB).

**Logic:**

- Updates `sales` set status = 'final' where id = id.
- **Does not** create any stock_movements.
- Commission calculation may run for final.

**Gap:** Stock movements are **not** created on this path unless a **database trigger** does it.

### 2.3 Path C: Database trigger (sale_final_stock_movement_trigger)

**When:** AFTER UPDATE on **sales** and NEW.status = 'final' and OLD.status ≠ 'final'.

**Logic (migration sale_final_stock_movement_trigger.sql):**

1. If movements already exist for this sale (reference_type = 'sale', reference_id = NEW.id, movement_type = 'sale'), **return** (idempotent).
2. Read items from **sales_items** (or fallback **sale_items**).
3. For each item, INSERT into **stock_movements** (quantity negative, movement_type 'SALE', reference_type 'sale', reference_id = NEW.id).

**Result:** Ensures that whenever a sale becomes final (any path), stock movements are created if they don’t already exist.

---

## 3. sale_items / sales_items Relationship

| Table | Use |
|-------|-----|
| **sales_items** | Primary: sale_id, product_id, quantity, unit_price, total, (is_studio_product). Used by app and trigger first. |
| **sale_items** | Legacy: sale_id, product_id, quantity, price/unit_price, total. Trigger and app fallback if sales_items missing. |

Both paths (app and trigger) support both tables so that all relevant lines are turned into stock OUT.

---

## 4. Root Cause of “Missing” Stock Movements

- **Studio (or any) sale** finalized via a path that **only** updates **sales.status** (e.g. `updateSaleStatus(id, 'final')`) **and** no trigger was present → **no** stock_movements.
- **Fix:** Apply the trigger (in **test** first) so that when status → final, movements are created even when the app path (Path A) is not used.

---

## 5. Inventory Service / stock_movements Table

- **inventoryService** (and related) uses **stock_movements** as source of truth: stock = SUM(quantity) per product (and optionally variation).
- **productService.createStockMovement** inserts into stock_movements (company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost, movement_type, reference_type, reference_id, notes, created_by).
- **Schema:** movement_type often has CHECK (e.g. 'SALE', 'PURCHASE', …). Trigger uses 'SALE' to match.

---

## 6. Test Fix (Do Not Apply to Production)

- **Test migration:** Use a **copy** of `sale_final_stock_movement_trigger.sql` in a test-only migration (e.g. under `migrations/test/` or named `fix_sale_stock_movements_test.sql`) and run **only** in test DB.
- **Validation:** In test, set a sale to final (via UI or direct update); then:
  - `SELECT * FROM stock_movements WHERE reference_type = 'sale' AND reference_id = '<sale_id>'`
  - Expect one OUT row per sale line; ledger TOTAL SOLD and stock should update.

---

## 7. Summary

| Item | Status |
|------|--------|
| Expected: movements when status = final | Defined |
| App path (updateSale with status final) | Creates movements when conditions met |
| Direct updateSaleStatus('final') | Does not create movements; **trigger required** |
| Trigger (sale_final_stock_movement_trigger) | Exists in repo; **apply in test only** |
| sale_items / sales_items | Both supported by app and trigger |

**Recommendation:** Run the trigger migration in **test** environment only; validate with test data; then, after approval, prepare production migration.

---

*End of STEP 2 — Stock Movement Audit.*
