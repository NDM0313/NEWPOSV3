# 48. Controlled Rollout Phase — Summary

**Date:** 2026-04-12  
**Build result:** ✅ SUCCESS — 0 TypeScript errors, 4407 modules transformed, built in 17.64s  
**Phase scope:** Operational execution of pending items from the stabilization-verification phase (docs 35–41)

---

## Build Verification

```
vite v6.3.5 building for production...
✓ 4407 modules transformed.
✓ built in 17.64s
```

Warnings present (pre-existing, not introduced this session):
- Dynamic import warning for `supabase.ts` (pre-existing bundler artifact)
- Chunk size warning for `index.js` 3327 kB (pre-existing — vendor bundle)

No TypeScript errors. No new warnings introduced.

---

## Source Files Changed

| File | Change | Task |
|------|--------|------|
| `src/app/services/documentNumberService.ts` | Added `'purchase_return'` to `ErpDocumentType` union | Task 2 |
| `src/app/services/purchaseReturnService.ts` | Changed `'purchase'` → `'purchase_return'` in `generateReturnNumber()` | Task 2 |
| `src/app/components/purchases/PurchasesPage.tsx` | Standardized fallback prefix `PR-` → `PRET-` (line 1281) | Task 2 |
| `src/app/utils/backupExport.ts` | Export from `sales_items` (canonical) + retain `sale_items_legacy` | Task 5 |
| `scripts/sale_items_data_migration.sql` | Patched `company_id` COALESCE + added tax/discount columns | Task 3 |

---

## Docs Updated

| File | Change | Task |
|------|--------|------|
| `docs/system-audit/27_LEGACY_ISOLATION_PLAN.md` | `sale_items` status updated; P1-2b evidence added; retirement blockers sequenced | Task 6 |
| `docs/system-audit/31_P1_DOCUMENT_NUMBERING_UNIFICATION.md` | Status → P2 COMPLETE; code block updated to `purchase_return`; notes added | Task 6 |

---

## New Files Created

### Migrations

| File | Purpose |
|------|---------|
| `migrations/purchase_return_sequence_finalization.sql` | Patch `erp_document_default_prefix()` with PRET- case; seed `purchase_return` sequences |

### SQL Verification Scripts

| File | Purpose |
|------|---------|
| `scripts/system-audit/verify_sale_items_post_migration_readiness.sql` | 6 pre-migration checks (legacy-only rows, ID collision, column existence, row counts) |
| `scripts/system-audit/verify_sale_return_item_fk_integrity_after_migration.sql` | 5 FK integrity checks post-migration (unresolved FKs, at-risk return items, remap readiness) |

### Docs

| File | Covers |
|------|--------|
| `docs/system-audit/42_CONTROLLED_ROLLOUT_EXECUTION_PLAN.md` | Operational execution order: staging verification → numbering → migration → fallback removal → legacy retirement |
| `docs/system-audit/43_PURCHASE_RETURN_NUMBERING_IMPLEMENTATION.md` | Complete numbering change record: type extension, prefix function, sequence seed, verification |
| `docs/system-audit/44_SALE_ITEMS_EXECUTION_READY_MIGRATION.md` | Migration script assessment, FK integrity details, execution gates, post-migration fallback removal plan |
| `docs/system-audit/45_WORKER_BALANCE_TRUTH_DECISION.md` | Formal dual-source architecture decision: operational ledger vs GL account 2010 |
| `docs/system-audit/46_LOW_RISK_LEGACY_READ_REDUCTION.md` | Per-site inventory of 16 `sale_items` read locations with group classification and removal conditions |
| `docs/system-audit/47_AUTHORITATIVE_DOC_REFRESH.md` | Records which authoritative docs were updated and which old claims were retired |
| `docs/system-audit/48_CONTROLLED_ROLLOUT_PHASE_SUMMARY.md` | This file |

---

## Status of Each Major Deliverable

### 1. Purchase Return Numbering — ✅ CODE COMPLETE; VPS MIGRATION PENDING

**What's done:**
- `'purchase_return'` added to `ErpDocumentType` — TypeScript accepts the type
- `generateReturnNumber()` now calls `'purchase_return'` sequence (was interim `'purchase'`)
- `erp_document_default_prefix()` function patched to return `'PRET-'` for `PURCHASE_RETURN`
- `erp_document_sequences` seeding written (will auto-create PRET- sequences for all existing company/branch combos)
- Fallback prefix standardized to `PRET-` across all three locations in `PurchasesPage.tsx`

**What remains:**
- Deploy `migrations/purchase_return_sequence_finalization.sql` on VPS (requires psql access)
- After deploy: verify with `verify_purchase_return_numbering_post_patch.sql` (pre-existing script)

**Risk if not deployed:** First purchase return created after code deploy but before migration deploy will auto-create a `purchase_return` sequence with the correct prefix (the RPC auto-creates if not found). No data loss. Low risk.

---

### 2. `sale_items` Migration — ✅ EXECUTION-READY; VPS EXECUTION PENDING

**What's done:**
- Migration script `scripts/sale_items_data_migration.sql` patched:
  - `company_id` now uses `COALESCE(si.company_id, (SELECT s.company_id FROM sales s WHERE s.id = si.sale_id))` — handles legacy rows without the column
  - Tax/discount columns added: `discount_percentage`, `discount_amount`, `tax_percentage`, `tax_amount` (all with COALESCE defaults)
- Pre-migration readiness script created (6 checks including ID collision check — MUST be 0)
- Post-migration FK integrity script created (5 checks including unresolved FK count — MUST be 0 before fallback removal)
- All 16 read sites documented and classified (Groups 1–4)
- `backupExport.ts` now exports from `sales_items` as primary

