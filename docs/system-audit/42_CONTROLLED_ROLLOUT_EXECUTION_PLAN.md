# 42. Controlled Rollout Execution Plan

**Date:** 2026-04-12  
**Precondition:** Hardening pass (P1-1 through P1-5) and stabilization-verification (docs 35–41) are complete. Build passes. No new writes to `sale_items`. All `workers.current_balance` write sites removed.

---

## Overview: What Needs Executing

| Item | Risk | Downtime | Blocking others |
|------|------|----------|-----------------|
| Purchase return numbering finalization (seed sequence + code) | Low | None | Nothing |
| Historical purchase return JE repair | Medium | None (additive) | Should run before reporting |
| `sale_items` pre-flight checks | None | None | Must pass before migration |
| `sale_items` data migration | Medium | None (non-destructive) | Fallback removal |
| `sale_items` fallback read removal | Low | None | Table drop |
| Worker balance label confirmation | None | None | Nothing |
| `sale_items` table rename/drop | High | Requires staging sign-off | Nothing |

---

## Stage 1 — Staging Verification (Run First)

Run all 7 SQL audit scripts on VPS/staging. Each has a success criterion.

### 1.1 Order of scripts

| # | Script | Run condition | Pass = |
|---|--------|---------------|--------|
| 1 | `verify_purchase_return_journal_integrity_post_patch.sql` | First | gap_count = 0 for all companies |
| 2 | `verify_historical_purchase_returns_missing_je.sql` | After #1 | 0 rows (or assess repair scale) |
| 3 | `verify_sale_items_no_new_writes.sql` | Any time | 0 new rows after 2026-04-12 |
| 4 | `verify_worker_balance_cache_vs_gl.sql` | Any time | Informational — document drift |
| 5 | `verify_studio_v3_block_readiness.sql` | Any time | 0 completions after 2026-04-12 |
| 6 | `verify_purchase_return_numbering_post_patch.sql` | Any time | See format distribution |
| 7 | `verify_gl_vs_operational_spotcheck.sql` | Last | 0 imbalanced JEs, 0 orphan lines |

### 1.2 Decision gates

**If script #1 returns gap_count > 0:**
→ Historical repair is mandatory before production sign-off. Run `scripts/repair_purchase_return_missing_journal_entries.sql` per doc 35 Section 2.

**If script #3 returns new_writes > 0 after 2026-04-12:**
→ STOP. A write site was missed. Identify origin. Do NOT proceed to migration.

**If script #7 returns imbalanced JEs > 0:**
→ Investigate those specific JEs before any further GL-touching changes.

---

## Stage 2 — Historical Purchase Return JE Repair

**Only needed if** script #1 shows gap_count > 0.

### 2.1 Procedure
1. Run `verify_historical_purchase_returns_missing_je.sql` CHECK 2 (per-company scale)
2. For each affected company, get AP and Inventory account IDs from CHECK 3 and CHECK 4
3. Execute `scripts/repair_purchase_return_missing_journal_entries.sql` BLOCK A per return
4. Re-run `verify_purchase_return_journal_integrity_post_patch.sql` CHECK 1 → must be 0

**Rollback:** Each BLOCK A is wrapped in `BEGIN/COMMIT`. Set `is_void = TRUE` on any wrongly-posted JE using the fingerprint.

**Business risk:** Zero-downtime. Additive operation (INSERT only). No existing records modified.

---

## Stage 3 — Purchase Return Numbering Change

**Deploy order matters:** Seed first, then deploy code. Never deploy code before seeding.

### 3.1 Step 1: Deploy migration on VPS

Run `migrations/purchase_return_sequence_finalization.sql`:
- Patches `erp_document_default_prefix()` to map `PURCHASE_RETURN → PRET-`
- Seeds `purchase_return` sequences for all companies that have a `purchase` sequence

```bash
# On VPS, connect to Supabase SQL editor or psql:
\i migrations/purchase_return_sequence_finalization.sql
```

**Verify immediately:**
```sql
SELECT document_type, prefix, COUNT(*) FROM erp_document_sequences
WHERE document_type IN ('purchase', 'purchase_return')
GROUP BY document_type, prefix;
-- Expected: purchase_return rows with prefix='PRET-'
```

### 3.2 Step 2: Deploy code change

Deploy `purchaseReturnService.ts` with `'purchase_return'` type. Deploy `documentNumberService.ts` with updated `ErpDocumentType` union.

### 3.3 Step 3: Verify new number format

Create one test purchase return. Confirm `return_no` is `PRET-NNNN`, not `PUR-NNNN` or `PRET-YYYYMMDD-XXXX`.

