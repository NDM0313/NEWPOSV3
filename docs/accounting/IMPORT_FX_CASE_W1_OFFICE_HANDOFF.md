# Import FX Case W1 — Office handoff

**Date:** 2026-08-12  
**Branch:** `feat/import-fx-case-w1-persistence`  
**Evidence tip (owner letter):** `770af42eb60a6f39fc9cb9fd2a86fa1fc95f369c`  
**Rebased tip on `main` history:** `ba26db6b` (same lockdown commit after rebase) · branch tip / `main` includes handoff at `46a00855`  
**Compare (historical):** https://github.com/NDM0313/NEWPOSV3/compare/main...feat/import-fx-case-w1-persistence?expand=1

---

## Status (home / local)

| Item | Result |
|------|--------|
| W1 implementation | Done (non-posting case shell) |
| Localhost QA gate | **Accepted by owner** (2026-08-12 office letter) for **PR merge-readiness only** |
| Target | `localhost:5432/postgres` · container `newposv3-local-pg` |
| Suites | **122/122 PASS** |
| Production build | **PASS** |
| JE / lines / payments Δ | **0 / 0 / 0** |
| Production DB / API for this gate letter | **Not used** (`supabase.dincouture.pk` refused for the localhost gate) |
| Code on `origin/main` | **Yes** — merged via [PR #22](https://github.com/NDM0313/NEWPOSV3/pull/22) (`merged_at` 2026-08-12). This letter does **not** authorize production deploy. |
| Follow-up (2026-08-14) | Local `main` fast-forwarded; W2/W2.1 localhost migrate + live RPC QA completed separately (see W2 docs). |

Full evidence: [`IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md`](./IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md) (see **Owner acceptance** section).

---

## Merge-readiness verdict (owner-accepted)

**READY for PR / code merge review** on the basis of localhost verification only.  
**PR merge status:** **DONE** — [PR #22](https://github.com/NDM0313/NEWPOSV3/pull/22) merged to `main`.

This acceptance does **not** authorize:

- production database access  
- production migration or deployment  
- Multi Currency enablement in production  
- treating localhost as production-equivalent  
- W2–W6 · Phase-3 accounting · money-journal changes  

---

## Manual PR / merge review (historical — PR #22 already merged)

`gh` CLI is often unavailable/unauthenticated in office. Browser record:

1. [PR #22](https://github.com/NDM0313/NEWPOSV3/pull/22) — **merged** 2026-08-12 (`merge_commit_sha` / tip includes W1 handoff).  
2. Compare `main...feat/import-fx-case-w1-persistence` should show **no unique commits** — **do not create a duplicate PR**.  
3. Human post-merge / release review still uses the checklist below before **production** migrate (separate approval):
   - No journal/payment posting in W1 migrations/RPCs  
   - Multi Currency OFF → historical list/get read-only; mutations blocked  
   - Table + attachment privileges RPC-only (lockdown migrations)  
   - Path 21 Agent FX still separate / unchanged money path  
   - QA harness SQL is **not** in the production migration chain  
4. **Do not** treat code merge as production deploy.

---

## Production-deployment blockers (still required before any prod migrate)

| # | Blocker |
|---|---------|
| 1 | Proper non-production Supabase / VPS staging environment |
| 2 | Live UI smoke against non-production HTTP API |
| 3 | Production Storage bucket policy verification (or N/A with evidence) |
| 4 | Explicit production migration + deployment approval |

After those are satisfied **and** written prod approval exists, apply W1 SQL in repo order on staging first, then production. Do **not** run `scripts/qa/import-fx-w1-*-harness.sql` on staging/production.

Migration order (when prod migrate is separately approved):

1. Path 21 / Wave A / Wave 0 (if not already on target)  
2. `20260811230000_import_fx_case_stage_persistence_w1.sql`  
3. `20260812010000_import_fx_case_create_idempotency_w1.sql`  
4. `20260812013000_import_fx_case_history_read_when_disabled_w1.sql`  
5. `20260812020000_import_fx_case_read_security_hardening_w1.sql`  
6. `20260812030000_import_fx_case_mutation_security_parity_w1.sql`  
7. `20260812040000_import_fx_case_attachment_security_w1.sql`  
8. `20260812050000_import_fx_case_table_privilege_lockdown_w1.sql`  

---

## Explicitly not authorized by the localhost gate letter

- Production database access / migrate / deploy under this letter  
- Multi Currency enablement in production  
- W2–W6 implementation  
- Phase-3 accounting / money-journal changes  
- Treating localhost as production-equivalent  

---

## PR body paste

```markdown
## Summary
- Import FX Case W1: non-posting case/stage shell (create, draft, confirm ARRANGEMENT, cancel, link)
- Historical reads when Multi Currency OFF; mutations stay blocked
- Fail-closed company/branch auth; attachment + table privilege lockdown (RPC-only)
- Create-case idempotency via `client_operation_id`
- Path 21 Agent FX unchanged

## Localhost verification (owner-accepted for PR merge-readiness only)
- Target: localhost:5432/postgres (`newposv3-local-pg`)
- Suites: 122/122 PASS
- Build: PASS
- JE/line/payment Δ: 0/0/0
- Evidence tip: 770af42eb60a6f39fc9cb9fd2a86fa1fc95f369c
- Evidence: docs/accounting/IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md
- Handoff: docs/accounting/IMPORT_FX_CASE_W1_OFFICE_HANDOFF.md

## Production not done under this letter
- This acceptance does not authorize prod migrate/deploy
- Staging HTTP UI smoke + Storage review + explicit prod approval still required before production

## Test plan
- [ ] PR review: no money posting / Path 21 intact
- [ ] Staging migrate (non-prod) before any production apply
- [ ] Live UI smoke vs non-prod API (MC ON + OFF)
- [ ] Storage policy review on staging/prod buckets when available
```

---

## Key paths

| Area | Path |
|------|------|
| Workspace UI | `src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx` |
| Service | `src/app/services/importFxCaseService.ts` |
| Purchases entry | `src/app/components/purchases/PurchasesPage.tsx` |
| Migrations | `migrations/20260811230000_*` … `20260812050000_*` |
| Local apply | `scripts/qa/apply-import-fx-w1-local.mjs` |
| QA suites | `scripts/qa/import-fx-w1-*-qa.mjs` |
