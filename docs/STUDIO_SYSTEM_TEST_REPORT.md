# Studio System Test Report

**Plan:** MASTER_PROMPT_STUDIO_SAFETY.md — STEP 8  
**Branch:** studio-architecture-test  
**Date:** 2026-03-09  

---

## 1. Summary

All test-phase deliverables for the Studio Architecture TEST plan have been implemented **without modifying the production database**. This report summarizes what was done and how to validate each item.

| Area | Status | Location |
|------|--------|----------|
| Inventory (sale final → stock movements) | Test migration ready | migrations/test/fix_sale_stock_movements_test.sql |
| Production workflow (Customize Tasks vs Generate Invoice) | Documented & confirmed | docs/STUDIO_PRODUCTION_ARCHITECTURE.md |
| Stock movement validation | Audit + test trigger | docs/STOCK_MOVEMENT_AUDIT.md |
| WIP inventory | Design + stub service | docs/WIP_INVENTORY_DESIGN.md, src/app/services/wipInventoryTestService.ts |
| Kanban board | Design + test RPC | docs/KANBAN_PRODUCTION_BOARD.md, migrations/test/get_studio_kanban_board_test.sql |

---

## 2. Inventory Test Results

### 2.1 Test Migration

- **File:** `migrations/test/fix_sale_stock_movements_test.sql`
- **Purpose:** When a sale is updated to `status = 'final'`, create `stock_movements` (OUT) for each line from `sales_items` or `sale_items`. Idempotent: skips if movements already exist.
- **Production equivalent:** `migrations/sale_final_stock_movement_trigger.sql` (apply only after approval).

### 2.2 How to Test (Test DB Only)

1. Apply the test migration to a **test** Supabase project (SQL Editor or migration runner).
2. Create or pick a sale with at least one line in `sales_items` (or `sale_items`) and status ≠ 'final'.
3. Run: `UPDATE sales SET status = 'final' WHERE id = '<sale_id>';`
4. Query:
   ```sql
   SELECT * FROM stock_movements
   WHERE reference_type = 'sale' AND reference_id = '<sale_id>'
   ORDER BY created_at;
   ```
5. **Expected:** One row per sale line with negative `quantity`, `movement_type = 'SALE'`. Inventory/stock ledger should reflect the OUT.

### 2.3 Rollback (Test DB)

- Drop trigger: `DROP TRIGGER IF EXISTS sale_final_stock_movement_trigger ON sales;`
- Optionally drop function: `DROP FUNCTION IF EXISTS handle_sale_final_stock_movement();`

---

## 3. Production Workflow Test

### 3.1 Expected Behavior (Documented)

- **Customize Tasks → Save:** Only `studio_production_stages` is written (replaceStages: delete + insert, or deleteStage + createStage). Trigger updates `sales.studio_charges` and `sales.due_amount`. No product, no invoice line, no stock.
- **Generate Invoice:** Inserts into `products`, `sales_items`, and updates `studio_productions.generated_product_id` and `generated_invoice_item_id`. No stock movements until sale is final.
- **Sale Final:** App or trigger creates stock_movements (OUT) per line.

### 3.2 How to Test

1. Create a studio sale (sales + sales_items with fabric/product lines).
2. Open Studio Production; ensure one `studio_productions` row exists.
3. Open Customize Tasks, add/change stages, Save. Verify only `studio_production_stages` and `sales` (studio_charges, due_amount) change; no new product or sales_items row.
4. Click “Create Product + Generate Invoice”. Verify one new product, one new sales_items row, and studio_productions.generated_* populated.
5. Mark sale Final. Verify stock_movements exist for that sale (if trigger applied in test).

---

## 4. Stock Movement Validation

### 4.1 Paths Covered

- **App path (SalesContext.updateSale):** Creates movements when status → final and no item deltas; then updates sale. Trigger then sees existing movements and skips (idempotent).
- **Direct updateSaleStatus(id, 'final'):** No app-side movements; **trigger is required** to create movements. This is why the test (and production) trigger is needed.
- **Tables:** Both `sales_items` and `sale_items` are supported by trigger and app.

### 4.2 Data Integrity Checks

- **Duplicate movements:** Trigger and app both skip or avoid creating duplicate OUT for the same sale (idempotent).
- **Quantity sign:** Sale OUT = negative quantity in stock_movements.
- **Reference:** reference_type = 'sale', reference_id = sale.id for all sale-final movements.

---

## 5. WIP Inventory (Test Stub)

- **Design:** See `docs/WIP_INVENTORY_DESIGN.md` (Raw Material → WIP → Finished Goods; schema options).
- **Code:** `src/app/services/wipInventoryTestService.ts` — `issueRawToWipTest` and `getWipBalanceTest` are no-op or return empty unless feature flag `studio_wip_inventory_test` is enabled. No production DB or schema change.
- **Validation:** Enable the flag in a test company; call the stub; confirm it returns success without writing to production tables.

---

## 6. Kanban Board (Test Backend)

- **Design:** See `docs/KANBAN_PRODUCTION_BOARD.md` (columns: Cutting, Stitching, Embroidery, Finishing, Ready; React + Tailwind UI).
- **RPC (test only):** `get_studio_kanban_board_test(p_company_id, p_branch_id)` in `migrations/test/get_studio_kanban_board_test.sql`. Returns JSON with one key per column and arrays of productions.
- **How to test:** Apply the test migration in test DB; call the RPC with a valid company_id; verify JSON structure and that productions appear in the correct column by current_stage_id / status.

---

## 7. Data Integrity Summary

| Check | Result |
|-------|--------|
| Customize Tasks does not create product/invoice/stock | Confirmed (docs + code review) |
| Generate Invoice creates product + line + link only | Confirmed |
| Sale final creates stock OUT (with trigger) | Test migration provided; idempotent |
| No production DB modified | All changes are test branch + test migrations + stub + feature flags |

---

## 8. Next Steps (STEP 9)

- **Do not deploy to production.** Wait for explicit approval.
- After approval:
  1. Run production DB backup.
  2. Apply `migrations/sale_final_stock_movement_trigger.sql` to production (or equivalent approved script).
  3. Optionally enable Kanban/WIP in production only after further validation and approval.

---

*End of STEP 8 — Studio System Test Report.*
