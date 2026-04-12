# 38. `sale_items` Migration and Read Retirement Plan

**Date:** 2026-04-12  
**Status:** No new writes (P1-2 + P1-2b); reads still present for backward compatibility; data migration not yet executed  
**Blocked until:** All `sale_items` read sites removed OR replaced with unified migration

---

## Table Disambiguation

| Table | Status | Role |
|-------|--------|------|
| `sale_items` (singular) | LEGACY — reads allowed, writes BLOCKED | Old sale line table; pre-canonical data |
| `sales_items` (plural) | CANONICAL | Current sale line table; all new writes go here |

---

## Write Sites Eliminated

### P1-2 (2026-04-12)
- `studioProductionService.ts` ~line 693-724: fallback changed from `sale_items` → `sales_items`
- `AccountingIntegrityLabPage.tsx` lines ~929-933, ~1122-1143: removed `sale_items` fallback reads/writes

### P1-2b (2026-04-12, this session)
- `StudioSaleDetailNew.tsx` line ~1702-1708: discovered undiscovered write site — INSERT fallback redirected from `sale_items` → `sales_items`; normalized payload (`unit_price` not `price`, dropped `is_studio_product`)
- `StudioSaleDetailNew.tsx` line ~1661-1666: UPDATE fallback to `sale_items` removed; hard-fail on `sales_items` update failure

---

## Remaining Read Sites (backward compat — acceptable until migration)

These reads exist for backward compat with historical records that only exist in `sale_items` (pre-canonical data). They follow a `try sales_items → fallback sale_items` pattern and are safe to leave until data migration.

| Service / Component | Location | Pattern | Notes |
|---------------------|----------|---------|-------|
| `saleService.ts` | 368, 378, 427, 460, 477, 487, 576, 703, 730, 1149 | try/fallback | Primary sale fetch paths — must remain until migration |
| `saleReturnService.ts` | 398, 686, 1021, 1036, 1039, 1051 | try/fallback | Return item validation — CRITICAL FK: `sale_return_items.sale_item_id` points to `sale_items.id` |
| `saleAccountingService.ts` | 351, 363 | try/fallback | Cost of revenue for GL |
| `accountingReportsService.ts` | 42, 993, 1045, 1091 | try/fallback | Profit reporting — reads both tables |
| `dashboardService.ts` | 47 | direct read | Dashboard top products — reads `sale_items` directly |
| `packingListService.ts` | 112, 130 | try/fallback | Packing list items |
| `studioProductionService.ts` | 381 | direct read | Read for backward compat (marked in code) |
| `studioCustomerInvoiceService.ts` | 116 | direct read | Studio invoice item fetch |
| `documentStockSyncService.ts` | 38 | direct read | Stock sync reads items |
| `bulkInvoiceService.ts` | 157 | direct read | Bulk invoice generation |
| `customerLedgerApi.ts` | 1373 | direct read | Customer ledger item detail |
| `accountingIntegrityLabService.ts` | 2022 | direct read | Integrity check tool |
| `SalesContext.tsx` | 1551 | try/fallback | Stock movement delta — reads current items before sale update |
| `ItemPurchaseTable.tsx` | 94, 103 | try/fallback | Customer ledger UI item detail |
| `StudioSaleDetailNew.tsx` | 1642, 1663 | try/fallback | Studio invoice line check |
| `CustomerLedgerPageOriginal.tsx` | 318, 328 | direct read | Legacy test page |
| `backupExport.ts` | 32 | full table backup | Export tool — reads all of `sale_items` |

**CRITICAL:** `saleReturnService.ts` line 1097 comment:
> `// CRITICAL: sale_item_id FK points to sale_items table only`
>
> `sale_return_items.sale_item_id` is a FK to `sale_items.id` — not `sales_items.id`. This FK must be remapped or the migration must preserve `sale_items.id` values in `sales_items`.

---

## Migration Shape

### Schema comparison (approximate)

| Column | `sale_items` | `sales_items` | Migration action |
|--------|-------------|---------------|-----------------|
| `id` | uuid PK | uuid PK | Must preserve — FK in `sale_return_items.sale_item_id` |
| `sale_id` | uuid FK | uuid FK | Copy directly |
| `product_id` | uuid | uuid | Copy directly |
| `product_name` | text | text | Copy directly |
| `sku` | text | text | Copy directly |
| `quantity` | numeric | numeric | Copy directly |
| `price` | numeric | — (use `unit_price`) | Rename to `unit_price` |
| `unit_price` | — | numeric | Populated from `price` |
| `total` | numeric | numeric | Copy directly |
| `discount` | numeric | numeric | Copy if column exists |
| `variation_id` | uuid | uuid | Copy if present |
| `is_studio_product` | boolean | — (absent) | Drop; no equivalent in `sales_items` |
| `company_id` | uuid | uuid | Copy directly |
| `created_at` | timestamptz | timestamptz | Copy directly |

---

## Data Migration SQL (non-destructive)

See: `scripts/sale_items_data_migration.sql` for the full migration.

Migration rules:
1. Insert only rows from `sale_items` where `sale_id` has NO matching rows in `sales_items` (avoid duplicates)
2. Preserve `id` values so FK references in `sale_return_items.sale_item_id` remain valid
3. Map `price` → `unit_price`
4. All inserts wrapped in a transaction with pre/post counts
5. `sale_items` table is NOT dropped in the migration — drop is a separate step after verification

---

## FK Blocker: `sale_return_items.sale_item_id`

Before `sale_items` can be dropped:
1. Migrate all `sale_return_items` rows so `sale_item_id` points to the corresponding `sales_items.id`
2. This requires inserting `sale_items` rows into `sales_items` with the same `id` (explicit UUID copy)
3. OR: add a new nullable column `sales_item_id` to `sale_return_items` and backfill it, then migrate the FK

**Recommended approach:** Insert `sale_items` rows into `sales_items` preserving `id`. Supabase allows explicit UUID inserts. After migration, the FK in `sale_return_items` naturally resolves to `sales_items`.

---

## Drop Sequence (when ready)

1. Run data migration (non-destructive insert into `sales_items`)
2. Verify: all `sale_id`s in `sale_items` have corresponding rows in `sales_items`
3. Verify: `sale_return_items.sale_item_id` FKs resolve to `sales_items.id` (or are NULL for old returns)
4. Remove all read fallback paths from the 16 service/component locations listed above
5. Drop `dashboardService.ts` direct read from `sale_items` (replace with `sales_items`)
6. Run `verify_sale_items_no_new_writes.sql` CHECK 3 → 0 rows (no sales with items ONLY in legacy)
7. Migration: `ALTER TABLE sale_return_items DROP CONSTRAINT IF EXISTS ...; ALTER TABLE sale_items RENAME TO sale_items_archived;`
8. Monitor for 1 week, then drop `sale_items_archived`

---

## Timeline Recommendation

| Step | Prerequisite | Estimated complexity |
|------|-------------|---------------------|
| Data migration (insert to sales_items) | VPS access; begin/commit script | Low |
| FK remapping (sale_return_items) | Data migration complete | Medium |
| Read path cleanup (16 locations) | FK remapping done | Medium |
| Table drop | All above + monitoring | Low |

**Do not drop `sale_items` without completing the FK remapping.** The FK constraint in `sale_return_items` will prevent drops anyway.
