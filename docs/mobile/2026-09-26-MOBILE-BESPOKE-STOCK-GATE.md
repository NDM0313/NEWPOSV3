# 2026-09-26 — Mobile bespoke / non-tracked stock picker gate

## Problem

Mobile Sales Add Items showed **CUSTOM-BRIDAL / CUSTOM-CASUAL** as **Out of stock** and blocked add-to-cart when company negative stock was off. Web allows picking these SKUs; stock posting is deferred (`track_stock = false`, bespoke generic parents).

Sep 16 paging fix addressed tracked-catalog under-count, not bespoke exemption.

## Fix

- [`erp-mobile-app/src/utils/productStockGate.ts`](../../erp-mobile-app/src/utils/productStockGate.ts) — `isPickerStockGateExempt` / `isProductSaleBlockedByStock`; label **Made to order**
- Products API selects `track_stock` and maps `trackStock`
- Wired in `AddProducts`, `FabricProductGrid`, `POSModule`

## Deploy

VPS ERP regenerates `/m/` via `deploy/vps-build-erp-only.sh` (CACHEBUST). Hard refresh `https://erp.dincouture.pk/m/`.

## QA

- CUSTOM-* cards: Made to order, tappable on Final sale
- Tracked SKU at 0 stock: still Out of stock when negative stock disallowed
- In-stock tracked SKU qty matches web
