# ERP Inventory Sync — Full Diagnostic Report

**Generated:** From database diagnostic script + web/mobile codebase scan.  
**Purpose:** Single source of truth for how inventory works, where mismatches exist, and how to fix them.

---

## 1) Database inventory schema

### Tables analyzed

| Table | Exists | Key stock-related columns |
|-------|--------|----------------------------|
| **products** | Yes | `current_stock` (numeric), `min_stock`, `max_stock` |
| **product_variations** | Yes | `stock` (numeric) |
| **stock_movements** | Yes | `product_id`, `variation_id`, `quantity`, `box_change`, `piece_change`, `branch_id`, `reference_type`, `reference_id` |
| **inventory_balance** | Yes | `product_id`, `branch_id`, `qty`, `boxes`, `pieces` |
| **purchase_items** | Yes | `product_id`, `variation_id`, `quantity`, packing columns |
| **sale_items / sales_items** | Yes | `product_id`, `variation_id`, `quantity`, packing columns |

### Triggers on stock

| Trigger | Table | Event | Function |
|---------|--------|--------|----------|
| `trigger_update_stock_from_movement` | stock_movements | INSERT | `update_product_stock_from_movement()` — updates `products.current_stock` |
| `trigger_sync_inventory_balance_from_movement` | stock_movements | INSERT | `sync_inventory_balance_from_movement()` — updates `inventory_balance` |
| `update_stock_movements_updated_at` | stock_movements | UPDATE | `update_updated_at_column()` |

### Functions (inventory-related)

- `get_product_stock_balance(product_id, company_id)` — SUM(quantity) from stock_movements
- `get_inventory_valuation` — valuation from movements
- `update_product_stock_from_movement` — trigger: products.current_stock += quantity (when variation_id IS NULL)
- `sync_inventory_balance_from_movement` — trigger: upsert inventory_balance from movement
- `handle_purchase_final_stock_movement` — creates movements on purchase finalize
- `handle_sale_final_stock_movement` — creates movements on sale final
- `update_stock_on_purchase`, `update_stock_on_sale` — legacy/alternate stock update

### Detection results (from diagnostic run)

| Check | Result |
|-------|--------|
| Negative stock (by variation) | **10** variation-level negative balances |
| Negative stock (by product) | **5** product-level negative balances |
| Movements with `variation_id` NULL | **53** rows |
| Products without variations but with movements | **16** products |

**Triggers on `purchases` (for PATCH/finalize debugging):**

| trigger_name | event_manipulation | action_statement |
|--------------|--------------------|------------------|
| audit_purchases | INSERT, UPDATE, DELETE | log_audit_trail() |
| purchase_final_stock_movement_trigger | INSERT, UPDATE | **handle_purchase_final_stock_movement()** |
| set_purchases_created_by | INSERT | set_created_by_from_auth() |
| trigger_log_purchase_activity | INSERT, UPDATE, DELETE | log_purchase_activity() |
| trigger_prevent_purchase_delete_if_returns | DELETE | prevent_purchase_delete_if_returns_exist() |
| trigger_set_purchase_po_number | INSERT | set_purchase_po_number() |
| trigger_update_contact_balance_on_purchase | INSERT, UPDATE | update_contact_balance_on_purchase() |
| trigger_update_stock_on_purchase | INSERT, UPDATE | update_stock_on_purchase() |

If PATCH purchases returns 400, check `handle_purchase_final_stock_movement()` and `update_stock_on_purchase()` (and RLS on stock_movements/purchases).

**Conclusion:** DB has dual storage: (1) **stock_movements** as the ledger, (2) **products.current_stock** and **product_variations.stock** and **inventory_balance** updated by triggers. Design goal (docs) is movement-only for *reading* stock; writing still goes through movements and triggers update the snapshot columns.

---

## 2) Stock calculation method

| Layer | Method |
|-------|--------|
| **Intended (design)** | Stock = SUM(quantity) FROM stock_movements GROUP BY product_id, variation_id (and optionally branch_id). No direct read of products.current_stock / product_variations.stock. |
| **DB triggers** | On INSERT stock_movements: (1) update products.current_stock when variation_id IS NULL, (2) sync inventory_balance. So snapshot columns are maintained from movements. |
| **Web ERP** | **inventoryService.getInventoryOverview()** — reads from **stock_movements** only, aggregates by product_id/variation_id. Product list and product detail stock come from this or same movement-based API. |
| **Mobile ERP** | **api/inventory.ts** — getInventory() uses **stock_movements** only. **api/products.ts** getProducts() — for variations tries product_variations.current_stock/stock then fallback to **stock_movements** SUM. POS uses **stock_movements** (balanceFromMovements) when branch_id is set. |