**What remains:**
- Run `verify_sale_items_post_migration_readiness.sql` on VPS staging first (confirm Check D = 0)
- Execute `scripts/sale_items_data_migration.sql` on VPS (requires DBA access)
- Run `verify_sale_return_item_fk_integrity_after_migration.sql` to confirm Check 1 = 0
- Batch PR: remove Group-1 fallbacks (4 sites: `dashboardService.ts`, `accountingIntegrityLabService.ts`, `studioCustomerInvoiceService.ts`, `SalesContext.tsx`)

**Risk if migration not run:** Historical sale records (pre-migration) will continue to display correctly because all read sites retain `sale_items` fallbacks. Zero user-facing breakage until fallbacks are removed.

---

### 3. Worker Balance Source-of-Truth — ✅ FORMALLY RESOLVED

**Decision:** Dual-source architecture is intentional — not a bug, not a gap to close.

| Context | Source | Label |
|---------|--------|-------|
| Studio workflow / pipeline | `worker_ledger_entries` | "Studio Due" / "Pending Stages" |
| Finance / accounting | GL account 2010 | "GL Payable" / "Accounting Payable" |
| Worker detail page | GL primary, ledger fallback | "Remaining Due (Payable)" |
| Contacts page (Phase 1) | `worker_ledger_entries` aggregate | "Payable" |

**What was confirmed:**
- `StudioWorkflowPage.tsx` already has correct label + disclaimer (no change needed)
- `WorkerDetailPage.tsx` already uses GL as primary (no change needed)
- `ContactsPage.tsx` already fixed in Task 4 of prior phase

**Divergence scenarios documented** (stage cost edit, Pay-Now-Full, manual GL correction, advance allocation). See doc 45 for guidance on future screens.

---

## What Still Blocks Legacy Table Drops

The following must happen in sequence before `sale_items` can be dropped:

1. **⏳ VPS data migration** — `scripts/sale_items_data_migration.sql` not yet executed
2. **⏳ Group-1 fallback removal** — 4 sites; safe only after migration confirmed
3. **⏳ FK remap migration** — `sale_return_items.sale_item_id REFERENCES sale_items(id)` must be redirected to `sales_items(id)` — requires a new DB migration
4. **⏳ Group-2 direct read removal** — 8 sites in `saleService.ts`, `saleReturnService.ts`, `customerLedgerApi.ts`, `bulkInvoiceService.ts`, `documentStockSyncService.ts`, `packingListService.ts`; safe only after FK remap
5. **⏳ 30-day monitoring** — confirm `sale_items` receives 0 new writes after all of the above
6. **⏳ Drop/rename** — `sale_items` table can be dropped or renamed to `sale_items_archived`

**For `document_sequences` drop:**
- ⏳ 30-day monitoring that `document_sequences.purchase_return` receives no new increments after code deploy
- ⏳ Migrate remaining `document_sequences_global` consumers to canonical (16 prefix types — P2)
- Then: drop both legacy numbering tables

---

## Next Phase Recommendation

### Immediate (requires VPS/DBA access)

1. Deploy `migrations/purchase_return_sequence_finalization.sql`
   - Run verification: `SELECT * FROM erp_document_sequences WHERE document_type = 'purchase_return'`
   - Expected: rows with `prefix = 'PRET-'` for each company/branch

2. Run pre-migration readiness check on VPS:
   ```
   psql -f scripts/system-audit/verify_sale_items_post_migration_readiness.sql
   ```
   - Check D (ID collision) MUST = 0 before proceeding

3. Execute data migration on VPS:
   ```
   psql -f scripts/sale_items_data_migration.sql
   ```

4. Run post-migration FK integrity check:
   ```
   psql -f scripts/system-audit/verify_sale_return_item_fk_integrity_after_migration.sql
   ```
   - Check 1 (unresolved FKs) MUST = 0 before removing fallbacks

### After Migration Confirmed (code changes)

5. **Batch PR — Group-1 fallback removal** (4 files, low risk):
   - `dashboardService.ts` — remove `sale_items` fallback block
   - `accountingIntegrityLabService.ts` — remove `sale_items` fallback block
   - `studioCustomerInvoiceService.ts` — remove `sale_items` fallback block
   - `SalesContext.tsx` — remove `sale_items` fallback block

6. **FK remap migration** — new file `migrations/sale_return_items_fk_remap.sql`:
   - Drop `sale_return_items.sale_item_id REFERENCES sale_items(id)` constraint
   - Add `sale_return_items.sale_item_id REFERENCES sales_items(id) ON DELETE SET NULL`

7. **Batch PR — Group-2 direct read removal** (8 sites) after FK remap deployed

### Long-term (Q3 2026)

8. 30-day monitoring: confirm `sale_items` row count stable (0 new writes)
9. Drop `sale_items` table (rename to `_archived` first as safety net)
10. Migrate `document_sequences_global` consumers to canonical (16 prefixes)
11. Drop `document_sequences` and `document_sequences_global`

---

## Docs Created This Phase (Complete Index)

| # | Doc | Status |
|---|-----|--------|
| 42 | `42_CONTROLLED_ROLLOUT_EXECUTION_PLAN.md` | ✅ |
| 43 | `43_PURCHASE_RETURN_NUMBERING_IMPLEMENTATION.md` | ✅ |
| 44 | `44_SALE_ITEMS_EXECUTION_READY_MIGRATION.md` | ✅ |
| 45 | `45_WORKER_BALANCE_TRUTH_DECISION.md` | ✅ |
| 46 | `46_LOW_RISK_LEGACY_READ_REDUCTION.md` | ✅ |
| 47 | `47_AUTHORITATIVE_DOC_REFRESH.md` | ✅ |
| 48 | `48_CONTROLLED_ROLLOUT_PHASE_SUMMARY.md` | ✅ (this file) |
