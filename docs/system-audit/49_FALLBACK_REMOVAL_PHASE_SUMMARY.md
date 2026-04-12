# 49. Fallback Removal Phase — Summary

**Date:** 2026-04-13  
**Build result:** ✅ SUCCESS — 0 TypeScript errors, 4407 modules transformed, built in 17.84s  
**Phase scope:** Remove all `sale_items` read/write fallbacks from service code; fix inverted read ordering bug; create FK remap migration.

---

## Build Verification

```
vite v6.3.5 building for production...
✓ 4407 modules transformed.
✓ built in 17.84s
```

No new warnings introduced. Pre-existing dynamic import and chunk size warnings unchanged.

---

## Source Files Changed

| File | Change |
|------|--------|
| `src/app/services/saleService.ts` | Fixed inverted read order (line ~487): now tries `sales_items` first, `sale_items` fallback |
| `src/app/services/saleService.ts` | Removed INSERT write fallback to `sale_items` (line ~374–383): frozen writes enforcement |
| `src/app/services/dashboardService.ts` | Removed `sale_items` else fallback block |
| `src/app/services/accountingIntegrityLabService.ts` | Removed `sale_items` fallback in `fetchSaleLineItemsForLab()` |
| `src/app/services/studioCustomerInvoiceService.ts` | Removed `sale_items` else fallback block |
| `src/app/context/SalesContext.tsx` | Removed `sale_items` else fallback block (stock movement on status change) |
| `src/app/services/saleReturnService.ts` | Removed `sale_items` else fallback in `voidSaleReturn()` |
| `src/app/services/bulkInvoiceService.ts` | Removed `sale_items` else fallback in `createFromPackingLists()` |
| `src/app/services/documentStockSyncService.ts` | Removed `sale_items` fallback in `fetchSaleLines()` |
| `src/app/services/packingListService.ts` | Removed `sale_items` else fallback in `createFromSale()` |

---

## New Files Created

| File | Purpose |
|------|---------|
| `migrations/sale_return_items_fk_remap.sql` | Remaps `sale_return_items.sale_item_id` FK from `sale_items(id)` → `sales_items(id)` |

---

## What Was Discovered During Exploration

The previously documented "Group-2 direct reads" were not actually direct — most already had `sales_items` as primary with `sale_items` as fallback. The real issues found were:

1. **Inverted read bug** in `saleService.ts:getSaleById()` — the secondary fetch tried `sale_items` first, `sales_items` second (backwards). Fixed.
2. **Write fallback** in `saleService.ts:createSale()` — an INSERT to `sale_items` on 42P01 error. Dead code since `sales_items` always exists, but contradicts the P1-2 write freeze. Removed.
3. **All result-based fallbacks** (4 Group-1 + 4 Group-2) — fire when `sales_items` returns no rows (historical pre-migration records). Removed; all data now in `sales_items`.

---

## What Was NOT Changed (kept intentionally)

### Error-based 42P01 fallbacks — kept, not removed

These fire only if `sales_items` table literally does not exist (schema error code 42P01). They are dead code since `sales_items` exists, but they are schema-safety nets that have zero runtime cost.

| File | Lines | Function | Why kept |
|------|-------|----------|----------|
| `saleService.ts` | ~427 | `createSale()` | 42P01 on join select — never fires |
| `saleService.ts` | ~477 | `getSaleById()` | 42P01 on main select — never fires |
| `saleService.ts` | ~576 | `getStudioSales()` | 42P01 on sale list — never fires |
| `saleService.ts` | ~730–732 | `getStudioSales()` pagination | 42P01 on runQuery — never fires |
| `saleReturnService.ts` | ~398 | `finalizeSaleReturn()` | 42P01 on return validation — never fires |
| `saleReturnService.ts` | ~1039 | `getOriginalSaleItems()` | 42P01 on return form load — never fires |

These can be cleaned up in a future maintenance pass once `sale_items` table is confirmed dropped.

---

## What Remains Before `sale_items` Can Be Dropped

1. **⏳ Deploy `migrations/purchase_return_sequence_finalization.sql`** on VPS
2. **⏳ Run `scripts/sale_items_data_migration.sql`** on VPS (requires DBA)
3. **⏳ Verify** `verify_sale_return_item_fk_integrity_after_migration.sql` Check 1 = 0
4. **⏳ Deploy `migrations/sale_return_items_fk_remap.sql`** on VPS (after Check 1 = 0)
5. **⏳ 30-day monitoring** — confirm `sale_items` receives 0 new rows after all above
6. **⏳ Drop `sale_items`** — rename to `sale_items_archived` first as safety net

---

## Legacy Read Audit — Final State

| Table | Reads remaining | Writes remaining |
|-------|----------------|-----------------|
| `sale_items` | Error-based 42P01 fallbacks only (6 dead paths) | 0 (all removed across P1-2, P1-2b, this phase) |
| `sales_items` | All active paths | All active paths |
| `sale_return_items.sale_item_id` | FK still references `sale_items(id)` | FK remap migration ready, not yet deployed |
