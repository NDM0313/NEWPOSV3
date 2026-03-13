# ERP Bugfix: Repeated Global Loads / Slow UI

**Date:** 2026-03-13  
**Issue:** Console showed repeated loads and "already exists" timer warnings: loadAllSettings started multiple times, "Timer 'loadAllSettings' already exists", "inventoryOverview:parallel already exists", "stockMovements:<id> already exists". This indicated overlapping async loads and slow UI.

---

## Root cause

1. **loadAllSettings (SettingsContext):** The effect runs when `loadAllSettings` (or companyId/branchId/user) changes. Multiple triggers (e.g. rapid context updates or StrictMode) could start a second load before the first finished. `console.time('loadAllSettings')` was then called again before `console.timeEnd`, causing "Timer 'loadAllSettings' already exists".

2. **getInventoryOverview (inventoryService):** Multiple callers (ProductsPage, Dashboard, SaleForm, PurchaseForm, etc.) could call it with the same companyId/branchId concurrently. Each call used `console.time('inventoryOverview:parallel')`, so overlapping calls triggered "inventoryOverview:parallel already exists".

3. **getStockMovements (productService):** Opening the same product's stock ledger twice or rapid re-opens could start two requests for the same productId. Both used `console.time(\`stockMovements:${productId}\`)`, causing "stockMovements:<id> already exists".

---

## Fix

1. **SettingsContext.loadAllSettings**
   - Added `loadAllSettingsInProgressRef` (useRef). At the start of `loadAllSettings`, if the ref is true, return immediately. Otherwise set it true. In `finally` (and on early return when !companyId), set it false. Only one load runs at a time.

2. **inventoryService.getInventoryOverview**
   - Module-level map `inventoryOverviewInFlight` keyed by `${companyId}:${branchId ?? 'all'}`. If a promise exists for that key, return it. Otherwise create a promise that calls a new inner implementation `_getInventoryOverviewInner(companyId, branchId)`, store the promise in the map, and delete the key in a `finally` when the promise settles. Overlapping calls for the same company/branch get the same promise and no duplicate timers.

3. **productService.getStockMovements**
   - Module-level map `stockMovementsInFlight` keyed by `${productId}:${companyId}:${variationId}:${branchId}`. If a promise exists for that key, return it. Otherwise create a promise that calls `_getStockMovementsInner(...)`, store it, and delete the key in `finally`. Overlapping calls for the same product/params get the same promise and no duplicate timers.

---

## Files changed

- `src/app/context/SettingsContext.tsx`: added `useRef`, `loadAllSettingsInProgressRef`, guard at top of `loadAllSettings`, clear ref on early return and in `finally`.
- `src/app/services/inventoryService.ts`: added `inventoryOverviewInFlight` Map, `getInventoryOverview` delegates to cached promise, new `_getInventoryOverviewInner` with the original body.
- `src/app/services/productService.ts`: added `stockMovementsInFlight` Map, `getStockMovements` delegates to cached promise, new `_getStockMovementsInner` with the original body.

---

## Verification

- Reload app and watch console: "Timer 'loadAllSettings' already exists" and "inventoryOverview:parallel already exists" / "stockMovements:... already exists" should no longer appear when multiple components request the same data.
- Settings, inventory overview, and product stock ledger should still load correctly; repeated requests for the same scope reuse the in-flight promise.

---

## Rollback

Revert the three files: remove ref and guard from SettingsContext; remove Map and inner method from inventoryService and productService, restoring the original single-method implementations.
