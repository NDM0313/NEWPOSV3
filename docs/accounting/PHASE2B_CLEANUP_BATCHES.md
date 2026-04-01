# Phase 2B — Safe cleanup batches

**Updated:** 2026-04-01  
**Principle:** Execute in order. **Batch 1 only** is safe without DBA involvement. Batches **2–3** need code review + CI. Batches **4–5** need **explicit approval** and environment-specific evidence — **no execution in planning pass**.

Cross-reference: `PHASE2B_LEGACY_FREEZE_PLAN.md`, `PHASE2B_DROP_CANDIDATES_REVIEW.md`, `PHASE2B_ROLLBACK_AND_SAFETY.md`.

---

## Batch 1 — Docs / archive metadata only (lowest risk)

**Goal:** Align human process with the freeze without touching runtime.

| Action | Example |
|--------|---------|
| Link Phase 2B docs from `ACCOUNTING_CANONICAL_MASTER_PLAN.md` or registry (if maintained) | Add “Legacy freeze: see PHASE2B_*” |
| Mark audit SQL with header “historical — verify stubbed ledgerService before use” | `docs/audit/supplier_ledger_*.sql` |
| Optional: `README` in `scripts/` warning for `company_reset_*` | Text only |

**Rollback:** Revert git commit.  
**Applied in this prompt:** Documentation updates only (Phase 2B docs). No runtime code changes and no DB changes.

---

## Batch 2 — Dead frontend / mock modules

**Goal:** Remove unused UI that could confuse developers.

| Candidate | Evidence | Preconditions |
|-----------|----------|----------------|
| `erp-mobile-app/src/components/accounting/AccountingModule.tsx` | Not imported in `erp-mobile-app/src` per `PHASE2B_LEGACY_INVENTORY.md` | Product confirms no future demo use; run `grep` after delete |
| `Figma Mobile ERP App Design/src/components/accounting/AccountingModule.tsx` | Design artifact (separate tree) | Exclude from production builds (already separate tree) |

**Rollback:** Restore file from git.  
**Dependency check:** `rg AccountingModule erp-mobile-app/src` must show only intended references.

---

## Batch 3 — Legacy code references with no runtime use

**Goal:** Reduce confusion; **do not** remove guardrails.

| Area | Action | Caution |
|------|--------|---------|
| `src/app/services/ledgerService.ts` | Delete file **only if** grep proves zero imports and TypeScript build passes | Deleting is safe only if nothing imports it; keep if any consumer exists |
| Root scripts: `complete-migration.js`, `verify-migration.js`, `remove-duplicate-accounting-tables.js` | Move to an explicit “legacy/prototype” folder or archive list (repo-only) | These scripts can be destructive; do not run on prod without a signed runbook |

**Do not remove** `accountingCanonicalGuard.ts` legacy blocklist — it is **active protection**.

**Rollback:** Git revert.

---

## Batch 4 — DB legacy tables (review-only list)

**Goal:** Produce **environment-specific** readiness pack; **no DROP**.

| Step | Output |
|------|--------|
| Catalog inventory | `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (...legacy set...)` |
| Row counts | Per company or global |
| Dependents | FKs, views, triggers referencing legacy tables |
| Consumers | Ops confirms no BI/ETL |

Deliverable feeds `PHASE2B_DROP_CANDIDATES_REVIEW.md`.

---

## Batch 5 — Final approved DB cleanup candidates

**Goal:** Execute **only** after Batch 4 + written approval.

Examples of **candidate** operations (not approved here):

- `DROP TABLE` legacy cluster after multi-month freeze and backup
- Revoke `INSERT/UPDATE` on legacy tables from `authenticated` (policy freeze)

**Never** execute `remove-duplicate-accounting-tables.js` or `company_reset_final.sql` against production without a signed runbook.

---

## Proposed batch timeline (indicative)

| Batch | When |
|-------|------|
| 1 | Immediate (doc process) |
| 2 | Next safe sprint window |
| 3 | After Batch 2 stability |
| 4 | DBA-scheduled inventory window |
| 5 | Post–freeze period + sign-off |

---

## Mandatory answer: cleanup applied?

**No destructive or code cleanup was applied** in the creation of Phase 2B planning deliverables — **documentation only**.
