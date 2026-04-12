# 44. `sale_items` — Execution-Ready Migration

**Date:** 2026-04-12  
**Base doc:** `38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT.md`  
**Status:** Migration script patched; execution-ready for VPS run; pre-flight scripts created

---

## Migration Script Assessment

**File:** `scripts/sale_items_data_migration.sql`

| Criterion | Status | Notes |
|-----------|--------|-------|
| Idempotent | ✅ | `ON CONFLICT (id) DO NOTHING` |
| Preserves IDs | ✅ | Explicit `si.id` in SELECT — critical for `sale_return_items` FK |
| `price → unit_price` | ✅ | `COALESCE(si.unit_price, si.price, 0)` |
| `company_id` fallback | ✅ | **PATCHED (P2):** `COALESCE(si.company_id, subquery from sales)` |
| Tax columns mapped | ✅ | **PATCHED (P2):** `discount_percentage`, `discount_amount`, `tax_percentage`, `tax_amount` with COALESCE defaults |
| Pre-flight checks | ✅ | 3 checks (A, B, E in pre-migration section) |
| Post-migration verify | ✅ | 3 verification queries |

### P2 Patch Applied to Migration Script

The legacy `sale_items` table in some environments lacks `company_id` (it wasn't in early schema versions). The script now derives it from the parent `sales` row:

```sql
COALESCE(si.company_id, (SELECT s.company_id FROM sales s WHERE s.id = si.sale_id)) AS company_id
```

Tax and discount columns are now also included in the INSERT, mapped from legacy single-value columns:
```sql
COALESCE(si.discount_percentage, 0) AS discount_percentage,
COALESCE(si.discount_amount, si.discount, 0) AS discount_amount,
COALESCE(si.tax_percentage, 0) AS tax_percentage,
COALESCE(si.tax_amount, si.tax, 0) AS tax_amount,
```

---

## FK Integrity: `sale_return_items.sale_item_id`

The FK `sale_return_items.sale_item_id REFERENCES sale_items(id)` was confirmed in migration `21_sale_returns_module.sql` with `ON DELETE SET NULL`.

**How the migration handles this:**
- The migration preserves `sale_items.id` values when inserting into `sales_items`
- After migration, `sale_return_items.sale_item_id` values resolve to `sales_items.id` (same UUIDs)
- The FK constraint itself still points to `sale_items(id)` — this is acceptable until a future `ALTER TABLE` remaps it

**Edge case (documented):**
The migration skips sale_ids that already have rows in `sales_items`. If a skipped sale_id has return items in `sale_return_items`, those return items' `sale_item_id` values point to `sale_items.id` rows that were NOT copied. This produces FK orphans after any future `sale_items` drop.

Run `verify_sale_return_item_fk_integrity_after_migration.sql` CHECK 2 and CHECK 4 to identify and manually resolve these cases before proceeding to rename.

---

## Pre-Migration Checklist (Run on VPS)

**File:** `scripts/system-audit/verify_sale_items_post_migration_readiness.sql`

```
Check A: legacy_only_sale_ids → how many sales need migration
Check B: age distribution → understand data scope  
Check C: company_id availability → confirm COALESCE path is needed
Check D: id_collisions = 0 → MUST be 0, otherwise investigate
Check E: column existence → confirm sales_items has all target columns
Check F: row counts → baseline for before/after comparison
```

**Gate:** All checks must pass (especially D = 0) before executing the migration.

---

## Execution Steps (VPS)

```bash
# 1. Run pre-flight checks
psql -c "\i scripts/system-audit/verify_sale_items_post_migration_readiness.sql"

# 2. Confirm Check D = 0 (id_collisions)
# 3. Review Check A count (confirm scope is expected)

# 4. Execute migration
psql -c "\i scripts/sale_items_data_migration.sql"
# Expected output: NOTICE messages with row counts
# The BEGIN/COMMIT means it's all-or-nothing

# 5. Run post-migration verification
psql -c "\i scripts/system-audit/verify_sale_return_item_fk_integrity_after_migration.sql"
# SUCCESS: unresolved (Check 1) = 0
```

---

## Post-Migration: Low-Risk Fallback Removal

After migration is confirmed on VPS, these fallbacks can be safely removed (they guard against pre-migration data being missing from `sales_items`):

| File | Line | Action |
|------|------|--------|
| `dashboardService.ts` | ~47-50 | Remove `sale_items` fallback branch |
| `accountingIntegrityLabService.ts` | ~2022-2026 | Remove `sale_items` fallback |
| `studioCustomerInvoiceService.ts` | ~116-126 | Remove `sale_items` fallback |

Deploy as a single PR after verification. These files all already try `sales_items` first — just remove the else-branch.

---

## Read Sites Still Blocked (Require FK Remapping)

These fallbacks CANNOT be removed until `sale_return_items.sale_item_id` FK is remapped to `sales_items(id)`:

| File | Why blocked |
|------|-------------|
| `saleReturnService.ts` | Reads `sale_items` to validate return quantities; FK dependency |
| `saleService.ts` | Fetches line items for existing sales; some sales only in `sale_items` |
| `customerLedgerApi.ts` | Reads items for ledger display; depends on sale_id resolution |
| `bulkInvoiceService.ts` | Production document generation; must be conservative |

---

## Next Step: FK Remap Migration (Future)

After 30-day monitoring:
```sql
-- Drop old FK
ALTER TABLE sale_return_items DROP CONSTRAINT sale_return_items_sale_item_id_fkey;
-- Add new FK pointing to canonical table
ALTER TABLE sale_return_items ADD CONSTRAINT sale_return_items_sale_item_id_fkey
  FOREIGN KEY (sale_item_id) REFERENCES sales_items(id) ON DELETE SET NULL;
```

Run `verify_sale_return_item_fk_integrity_after_migration.sql` CHECK 5 → must show 'READY FOR FK REMAP' before executing.
