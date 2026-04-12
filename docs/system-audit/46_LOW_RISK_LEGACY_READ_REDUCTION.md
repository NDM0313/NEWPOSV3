# 46. Low-Risk Legacy `sale_items` Read Reduction

**Date:** 2026-04-12  
**Status:** 1 code change made (`backupExport.ts`); remaining fallbacks documented with status

---

## Changes Made This Session

### `src/app/utils/backupExport.ts` — line 32

**Before:**
```typescript
backup.sale_items = await fetchTable('sale_items', companyId, 'company_id').catch(() => []);
```

**After:**
```typescript
// P2: Export canonical sales_items; also keep legacy sale_items for any pre-migration historical data
backup.sales_items = await fetchTable('sales_items', companyId, 'company_id').catch(() => []);
backup.sale_items_legacy = await fetchTable('sale_items', companyId, 'company_id').catch(() => []);
```

**Rationale:** The backup export now captures both tables. The canonical `sales_items` key is used for the primary backup. The legacy `sale_items` is also captured (renamed key to `sale_items_legacy`) so historical data is not lost from backups. After data migration and table rename, the `sale_items_legacy` fetch will return empty (the table will be renamed/dropped) and the `.catch(() => [])` handles that gracefully.

---

## Read Sites Status — Full Inventory

### Group 1: Already try/fallback — Fallback Removal After Migration

These already try `sales_items` first. The `sale_items` fallback is still needed until VPS migration is confirmed. Remove fallbacks as a batch PR after migration verification.

| File | Line | Current pattern | When to remove fallback |
|------|------|----------------|------------------------|
| `dashboardService.ts` | ~39-50 | Try `sales_items` → fallback `sale_items` | After VPS migration confirmed |
| `accountingIntegrityLabService.ts` | ~2020-2026 | Try `sales_items` → fallback `sale_items` | After VPS migration confirmed |
| `studioCustomerInvoiceService.ts` | ~110-126 | Try `sales_items` → fallback `sale_items` | After VPS migration confirmed |
| `SalesContext.tsx` | ~1543-1554 | Try `sales_items` → fallback `sale_items` | After VPS migration confirmed |

**Why not now:** Removing these fallbacks before migration would cause historical sale records (that only exist in `sale_items`) to show empty line items. That would break invoice reprinting, reports, and ledger detail for pre-migration sales.

### Group 2: Direct reads (no try/fallback) — Requires FK Remap

These read `sale_items` directly and are in production-critical paths.

| File | Line | Read type | Blocked by |
|------|------|-----------|-----------|
| `saleService.ts` | 378, 427, 477, 487, 576 | Fallback inside getSaleById / getSales | Full migration + FK remap |
| `saleService.ts` | 730, 732 | runQuery with 'sale_items' param | Full migration + FK remap |
| `saleReturnService.ts` | 398, 686, 1039 | Return quantity validation | FK remapping (sale_return_items.sale_item_id) |
| `customerLedgerApi.ts` | 1373 | Line item detail for ledger | Full migration |
| `bulkInvoiceService.ts` | 157 | Bulk invoice item fetch | Full migration |
| `documentStockSyncService.ts` | 38 | Stock sync item fetch | Full migration |
| `packingListService.ts` | 130 | Packing list items | Full migration |
| `saleService.ts` | 1149 | Sale line items for stock | Full migration |

**Why not now:** These paths are in core transaction processing. Removing `sale_items` reads before all data is in `sales_items` would silently produce wrong stock calculations, missing invoice lines, and incorrect ledger balances.

### Group 3: Admin/test tools — Low risk, can switch after migration

| File | Line | Read type | Action |
|------|------|-----------|--------|
| `accountingIntegrityLabService.ts` | 2022 | Already try/fallback | Remove fallback after migration |
| `CustomerLedgerPageOriginal.tsx` | 318, 328 | Test page only | Remove after migration |
| `StudioSaleDetailNew.tsx` | 1642, 1663 | Check for existing studio line | Already try/fallback |

### Group 4: Backup/export — Changed this session

| File | Line | Change |
|------|------|--------|
| `backupExport.ts` | 32 | ✅ Changed to `sales_items` primary + `sale_items_legacy` secondary |

---

## Recommended Post-Migration Batch PR

After VPS migration verification (verify_sale_return_item_fk_integrity_after_migration.sql CHECK 1 = 0):

1. `dashboardService.ts` — remove `sale_items` fallback block
2. `accountingIntegrityLabService.ts` — remove `sale_items` fallback block
3. `studioCustomerInvoiceService.ts` — remove `sale_items` fallback block
4. `SalesContext.tsx` — remove `sale_items` fallback block
5. `CustomerLedgerPageOriginal.tsx` — change to `sales_items` only (test page)

Deploy as single PR. Run `verify_sale_items_no_new_writes.sql` after to confirm `sale_items` row count is stable.

---

## What Remains After This Session

| Item | Status |
|------|--------|
| `backupExport.ts` | ✅ Done |
| Group 1 fallback removal | Pending VPS migration |
| Group 2 direct read removal | Pending FK remap |
| `saleReturnService.ts` FK resolution | Blocked until FK remap migration |
| `sale_items` table rename | Blocked until all above + 30 days |
