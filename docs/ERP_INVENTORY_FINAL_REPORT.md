# ERP Inventory Final Report

**Generated:** 2026-03-12  
**Implementation log:** `docs/ERP_SYSTEM_IMPLEMENTATION_LOG.md`

---

## 1. Schema snapshot

- **Source:** `docs/db_schema_snapshot.json`
- **Tables:** `products`, `product_variations`, `stock_movements`, `inventory_balance`, `purchases`, `purchase_items`, `sales`, `sale_items`
- **Products:** includes `current_stock` (numeric); app logic uses **stock_movements** as single source of truth; trigger `trigger_update_stock_from_movement` keeps `products.current_stock` in sync when present.
- **stock_movements:** has `product_id`, `variation_id`, `branch_id`, `quantity`, `movement_type`, `reference_type`, `reference_id`, `company_id`, `created_at`.

---

## 2. Trigger verification

- **Source:** `docs/db_triggers_snapshot.json`

| Trigger | Table | Role |
|--------|--------|------|
| `trigger_update_stock_from_movement` | stock_movements (INSERT) | Updates `products.current_stock` / variation stock from movement |
| `trigger_sync_inventory_balance_from_movement` | stock_movements (INSERT) | Syncs `inventory_balance` |
| `purchase_final_stock_movement_trigger` | purchases (INSERT/UPDATE) | Creates stock_movements when purchase is finalized |
| `trigger_update_stock_on_purchase` | purchases (INSERT/UPDATE) | Legacy stock update on purchase |
| `sale_final_stock_movement_trigger` | sales (UPDATE) | Creates stock_movements on sale |
| `trigger_update_stock_on_sale` | sales (INSERT/UPDATE) | Legacy stock update on sale |

**Conclusion:** Movement-based flow is in place; `trigger_update_stock_from_movement` is the canonical updater for product/variation stock from `stock_movements`.

---

## 3. Inventory health status

- **Source:** `docs/inventory_health_report.json`

| Check | Result |
|-------|--------|
| **Negative stock (by product)** | 5 products with negative movement sum (expected if oversold; no app bug) |
| **Negative stock (by variation)** | 7 variation-level negative totals |
| **Missing movements** | 6 active products with zero `stock_movements` rows (candidates for opening balance if needed) |
| **Invalid variations** | 0 movements referencing non-existent `product_variations` |
| **Movement vs column mismatch** | 11 products where `products.current_stock` ≠ SUM(`stock_movements.quantity`). **App and reporting use movement sum only;** column is legacy/sync. Run health check and optionally backfill column from movements if desired. |

---

## 4. Web vs mobile sync

- **Web:** `inventoryService.getInventoryOverview`, `inventoryService.getStock`, `productService.getLowStockProducts` use **stock_movements** only. No reads of `products.current_stock` or `product_variations.stock` for display. Studio production and AdjustStockDialog write only via `stock_movements`; Sales/Purchase contexts do not update `current_stock`.
- **Mobile:** `erp-mobile-app` `getProducts()`, `getProductByBarcodeOrSku()`, and inventory APIs use **stock_movements** (e.g. `stockMapFromMovements`, `getProductStockFromMovements`). No reliance on `product_variations.stock` or `products.current_stock` for stock display.
- **Conclusion:** Web and mobile both use **stock_movements** as single source of truth; sync is aligned.

---

## 5. Stock validation

- **Single stock API:** `inventoryService.getStock(companyId, productId, variationId?, branchId?)` returns SUM(quantity) from `stock_movements` (Phase 3).
- **Purchases:** Finalize creates movements via DB trigger; no app-level direct stock writes.
- **Sales:** Sale flow creates movements via DB trigger; no app-level direct stock writes.
- **Adjustments / studio:** All changes go through `stock_movements`; trigger updates product/variation columns when present.

---

## 6. Scripts and artifacts

| Script / artifact | Purpose |
|-------------------|--------|
| `npm run phase1-analysis` | Writes `db_schema_snapshot.json`, `db_triggers_snapshot.json`, `inventory_anomaly_report.json` |
| `npm run inventory-diagnostic` | Writes `erp-inventory-diagnostic-results.json` (schema, triggers, aggregates, anomalies) |
| `npm run inventory-health` | Writes `inventory_health_report.json` (negative stock, missing movements, invalid variations, column mismatch) |

---

## 7. Next steps (Phase 10)

- **Accounting:** Harden posting rules and reconciliation.
- **Performance:** Indexes on `stock_movements(company_id, product_id, variation_id, branch_id)` if not present; consider materialized view for dashboard.
- **AI/automation:** Optional reorder suggestions from movement-based low-stock and lead time.