---

## 3) Web ERP inventory usage

| File / area | What it does | Stock source |
|-------------|--------------|--------------|
| **inventoryService.ts** | getInventoryOverview, getInventoryMovements | ✅ **stock_movements** only (single source of truth) |
| **productService.ts** | getProducts, getLowStockProducts, getStockMovements | ✅ getLowStockProducts → inventoryService.getInventoryOverview (movement-based). getProducts explicit select **omits current_stock**. |
| **SaleForm.tsx** | Product picker stock check | ✅ inventoryService.getInventoryOverview (movement-based) |
| **PurchaseForm.tsx** | Stock display / validation | ✅ inventoryService.getInventoryOverview |
| **SalesContext / PurchaseContext** | Sale/purchase finalize | ✅ Creates **stock_movements** only; comments say do not update products.current_stock |
| **POS (web)** | Product grid stock | ✅ balanceFromMovements (stock_movements) when branch set; else product.stock from overview |
| **InventoryDesignTestPage, InventoryDashboardNew** | Overview + movements | ✅ inventoryService.getInventoryOverview + getInventoryMovements |
| **studioProductionService.ts** | Studio: generate product, fabric deduction | ❌ **INVALID** — reads product.current_stock and calls productService.updateProduct(..., { current_stock }) |
| **AdjustStockDialog.tsx** | Manual adjustment | ⚠️ May send current_stock to update (needs to go through stock_movements only) |
| **EnhancedProductForm.tsx / ImportProductsModal** | Create product | Sends current_stock: 0 on create (acceptable for initial row; actual stock should be opening balance via movements) |
| **TopHeader (low stock)** | Low stock list | productService.getLowStockProducts → movement-based ✅ |

---

## 4) Mobile ERP inventory usage

| File / area | What it does | Stock source |
|-------------|--------------|--------------|
| **api/inventory.ts** | getInventory() | ✅ **stock_movements** only (SUM by product_id) |
| **api/products.ts** | getProducts(), getProductByBarcodeOrSku() | ⚠️ getProducts: variation stock from **product_variations** (current_stock/stock) then fallback to **stock_movements**; getProductByBarcodeOrSku returns stock: 0 (no movement lookup) |
| **api/sales.ts** | createSale, returns | ✅ Inserts **stock_movements** for sale/reversal |
| **utils/stockBalance.ts** | balanceFromMovements() | ✅ SUM(quantity) from movements (used by POS) |
| **POSModule.tsx** | Product grid + cart | ✅ Products from getProducts(); branch stock overlay from **stock_movements** via balanceFromMovements |
| **ProductsModule, AddProductFlow, VariationSelector** | Display stock | From getProducts() → product.stock / variation.stock (mix of product_variations and movements) |
| **InventoryModule, InventoryReports, DashboardModule** | Lists / low stock | From getInventory() or getProducts() (inventory is movement-based) |

---

## 5) Web vs Mobile comparison

| Feature | Web ERP | Mobile ERP | Status |
|---------|---------|------------|--------|
| **Product stock source (list)** | inventoryService.getInventoryOverview (stock_movements) | getProducts() → product_variations.stock + fallback stock_movements | ⚠️ Mobile can read product_variations.stock |
| **Inventory calculation** | Movement-based only in inventory + product low stock | inventory.ts movement-based; products.ts mixed | ⚠️ Align products.ts to movement-only for display |
| **Purchase finalize logic** | Creates stock_movements (PurchaseContext); no current_stock update | N/A (purchases may be web-only or different flow) | ✅ Web correct |
| **Stock movement creation (sale)** | SalesContext: stock_movements only | sales.ts: stock_movements insert on createSale | ✅ Both correct |
| **Low stock detection** | productService.getLowStockProducts → getInventoryOverview | getInventory() (movement-based) or getProducts | ✅ Both have movement-based path |
| **Inventory API** | getInventoryOverview, getInventoryMovements, getStockMovements | getInventory(), getProducts (with stock), balanceFromMovements | ⚠️ Mobile has no getInventoryOverview equivalent; getProducts mixes sources |
| **Branch-scoped stock** | getInventoryOverview(companyId, branchId) | stock_movements + balanceFromMovements in POS | ✅ Both support branch |
| **Barcode → product** | N/A | getProductByBarcodeOrSku returns stock: 0 | ⚠️ Mobile: add movement-based stock for scanned product |

