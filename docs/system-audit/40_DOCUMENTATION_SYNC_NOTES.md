# 40. Documentation Sync Notes — Conflicts and Corrections

**Date:** 2026-04-12  
**Purpose:** Record where earlier audit docs (00–24) make claims that are now outdated or incorrect after the P1–P3 hardening patches and stabilization phase.

---

## Format

Each entry: `[doc file] → [original claim] → [corrected state] → [authoritative doc]`

---

## Corrections

### 1. `09_PURCHASE_RETURN_CORE_ENGINE.md`

**Original claim (inferred from pre-patch state):**  
> `finalizePurchaseReturn()` does not post a journal entry. AP subledger is not adjusted on return finalization.

**Corrected state:**  
`finalizePurchaseReturn()` now posts a settlement JE:
- Dr AP subledger (resolved via `resolvePayablePostingAccountId`) or code 2000
- Cr Inventory (code 1200 or 1500)
- Fingerprint: `purchase_return_settlement:{companyId}:{returnId}`

**Authoritative doc:** `28_P1_PURCHASE_RETURN_GL_GAP_FIX.md`

---

### 2. `13_STUDIO_PRODUCTION_AND_WORKER_COST_ENGINE.md`

**Original claim (likely):**  
> `studioProductionService.ts` writes `workers.current_balance` at 5 sites when stage costs change, worker is paid, or ledger entries are created.

**Corrected state:**  
All 5 write sites removed (P1-3). `workers.current_balance` is now a stale cache. The canonical worker balance is `worker_ledger_entries WHERE status != 'paid'` summed via `getWorkersWithStats().pendingAmount`.

**Original claim (likely):**  
> `studioProductionService.ts` has a fallback that writes new studio sale lines to `sale_items`.

**Corrected state:**  
Fallback redirected to `sales_items` (P1-2). No new writes to `sale_items` from this service.

**Authoritative docs:** `29_P1_SALE_ITEMS_LEGACY_ELIMINATION.md`, `30_P1_CONTACTS_BALANCE_CACHE_CLEANUP.md`

---

### 3. `19_LEGACY_DUPLICATE_AND_RISK_MAP.md`

**Original claim:**  
> `purchase_returns` uses legacy `document_sequences` table for generating return numbers.

**Corrected state:**  
`generateReturnNumber()` now calls `documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase')` (canonical RPC → `erp_document_sequences`). The legacy `document_sequences` table is no longer written by this service. A dedicated `purchase_return` sequence is the recommended next step.

**Authoritative doc:** `31_P1_DOCUMENT_NUMBERING_UNIFICATION.md`, `39_PURCHASE_RETURN_NUMBERING_DECISION.md`

---

### 4. `33_HARD_GUARDS_ENFORCEMENT.md`

**Original claim (pre-Phase 3):**  
> `failLegacyReadInDev()` emits `console.warn()` only. Hard fail requires `VITE_ACCOUNTING_LEGACY_HARD_FAIL=true`.

**Corrected state:**  
After Phase 3 patch, `failLegacyReadInDev()` now **throws** by default in all non-production environments. Opt-out requires `VITE_ACCOUNTING_LEGACY_HARD_FAIL=false`. Production behavior unchanged (warn only).

**Authoritative doc:** `33_HARD_GUARDS_ENFORCEMENT.md` (up to date — self-referential)

---

### 5. `18_SOURCE_OF_TRUTH_MATRIX.md`

**Original claim (sale line items section):**  
> Canonical: `sales_items`; `sale_items` is legacy with ongoing write traffic.

**Corrected state:**  
`sale_items` is now write-frozen (P1-2, P1-2b). Write sites: 0 post-patch. Read sites: ~16 locations (backward compat only). Active data migration is the next step before dropping the table.

**Authoritative doc:** `38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT.md`

---

### 6. `17_DASHBOARD_AND_METRICS_SOURCE_MAP.md`

**Potential gap:**  
> Dashboard top-products widget reads from `sale_items` directly.

