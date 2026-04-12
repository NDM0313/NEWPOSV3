# 41. Stabilization Verification Phase — Execution Summary

**Date:** 2026-04-12  
**Build status:** ✅ `npm run build` — 0 TypeScript errors  
**Follows:** `FINAL_EXECUTION_SUMMARY.md` (the hardening pass — P1-1 through P1-5 + Phase 3)  
**Purpose:** Move from "code patched" to "verified and safer for controlled rollout"

---

## What This Phase Did

The previous session delivered 5 P1 code patches and 3 phases of architecture enforcement. This session verified that work, extended it with UI-level blocks, completed the worker balance cutover, documented the migration path for `sale_items`, and discovered + fixed one previously unknown write site.

---

## Task Completion Summary

### Task 1 — Post-Patch Verification Runbook ✅
**File:** `docs/system-audit/35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK.md`

8-section operational runbook with exact SQL/UI steps, success criteria, failure actions, and rollback instructions for every patch applied in the previous session (P1-1 through P1-5 + Phase 3 + Phase 4).

---

### Task 2 — SELECT-Only SQL Verification Scripts ✅
**Directory:** `scripts/system-audit/`

7 scripts created (all SELECT-only, safe to run on production):

| Script | What It Verifies |
|--------|-----------------|
| `verify_purchase_return_journal_integrity_post_patch.sql` | All final returns have active JE; amounts match; no duplicates; void integrity |
| `verify_historical_purchase_returns_missing_je.sql` | Pre-repair assessment: which returns need historical JEs + account lookups |
| `verify_sale_items_no_new_writes.sql` | No new rows in `sale_items` after patch; legacy-only sales; studio items |
| `verify_worker_balance_cache_vs_gl.sql` | Cache vs GL-derived drift per worker; ghost balances; ledger integrity |
| `verify_studio_v3_block_readiness.sql` | No V3 completions post-block; in-flight orders; JE gap; feature flag state |
| `verify_purchase_return_numbering_post_patch.sql` | Sequence state; format distribution; legacy `document_sequences` activity |
| `verify_gl_vs_operational_spotcheck.sql` | Cross-domain JE coverage; balance check (Dr=Cr); orphan lines; fingerprint collisions |

---

### Task 3 — Studio V3 UI Block ✅
**Files changed:**
- `src/app/components/studio/StudioProductionV3OrderDetail.tsx`
- `src/app/components/studio/StudioProductionV3Pipeline.tsx`

**Doc:** `docs/system-audit/36_STUDIO_V3_UI_BLOCK_AND_ROUTING.md`

Changes:
- Added `AlertTriangle` import to both files
- Amber warning banner added to Pipeline page: "Studio V3 — Read Only"
- Amber warning banner added to Order Detail page: "Studio V3 — Stage Completion Blocked"
- "Complete" stage button: `disabled`, `opacity-40 cursor-not-allowed`, tooltip explaining the block
- "Final Complete" button: already unreachable (`canFinalComplete` requires all stages completed)

---

### Task 4 — Worker Balance GL UI Cutover ✅
**File changed:** `src/app/components/contacts/ContactsPage.tsx`

**Doc:** `docs/system-audit/37_WORKER_BALANCE_GL_UI_CUTOVER.md`

**State before:** Phase 1 (fast-load) read `workers.current_balance` from the `workers` table — stale after P1-3.

**State after:** Phase 1 now aggregates `worker_ledger_entries WHERE status != 'paid'` directly — same source as `getWorkersWithStats().pendingAmount`. Phase 2 (canonical RPC) continues to confirm and overwrite.

Studio-specific components (`StudioWorkflowPage.tsx`, `WorkerDetailPage.tsx`) were already correct — no change needed.

---

### Task 5 — `sale_items` Migration Plan + Additional Write Site Found ✅
**Files changed:**
- `src/app/components/studio/StudioSaleDetailNew.tsx` (P1-2b — undiscovered write site fixed)

**New docs:**
- `docs/system-audit/38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT.md`

**New script:**
- `scripts/sale_items_data_migration.sql` (non-destructive, transactional)

**P1-2b finding:** `StudioSaleDetailNew.tsx` contained two `sale_items` write sites not caught in P1-2:
1. INSERT fallback (lines ~1702-1708): redirected to `sales_items`, payload normalized (`price`→`unit_price`, `is_studio_product` dropped)
2. UPDATE fallback (lines ~1661-1666): legacy fallback removed; `sales_items` is the only target

**Remaining read sites:** 16 service/component locations read from `sale_items` (all backward-compat fallbacks). Safe to keep until data migration.

**Migration sequence documented:** data migration → FK remap (`sale_return_items.sale_item_id`) → read path cleanup → rename → drop.

---

### Task 6 — Purchase Return Numbering Decision ✅
**Doc:** `docs/system-audit/39_PURCHASE_RETURN_NUMBERING_DECISION.md`

**Decision:** Create a dedicated `purchase_return` sequence with `PRET-` prefix.

