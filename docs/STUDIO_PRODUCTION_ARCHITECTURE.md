# Studio Production Architecture (Review)

**Plan:** MASTER_PROMPT_STUDIO_SAFETY.md — STEP 4  
**Branch:** studio-architecture-test  

---

## 1. Purpose

This document reviews the **production** studio flow: which tables and code paths are used, and confirms that **Customize Tasks → Save** only affects stages (and, via trigger, sale totals), not product/invoice/stock.

---

## 2. End-to-End Flow

| Step | User / System | Tables written (direct) | Tables written (trigger) |
|------|----------------|--------------------------|---------------------------|
| 1 | Create Studio Sale | sales, sales_items | — |
| 2 | Open Studio Production | studio_productions (ensureProductionForSale) | — |
| 3 | **Customize Tasks → Save** | **studio_production_stages** (replaceStages: delete + insert, or deleteStage + createStage) | **sales** (studio_charges, due_amount, updated_at) via trigger_after_studio_stage_sync_sale |
| 4 | Assign workers / complete stages | studio_production_stages (assignWorkerToStage, completeStage, cost/journal) | sales (studio_charges, due_amount) via same trigger |
| 5 | **Generate Invoice** | products (insert), sales_items (insert), studio_productions (generated_product_id, generated_invoice_item_id) | — |
| 6 | Sync invoice pricing | sales_items (update one row by generated_invoice_item_id) | — |
| 7 | **Sale Final** | sales (status = 'final') | stock_movements (OUT per line) if trigger applied |

---

## 3. Customize Tasks Save — What It Touches

**Code:** `StudioSaleDetailNew` → apply task config → `studioProductionService.replaceStages(productionId, stages)` or deleteStage + createStage.

**Direct DB writes:**

- **studio_production_stages only:**
  - Either: DELETE from studio_production_stages where production_id = X; INSERT new rows (stage_type, stage_order, status = 'pending', …).
  - Or: deleteStage(stageId) for removed stages; createStage(productionId, { stage_type }, position) for added stages.

**No direct writes to:**

- studio_productions (no column updated on Save)
- sales (no direct update)
- sales_items (unchanged)
- products (unchanged)
- stock_movements (unchanged)

**Trigger side-effect:**

- Trigger `trigger_after_studio_stage_sync_sale` on `studio_production_stages` (AFTER INSERT/UPDATE/DELETE) calls `sync_sale_studio_charges_for_sale(sale_id)`.
- That function updates **sales**: `studio_charges = SUM(stage costs)`, `due_amount = GREATEST(0, total + studio_charges - paid_amount)`, `updated_at = NOW()`.

So **Customize Tasks Save** = stages + sale totals (via trigger). It does **not** create or change products, invoice lines, or stock.

---

## 4. Generate Invoice — What It Touches

**Code:** “Create Product + Generate Invoice” in Studio Sale Detail.

**Direct DB writes:**

- **products:** INSERT (new studio product).
- **sales_items:** INSERT (one line for that product, linked to the sale).
- **studio_productions:** UPDATE set generated_product_id, generated_invoice_item_id.

**No direct writes to:**

- studio_production_stages (unchanged)
- stock_movements (created only when sale becomes final, by app or trigger)

---

## 5. Sale Final — Stock Movements

- **App path (SalesContext.updateSale with status = 'final'):** Creates stock_movements (OUT) per line, then updates sales.status.
- **Direct updateSaleStatus(id, 'final'):** Only updates sales; no app-side movements. **Trigger required** (e.g. sale_final_stock_movement_trigger) to create stock_movements.
- See `docs/STOCK_MOVEMENT_AUDIT.md` for details.

---

## 6. Summary

| Action | studio_production_stages | studio_productions | sales | sales_items | products | stock_movements |
|--------|---------------------------|--------------------|-------|-------------|----------|------------------|
| Customize Tasks Save | ✅ (only) | ❌ | trigger: studio_charges, due_amount | ❌ | ❌ | ❌ |
| Generate Invoice | ❌ | ✅ (generated_* ids) | ❌ | ✅ (insert 1 line) | ✅ (insert 1) | ❌ |
| Sale Final | ❌ | ❌ | ✅ (status) | ❌ | ❌ | ✅ (trigger or app) |

**Conclusion:** Studio production architecture is consistent with the intended separation: **Customize Tasks Save** only updates stages (and sale totals via trigger); product and invoice creation are isolated to **Generate Invoice**; stock OUT is tied to **Sale Final** (trigger or app).

---

*End of STEP 4 — Studio Production Architecture Review.*
