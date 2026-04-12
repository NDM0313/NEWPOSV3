# 47. Authoritative Doc Refresh — Controlled Rollout Phase

**Date:** 2026-04-12  
**Purpose:** Record which authoritative docs were updated in this phase and what changed.

---

## Docs Updated

### `27_LEGACY_ISOLATION_PLAN.md`

**Section:** `sale_items` status block

**What changed:**
- Status updated from "Partial isolation — new writes STOPPED" to "Writes FROZEN; data migration script READY"
- Added P1-2b patches (`StudioSaleDetailNew.tsx` INSERT + UPDATE fallbacks) to the evidence table
- Added `backupExport.ts` P2 change
- Retirement blockers section rewritten to show numbered sequence with ✅/⏳ status per step
- Reference to `46_LOW_RISK_LEGACY_READ_REDUCTION.md` added

**Old claim retired:** "Migration script needed" → script now exists and is patched

---

### `31_P1_DOCUMENT_NUMBERING_UNIFICATION.md`

**What changed:**
- Status header updated: was "PATCHED — purchase return number generation redirected to canonical engine"; now "P2 COMPLETE — dedicated `purchase_return` sequence type implemented; VPS migration pending"
- Code block updated: `'purchase'` → `'purchase_return'` with P2 annotation
- Note added referencing docs 39 and 43

**Old claim retired:** Interim 'purchase' type was the documented final state

---

### `37_WORKER_BALANCE_GL_UI_CUTOVER.md`

**No structural changes made.** Doc 45 (`45_WORKER_BALANCE_TRUTH_DECISION.md`) is the formal extension of this doc. The dual-source architecture decision formally supersedes the "UI cutover" framing — it's not a migration from one to the other, it's a deliberately layered model.

The `37` doc remains accurate for what it described (Phase 1 of the cutover: `ContactsPage.tsx` reads from ledger instead of stale cache). Doc 45 adds the formal architecture decision.

---

## Docs Checked — No Updates Required

| Doc | Checked | Finding |
|-----|---------|---------|
| `25_ACCOUNTING_ARCHITECTURE_FREEZE.md` | ✅ | Canonical table declarations unchanged |
| `26_CANONICAL_WRITE_PATHS.md` | ✅ | Studio sale path unchanged; P1-2b covered in doc 40 (sync notes) |
| `41_STABILIZATION_VERIFICATION_PHASE_SUMMARY.md` | ✅ | Historical accuracy preserved; doc 48 is the current-state summary |

---

## New Authoritative Docs Created This Phase

| Doc | Covers |
|-----|--------|
| `42_CONTROLLED_ROLLOUT_EXECUTION_PLAN.md` | Operational execution order with gates |
| `43_PURCHASE_RETURN_NUMBERING_IMPLEMENTATION.md` | Complete numbering change record |
| `44_SALE_ITEMS_EXECUTION_READY_MIGRATION.md` | Migration script assessment + execution steps |
| `45_WORKER_BALANCE_TRUTH_DECISION.md` | Formal architecture decision: dual-source model |
| `46_LOW_RISK_LEGACY_READ_REDUCTION.md` | Per-site analysis of `sale_items` reads |
| `47_AUTHORITATIVE_DOC_REFRESH.md` | This file |
| `48_CONTROLLED_ROLLOUT_PHASE_SUMMARY.md` | Final summary (created after build) |

---

## Claims Now Retired

| Former claim | Where | Replaced by |
|-------------|-------|-------------|
| `sale_items` migration script needed | doc 27 | Script exists and is execution-ready (patched) |
| Purchase return numbering uses shared 'purchase' type | doc 31 | Dedicated 'purchase_return' type with PRET- prefix |
| Worker balance "cutover" from cache to GL | doc 37 framing | Formally a dual-source model: operational ledger vs GL (doc 45) |