**Evidence:** UI uses `PRET-${id.slice(0,8)}` fallback deliberately in `PurchasesPage.tsx` (3 locations). Purchase returns and purchase orders must be distinguishable on supplier documents and GL audit trails.

**Action items pending (not yet implemented):**
1. DBA: seed `purchase_return` sequence per company/branch
2. Dev: update `purchaseReturnService.generateReturnNumber()` from `'purchase'` → `'purchase_return'` type
3. QA: verify new return numbers show `PRET-NNNN` format

---

### Task 7 — Documentation Conflict Sync ✅
**Doc:** `docs/system-audit/40_DOCUMENTATION_SYNC_NOTES.md`

10 conflicts/corrections identified between docs 00–24 and the current patched state:
- Purchase return JE gap: now fixed (doc 09 outdated)
- Worker balance writes: now removed (doc 13 outdated)
- `sale_items` writes: now frozen (docs 18, 19, 24, 27 outdated)
- `document_sequences` for returns: now redirected (doc 19 outdated)
- V3 UI block: now dual-layer (doc 34 partially outdated)

Two undiscovered issues surfaced and fixed:
- `StudioSaleDetailNew.tsx` write site (P1-2b)
- `ContactsPage.tsx` stale Phase 1 worker balance read (Task 4)

---

### Task 8 — Final Build Verification ✅
```
npm run build
✓ built in 15.34s
0 TypeScript errors
(chunk size warnings are pre-existing, not related to this session)
```

---

## Code Changes This Session

| File | Change |
|------|--------|
| `src/app/components/studio/StudioProductionV3OrderDetail.tsx` | Added AlertTriangle; warning banner; Complete button disabled |
| `src/app/components/studio/StudioProductionV3Pipeline.tsx` | Added AlertTriangle; warning banner |
| `src/app/components/contacts/ContactsPage.tsx` | Worker balance Phase 1 switched from `workers.current_balance` to `worker_ledger_entries` aggregate |
| `src/app/components/studio/StudioSaleDetailNew.tsx` | P1-2b: INSERT + UPDATE fallbacks redirected from `sale_items` → `sales_items` |

---

## New Docs and Scripts This Session

**Docs (5):**
- `35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK.md`
- `36_STUDIO_V3_UI_BLOCK_AND_ROUTING.md`
- `37_WORKER_BALANCE_GL_UI_CUTOVER.md`
- `38_SALE_ITEMS_MIGRATION_AND_READ_RETIREMENT.md`
- `39_PURCHASE_RETURN_NUMBERING_DECISION.md`
- `40_DOCUMENTATION_SYNC_NOTES.md`
- `41_STABILIZATION_VERIFICATION_PHASE_SUMMARY.md` (this file)

**SQL scripts (8):**
- `scripts/system-audit/verify_purchase_return_journal_integrity_post_patch.sql`
- `scripts/system-audit/verify_historical_purchase_returns_missing_je.sql`
- `scripts/system-audit/verify_sale_items_no_new_writes.sql`
- `scripts/system-audit/verify_worker_balance_cache_vs_gl.sql`
- `scripts/system-audit/verify_studio_v3_block_readiness.sql`
- `scripts/system-audit/verify_purchase_return_numbering_post_patch.sql`
- `scripts/system-audit/verify_gl_vs_operational_spotcheck.sql`
- `scripts/sale_items_data_migration.sql`

---

## Architecture State After This Session

### Write paths — fully enforced
- `sale_items`: 0 write sites (P1-2 + P1-2b)
- `workers.current_balance`: 0 write sites (P1-3)
- `purchase_returns` numbering: via canonical RPC (P1-4)
- Studio V3 stage completion: hard-blocked backend (P1-5) + UI-disabled (Task 3)

### Display reads — now GL-derived
- Worker pending balance in `ContactsPage.tsx` Phase 1: reads `worker_ledger_entries` (not stale cache)
- Studio worker balance: already reading `pendingAmount` from ledger
- Contacts Phase 2 (canonical RPC): unchanged, continues to overwrite Phase 1

### Guards
- `failLegacyReadInDev()`: throws in dev by default (Phase 3)

---

## Remaining P2/P3 Work (not done in this session)

| Item | Status | Notes |
|------|--------|-------|
| Seed `purchase_return` sequence + update type in service | Pending | Doc 39 |
| `sale_items` data migration (INSERT to `sales_items`) | Pending | Script ready: `scripts/sale_items_data_migration.sql` |
| `sale_return_items.sale_item_id` FK remapping | Pending | Blocked on data migration |
| Remove 16 `sale_items` read fallback sites | Pending | Blocked on FK remapping |
| Implement V3 JE layer (unblock V3) | Pending — P3 | Doc 32, 36 |
| V2 sunset (delete `studioCustomerInvoiceService.ts`) | Pending — Q3 2026 | Doc 34 |
| `document_sequences_global` consumer migration | Pending | Doc 27 |
| `ledger_master` / `ledger_entries` confirm 0 reads + drop | Pending | Doc 27 |