Run `verify_purchase_return_numbering_post_patch.sql` CHECK 4 → format should show `dedicated-sequence`.

**Rollback:** If sequence seeding failed and code is deployed, the fallback in `generateReturnNumber()` activates: returns `PRET-YYYYMMDD-XXXX`. Acceptable as a temporary fallback — does not break the system. Revert code and re-seed.

**Business risk:** Zero-downtime. Existing `PUR-NNNN` numbers on historical returns are unchanged.

---

## Stage 4 — `sale_items` Data Migration

**Precondition:** Script #3 shows 0 new writes.

### 4.1 Pre-flight (run on VPS before migration)

Run `scripts/system-audit/verify_sale_items_post_migration_readiness.sql`:
- Check A (legacy-only sales) must be assessed — if many, migration will take time
- Check B (`company_id` missing) determines if COALESCE path is needed
- Check E (ID collisions) must be 0 before proceeding

### 4.2 Execute migration

```bash
# On VPS psql:
\i scripts/sale_items_data_migration.sql
```

The script is wrapped in `BEGIN/COMMIT`. If it fails, it rolls back automatically.

### 4.3 Post-migration verification

Run `scripts/system-audit/verify_sale_return_item_fk_integrity_after_migration.sql`:
- `unresolved` (Check 1) must be 0 after migration
- Any non-zero value means some `sale_return_items` have FKs pointing to `sale_items` rows that weren't migrated → investigate before removal

**Rollback:** Migration is insert-only. If verification fails, roll back by deleting the migrated rows:
```sql
DELETE FROM sales_items WHERE id IN (SELECT id FROM sale_items);
-- Note: be careful — this also deletes any rows that were already in sales_items with matching IDs
-- Prefer: DELETE FROM sales_items WHERE id IN (SELECT sis.id FROM sales_items sis JOIN sale_items si ON si.id = sis.id WHERE sis.created_at >= '<migration_start_time>');
```

**Business risk:** Zero-downtime. Inserts only. `sale_items` unchanged. No FK remapping yet.

### 4.4 Fallback removal (after confirmed migration)

Only after migration is confirmed on VPS:
1. Remove `sale_items` fallback branch from `dashboardService.ts` ~line 47-50
2. Remove `sale_items` fallback from `accountingIntegrityLabService.ts` ~line 2022-2026
3. Remove `sale_items` fallback from `studioCustomerInvoiceService.ts` ~line 116-126
4. These changes can be deployed as a single PR

**Not yet removable:**
- `saleService.ts` fallbacks — depends on FK remapping
- `saleReturnService.ts` fallbacks — hard FK dependency

---

## Stage 5 — Worker Balance Source Confirmation

No DB migration needed. The worker balance architecture is formally a dual-source model (doc 45). Ensure:
- Studio Workflow page shows operational pending with disclaimer ✓ (already done)
- Worker Detail page shows GL-based balance ✓ (already done)
- No single screen claims both are equal

---

## Stage 6 — Legacy Table Retirement (Future Phase)

**Do NOT execute in this phase. Document blockers only.**

`sale_items` cannot be renamed/dropped until:
1. ✅ Data migration verified on VPS
2. ✅ `sale_return_items.sale_item_id` FK remapped to `sales_items.id` (requires separate ALTER TABLE migration)
3. ✅ All read fallbacks removed (16 locations)
4. ✅ 30-day monitoring period with 0 errors

**Rename sequence when ready:**
```sql
ALTER TABLE sale_items RENAME TO sale_items_archived_20260412;
-- 30 days later:
DROP TABLE sale_items_archived_20260412;
```

---

## Rollback Reference

| Stage | What breaks | Rollback |
|-------|-------------|----------|
| Stage 3 — migration deployed, code not deployed | Nothing | Nothing needed |
| Stage 3 — code deployed, migration not deployed | Return numbers use PRET-YYYYMMDD-XXXX fallback | Acceptable; seed migration ASAP |
| Stage 4 — migration fails mid-way | Auto-rollback (BEGIN/COMMIT) | Re-run after fixing column issue |
| Stage 4 — verification fails | No production impact | Delete migrated rows + investigate |
| Stage 4 — fallback removal deployed prematurely | Pre-migration sales show missing items | Revert PR immediately |

---

## Business Downtime Risk Summary

| Change | Downtime required |
|--------|------------------|
| Purchase return JE repair | None |
| Sequence migration | None (adds rows only) |
| Code deployment (numbering) | Zero-downtime deploy |
| `sale_items` data migration | None |
| Fallback read removal | None (after migration confirmed) |
| `sale_items` FK remap | Requires ALTER TABLE — brief lock, table must be lightly used |
| `sale_items` drop | Brief lock; must be off-peak |