---

## 6) Mismatch report

### Invalid / inconsistent inventory source (flag)

| Location | Issue | Severity |
|----------|--------|----------|
| **Web: studioProductionService.ts** | Reads product.current_stock and updates via productService.updateProduct(..., { current_stock }) | ❌ **INVALID INVENTORY SOURCE** — bypasses stock_movements |
| **Web: AdjustStockDialog.tsx** | Sends current_stock to update | ⚠️ Should create stock_movement (adjustment) instead of updating column |
| **Mobile: api/products.ts getProducts()** | Uses product_variations.stock / current_stock before fallback to stock_movements | ⚠️ Prefer movement-based only for consistency |
| **Mobile: getProductByBarcodeOrSku()** | Returns stock: 0 always | ⚠️ Should optionally compute stock from stock_movements for POS |

### Missing APIs / logic on mobile

| Missing item | Web has | Suggestion |
|--------------|---------|------------|
| **getInventoryOverview equivalent** | inventoryService.getInventoryOverview(companyId, branchId) with variations + boxes/pieces | Add mobile API that returns same shape from stock_movements (or call existing getInventory + products and merge). |
| **getStockMovements(productId, companyId, variationId?, branchId?)** | productService.getStockMovements | Add in mobile for product detail / ledger view. |
| **Stock for barcode-scanned product** | N/A | After getProductByBarcodeOrSku, call movement-based balance (e.g. by product_id + branch) and set product.stock. |

### Data / schema notes

- **Negative stock:** Present in DB (10 variation-level, 5 product-level). Allowed by design in some flows; ensure UI and validations are consistent.
- **Null variation_id movements:** 53 rows — normal for non-variation products.
- **products.current_stock / product_variations.stock:** Still updated by DB triggers from stock_movements. Reading them in app is discouraged; writing them from app (except via movements) is invalid.

---

## 7) Suggested fixes (DO NOT apply automatically)

### High priority (APPLIED)

1. **Web: studioProductionService.ts** — **FIXED.**  
   - Removed all updateProduct(..., { current_stock }). Stock is updated only via **stock_movements** insert; trigger_update_stock_from_movement updates products.current_stock.

2. **Web: AdjustStockDialog.tsx** — **FIXED.**  
   - Simple product: only createStockMovement(adjustment); removed updateProduct({ current_stock }). Trigger updates snapshot.

3. **Mobile: getProductByBarcodeOrSku** — **FIXED.**  
   - Now calls getProductStockFromMovements(companyId, productId, branchId) and sets product.stock. POS passes branchId for branch-scoped balance.

### Medium priority (APPLIED)

4. **Mobile: api/products.ts getProducts()** — **FIXED.**  
   - Stock is now from **stock_movements** only: one query for all product_ids, aggregate by (product_id, variation_id); variation stock and simple product stock set from that map. No product_variations.stock read.

5. **Mobile: getInventoryOverview-style API**  
   - Add an endpoint or client function that returns product list with movement-based stock (and optional branch filter) so mobile inventory/reports match web logic.

### Low priority

6. **Unify sale_items vs sales_items**  
   - Diagnostic shows both sale_items and sales_items columns (likely two tables or duplicate names). Ensure mobile and web use the same table name and RLS.

7. **Document and enforce rule**  
   - Add to coding standards: “Stock is read only from stock_movements (or from inventory_balance if documented). Do not read products.current_stock or product_variations.stock for display. Do not write current_stock/stock from application code; only insert/update stock_movements.”

---

## 8) How to re-run the diagnostic

```bash
# From repo root (requires .env.local with DATABASE_URL or DATABASE_POOLER_URL or DATABASE_ADMIN_URL)
node scripts/erp-inventory-diagnostic.js
# Output: docs/erp-inventory-diagnostic-results.json
```

Re-run after schema or trigger changes to refresh table/trigger/function and detection sections.

---

**End of report.** Use this document to align web and mobile inventory logic and to remove invalid direct use of `products.current_stock` / `product_variations.stock` in application code.