**Current state:**  
`dashboardService.ts` line 47 reads `sale_items` directly (not a try/fallback pattern). After data migration, this must be updated to read `sales_items`. Until migration, this is a backward-compat read that is safe.

**Action:** Flag for update after data migration. No immediate code change needed.

---

### 7. `24_RETIREMENT_BLOCKERS_AND_PRECONDITIONS.md`

**Original claim:**  
> `sale_items` cannot be retired until all write paths are removed.

**Updated state:**  
Write paths are now removed (P1-2, P1-2b). The remaining blockers are:
1. Data migration to `sales_items` (non-destructive INSERT)
2. FK remapping: `sale_return_items.sale_item_id` references `sale_items.id`
3. Removal of 16 read fallback locations in services/components

**Authoritative doc:** `38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT.md`

---

### 8. `30_P1_CONTACTS_BALANCE_CACHE_CLEANUP.md`

**Original claim:**  
> Doc title says "Contacts Balance Cache Cleanup" but the P1-3 changes were to `workers.current_balance`, not `contacts.current_balance`.

**Note:** This was already noted as a correction in the original execution summary. The doc covers `workers.current_balance` (which is the correct table) despite the title referencing "Contacts". This was a naming inconsistency in the plan. The doc content is correct.

**No action needed:** The content is accurate; the title is misleading but acceptable.

---

### 9. `27_LEGACY_ISOLATION_PLAN.md`

**Original claim:**  
> `sale_items` is in "ACTIVE (LEGACY)" state with writes still occurring.

**Corrected state:**  
`sale_items` moved to "FROZEN — no new writes" state as of 2026-04-12. All write paths patched. Ready for data migration phase.

**Authoritative doc:** `29_P1_SALE_ITEMS_LEGACY_ELIMINATION.md`, `38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT.md`

---

### 10. `34_STUDIO_VERSION_STRATEGY_FINAL.md`

**Original claim:**  
> V3 completeStage() is blocked at the code level only (backend throws).

**Corrected state:**  
V3 UI entry points (Pipeline, Order Detail) now also show amber warning banners and have the "Complete" button disabled. The block is now enforced at both backend AND UI levels.

**Authoritative doc:** `36_STUDIO_V3_UI_BLOCK_AND_ROUTING.md`

---

## Undiscovered Issues Surfaced During This Phase

### A. `StudioSaleDetailNew.tsx` — undiscovered `sale_items` write site

P1-2 closed 3 write sites in `studioProductionService.ts` and `AccountingIntegrityLabPage.tsx`. During the Task 5 audit (this session), a 4th write site was found at `src/app/components/studio/StudioSaleDetailNew.tsx` lines 1702-1708.

**Status:** Fixed (P1-2b). INSERT and UPDATE fallbacks now use `sales_items` (canonical) only.

### B. `ContactsPage.tsx` Phase 1 worker balance — stale cache read

The Phase 1 (fast-load) path in `ContactsPage.tsx` read `workers.current_balance` directly. After P1-3 stopped maintaining the cache, Phase 1 values could diverge from Phase 2 (RPC-derived) values.

**Status:** Fixed (Task 4). Phase 1 now reads `worker_ledger_entries WHERE status != 'paid'` — same source as `getWorkersWithStats().pendingAmount`.

---

## Docs That Are Fully Current

The following docs were created in the hardening session and accurately reflect current state:

- `25_ACCOUNTING_ARCHITECTURE_FREEZE.md` — current
- `26_CANONICAL_WRITE_PATHS.md` — update: add `StudioSaleDetailNew.tsx` P1-2b
- `28_P1_PURCHASE_RETURN_GL_GAP_FIX.md` — current
- `29_P1_SALE_ITEMS_LEGACY_ELIMINATION.md` — update: note P1-2b (StudioSaleDetailNew)
- `31_P1_DOCUMENT_NUMBERING_UNIFICATION.md` — current (P1-4 redirect is done; separate sequence pending)
- `32_P1_STUDIO_V3_ACCOUNTING_HARD_BLOCK.md` — current
- `35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK.md` — current
