# Mobile stock rollup parity (sales/POS vs web inventory)

**Date:** 2026-10-22  
**Status:** Restored on current `main` working tree (re-applied from `5bb0049b`, which was not an ancestor of HEAD).

## Problem

Sales/POS fabric grids showed **Out of stock** while web inventory / mobile Inventory module showed on-hand qty. Qty often sat on **inactive** (or unloaded) `stock_movements.variation_id` keys. The picker only summed **active variations + orphan parent**.

## Fix

| Piece | Role |
|-------|------|
| `sumProductStockFromKeyMap` in `erp-mobile-app/src/utils/productStockFetch.ts` | SUM `productId` + `productId_*` keys |
| `Product.totalStock` from `getProducts` / `buildProductFromRow` | Web-parity rollup |
| `getTotalProductStock` in `productStockGate.ts` | Prefer `totalStock` when finite |
| Fabric / POS DTOs | Pass `totalStock` through |
| `AddProducts` load | **Must** use `mapApiProductToFabricPicker` — never hand-map without `totalStock` (2026-10-22 regression: DIN CHINA TAIBO showed Out of stock while API had rollup) |
| Company switch | `invalidateProductsListCache(companyId)` so 5‑minute list cache cannot keep pre-fix shapes |

Still **movements-first** per [`docs/infra/ERP_DISPLAY_LOCKED.md`](../infra/ERP_DISPLAY_LOCKED.md). Do not switch grids to `inventory_balance` when movements exist.

## Related chrome fix (same session)

Sidebar + sync bar show **active `companyName`** (e.g. DIN CHINA), not hardcoded “Din Collection”. Login brand title unchanged.

## Manual check (DIN CHINA)

After hard refresh: Sales → TAIBO `0017-1` should show stock near web (~9914), not “Out of stock”. Inventory module should still match.
