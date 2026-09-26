# 2026-09-26 — Mobile stock rollup parity (VELVET / fabric)

## Problem

Web sale picker showed **VELVET SETECHABLE 0014 • Stock: ~52833** while mobile Sales fabric grid showed **Out of stock**.

Web ([`inventoryService.getInventoryOverview`](../../src/app/services/inventoryService.ts)) sums **all** `stock_movements` for `product_id`. Mobile [`getTotalProductStock`](../../erp-mobile-app/src/utils/productStockGate.ts) only summed **active** variations + orphan parent — qty on inactive `variation_id` keys was dropped.

## Fix

- [`sumProductStockFromKeyMap`](../../erp-mobile-app/src/utils/productStockFetch.ts) — sum bare `productId` + all `productId_*` keys
- `Product.totalStock` set in `getProducts` / barcode / by-id builders
- Picker gate/label uses `totalStock` when present
- Wired through AddProducts, FabricProductGrid, POSModule

Branch-scoped fetch unchanged (sale branch vs web “All branches” can still differ intentionally).

## Deploy

Commit + push; VPS ERP CACHEBUST rebuild `/m/`; hard refresh.

## QA

- VELVET SETECHABLE 0014: Stock ≈ web (same branch), selectable
- CUSTOM-* still Made to order
- True zero tracked SKU still Out of stock when negative stock off
