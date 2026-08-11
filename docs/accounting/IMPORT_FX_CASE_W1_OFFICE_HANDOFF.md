# Import FX Case W1 — Office handoff

**Date:** 2026-08-12  
**Branch:** `feat/import-fx-case-w1-persistence`  
**Tip commit:** `770af42eb60a6f39fc9cb9fd2a86fa1fc95f369c`  
**Compare / open PR:** https://github.com/NDM0313/NEWPOSV3/compare/main...feat/import-fx-case-w1-persistence?expand=1

---

## Status (home / local)

| Item | Result |
|------|--------|
| W1 implementation | Done (non-posting case shell) |
| Localhost QA gate | **Accepted by owner** for PR merge-readiness only |
| Target | `localhost:5432/postgres` · container `newposv3-local-pg` |
| Suites | **122/122 PASS** |
| Production build | **PASS** |
| JE / lines / payments Δ | **0 / 0 / 0** |
| Production DB / API | **Not touched** (`supabase.dincouture.pk` refused) |
| Merged to `main` | **No** |

Full evidence: [`IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md`](./IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md)

---

## Office — do next (in order)

### 1. Open / update GitHub PR

1. Open the compare link above → **Create pull request** (if none exists).  
2. Base: `main` ← head: `feat/import-fx-case-w1-persistence`.  
3. Paste summary from “PR body paste” below.  
4. Authenticate `gh` if you want CLI PR comments: `gh auth login`.

### 2. Human merge review (PR only)

Confirm in review:

- No journal/payment posting in W1 migrations/RPCs  
- Multi Currency OFF → historical list/get read-only; mutations blocked  
- Table + attachment privileges RPC-only (lockdown migrations)  
- Path 21 Agent FX still separate / unchanged money path  
- QA harness SQL is **not** in the production migration chain  

Merge recommendation for **code PR only:** READY (localhost gate owner-approved).  
**Do not** treat merge as production deploy.

### 3. Production-deployment blockers (still required before any prod migrate)

| # | Blocker |
|---|---------|
| 1 | Proper non-production Supabase / VPS staging environment |
| 2 | Live UI smoke against non-production HTTP API |
| 3 | Production Storage bucket policy verification (or N/A with evidence) |
| 4 | Explicit production migration + deployment approval |

### 4. After PR merge (only when approved)

Apply on staging first, then production **only with separate written approval**, in repo order:

1. Path 21 / Wave A / Wave 0 (if not already on target)  
2. `20260811230000_import_fx_case_stage_persistence_w1.sql`  
3. `20260812010000_import_fx_case_create_idempotency_w1.sql`  
4. `20260812013000_import_fx_case_history_read_when_disabled_w1.sql`  
5. `20260812020000_import_fx_case_read_security_hardening_w1.sql`  
6. `20260812030000_import_fx_case_mutation_security_parity_w1.sql`  
7. `20260812040000_import_fx_case_attachment_security_w1.sql`  
8. `20260812050000_import_fx_case_table_privilege_lockdown_w1.sql`  

Do **not** run `scripts/qa/import-fx-w1-*-harness.sql` on staging/production.

---

## Explicitly not authorized yet

- Production database access / migrate / deploy  
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
- Tip: 770af42eb60a6f39fc9cb9fd2a86fa1fc95f369c
- Evidence: docs/accounting/IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md
- Handoff: docs/accounting/IMPORT_FX_CASE_W1_OFFICE_HANDOFF.md

## Production not done
- No prod migrate/deploy in this PR
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
