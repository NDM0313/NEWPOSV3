# ERP Bugfix: Purchase Stock Posting Twice

**Date:** 2026-03-13  
**Issue:** New purchase showed inventory/stock ledger with quantity doubled (e.g. 799.40 → 1598.80); two movements per purchase.

---

## Root cause

Stock movements for purchases were created **twice**:

1. **DB trigger** `purchase_final_stock_movement_trigger` (AFTER INSERT OR UPDATE on `purchases`): when `status = 'final'`, it inserts one `stock_movements` row per `purchase_items` line. Idempotent: skips if movements for this purchase already exist.
2. **Frontend** (PurchaseContext): after creating or finalizing a purchase, the app also called `productService.createStockMovement()` for each item.

**Order of operations:**  
- Create purchase with status `final` → `purchaseService.createPurchase()` inserts into `purchases` and `purchase_items` → **trigger runs and creates movements**.  
- Then PurchaseContext ran its own loop and created movements again → **duplicate**.

Same for **update status to final**: `updatePurchase(purchaseId, { status })` → trigger runs on UPDATE → then “STEP 4” in `updateStatus` created movements again.

---

## Fix

- **Single source of truth:** Rely on the DB trigger only for purchase → stock. No application-side creation of stock_movements for **new** purchases or for **status change to final**.
- **Removed:**
  1. In **createPurchase**: the entire block that created stock_movements when status was `received` or `final` (previously ~80 lines). Replaced with a short log that stock is handled by the trigger.
  2. In **updateStatus**: “STEP 4” that created stock_movements when moving to received/final. Trigger already runs on `updatePurchase(..., { status })`.
- **Kept:** In **updatePurchase**, the **delta**-based stock movement creation (when user **edits** an existing purchase and adds/changes items). The trigger does not run for that case (it skips when movements already exist), so the app must create movements for new/delta lines only.

---

## Files changed

- `src/app/context/PurchaseContext.tsx`: removed duplicate stock movement creation in createPurchase and in updateStatus (STEP 4).

---

## Verification

- New purchase with status final: only the trigger creates movements (one per line).
- Update status to final: only the trigger creates movements.
- Edit purchase (add/change items) when already final: only the delta logic in updatePurchase creates movements for the new/changed lines.
- No migrations; no DB changes. Existing duplicate movements in DB are **not** mass-deleted; document and fix manually if needed.

---

## Rollback

Restore the removed blocks in PurchaseContext (createPurchase and updateStatus) from version control if the trigger is disabled or missing in an environment.
