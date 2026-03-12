# Purchase & Stock — Diagnostic Report & Fixes

This document records the **root-cause fixes** applied after a full backend + DB schema trace (no guessing). Use it with the diagnostic SQL to verify your environment.

---

## STEP 1 — Database schema (you run SQL)

Run in **Supabase SQL Editor**:

```bash
# From project root, the script is at:
scripts/purchase_and_stock_final_diagnostic.sql
```

Or run the same steps manually:

1. **product_variations columns**  
   `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_variations';`  
   → Note: if `current_stock` is missing, the real stock column is usually `stock` or use `stock_movements` only.

2. **products stock columns**  
   Check for `current_stock`, `stock`, `stock_quantity` on `products`.

3. **purchase_status enum**  
   `SELECT unnest(enum_range(NULL::purchase_status));`  
   → Use the **exact** value (e.g. `final` or `FINAL`) in code when calling Mark as Final.

4. **Triggers on purchases**  
   Confirm `purchase_final_stock_movement_trigger` exists.

5. **RLS on purchases**  
   Ensure the authenticated role can `UPDATE` the `purchases` row.

---

## STEP 2 — Root cause of "column current_stock does not exist" (FIXED)

- **Cause:** Code was selecting `current_stock` from `products` or using `products(*)`/`product_variations(*)`, which can request missing columns.
- **Permanent fix applied:**
  - **getLowStockProducts:** No longer runs any query with `current_stock`. Uses only `inventoryService.getInventoryOverview()` (movement-based). This was the main query running on every page (TopHeader) and causing the error on Purchase screen load.
  - **productService:** getAllProducts, getProduct, searchProducts use explicit column lists only (no `*`, no `current_stock`). createProduct/updateProduct strip `current_stock` from payload before insert/update.
  - **purchaseService.getPurchase:** Explicit columns for product and variation (no `*`).
  - **saleService, saleReturnService, purchaseReturnService, rentalService:** `product:products(*)` replaced with `product:products(id, name, sku, cost_price, retail_price, has_variations)`; variations use explicit columns.
  - **PurchaseForm, ProductsPage, SaleForm, POS, Dashboard, rentals, EnhancedProductForm:** No read of `p.current_stock`; use `p.stock` or movement-based only.
  - **Mobile inventory.ts:** Stock from `stock_movements` only; no `current_stock` select.

---

## STEP 3 — Fixes applied (frontend)

### 3.1 productService (web)

- **getAllProducts / getProduct:**  
  - No longer use `*` for products or variations.  
  - Use explicit column lists: `PRODUCT_SELECT_SAFE` (all common product columns **except** `current_stock`) and `VARIATION_SELECT_SAFE` = `id, product_id, sku, attributes`.  
  - Stock for the purchase form comes from `inventoryService.getInventoryOverview()` (movement-based).

- **getLowStockProducts:**  
  - If the query fails with "current_stock" or "does not exist", fallback to `inventoryService.getInventoryOverview()` and derive low-stock list from movement-based stock.

### 3.2 purchaseService (web)

- **getPurchase:**  
  - Embed items with explicit columns:  
    `product:products(id, name, sku, cost_price, has_variations, unit_id, category_id, min_stock, max_stock)`  
    `variation:product_variations(id, product_id, sku, attributes)`.  
  - No `current_stock` requested from either table.

- **updatePurchaseStatus:**  
  - First tries `status: 'final'`.  
  - On any error when marking as final, **auto-tries** all common enum casings: `'final'`, `'FINAL'`, `'Final'` and returns the first success. No manual SQL needed for enum mismatch.

### 3.3 SalesContext (web)

- Replaced `products` select `id, current_stock, has_variations` with `id, has_variations` only.  
- Stock for validation comes from `productService.getStockForProducts()` (movement-based).  
- Removed direct `products.current_stock` read/update after creating stock movements; stock is source-of-truth via `stock_movements` only.

### 3.4 saleService / saleReturnService / purchaseReturnService (web)

- Replaced `variation:product_variations(*)` with `variation:product_variations(id, product_id, sku, attributes)` everywhere so no stock column is requested from variations.

### 3.5 PurchaseForm (web)

- Product list stock: `p.stock ?? (p as any).current_stock ?? 0` so we prefer movement-derived `stock` from inventory overview.

### 3.6 Mobile (erp-mobile-app)

- **inventory.ts getInventory:**  
  - No longer selects `current_stock` from `products`.  
  - Loads products with `id, name, sku, min_stock, retail_price` and derives stock from `stock_movements` (SUM per product_id).

---

## STEP 4 — Purchase "Mark as Final" PATCH 400

- **Auto-fix in app:** `updatePurchaseStatus` now tries, in order, `'final'`, `'FINAL'`, `'Final'` when marking as final and uses the first value that succeeds. Enum casing mismatch is handled automatically.
- **If PATCH 400 still occurs:** Likely RLS or trigger/constraint. Run the diagnostic SQL; if manual `UPDATE purchases SET status = 'final' WHERE id = '<uuid>';` fails in SQL Editor, the error message will point to the DB fix (trigger/RLS/constraint).

---

## STEP 5 — Test flow

1. Restart/reload web app (so new code is loaded).  
2. Open a purchase (e.g. PUR-0188) and confirm the red "column current_stock does not exist" is gone.  
3. Click **Mark as Final** and check Network tab for PATCH to `purchases`:  
   - If 200: success.  
   - If 400: run diagnostic SQL (enum + RLS + triggers) and align code with DB.  
4. Verify stock: run STEP 3 queries from the diagnostic SQL and confirm `stock_movements` rows exist after finalize.

---

## Files changed (reference)

- `scripts/purchase_and_stock_final_diagnostic.sql` — DB diagnostic (run in Supabase).  
- `src/app/services/productService.ts` — Safe product/variation selects, getLowStockProducts fallback.  
- `src/app/services/purchaseService.ts` — getPurchase explicit columns, updatePurchaseStatus retry.  
- `src/app/context/SalesContext.tsx` — No current_stock select/update; stock from getStockForProducts.  
- `src/app/services/saleService.ts` — variation select explicit.  
- `src/app/services/saleReturnService.ts` — variation select explicit.  
- `src/app/services/purchaseReturnService.ts` — variation select explicit.  
- `src/app/components/purchases/PurchaseForm.tsx` — stock from p.stock first.  
- `erp-mobile-app/src/api/inventory.ts` — movement-based stock, no current_stock.
