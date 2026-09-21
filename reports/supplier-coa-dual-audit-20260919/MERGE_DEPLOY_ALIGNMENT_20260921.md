# Merge / deploy alignment — 2026-09-21

**Final status:** `MERGE_DEPLOY_ALIGNMENT_PASS`

## Identifiers

| Field | Value |
|-------|--------|
| Feature branch | `feat/party-je-guards-attributed-ledger` |
| Feature SHA (pre-merge) | `75f703047ea933c50efaa7d34b550656239519e3` |
| Pre-merge `main` | `82ebe4a79c1c8bb341e9400ffafcac046a205246` |
| Merge commit | `f7118c6b930d413415a95cd749f2b1bcbdacb68b` |
| Final `main` (incl. this evidence doc) | `57d6d475115e3fd89276f78cd7c531aff4846442` |
| Deployed SHA | `f7118c6b930d413415a95cd749f2b1bcbdacb68b` (`VITE_BUILD_COMMIT=f7118c6b`; docs-only tip not redeployed) |
| PR | https://github.com/NDM0313/NEWPOSV3/pull/26 |
| Compare | https://github.com/NDM0313/NEWPOSV3/compare/82ebe4a79c1c8bb341e9400ffafcac046a205246...f7118c6b930d413415a95cd749f2b1bcbdacb68b |
| Merge commit link | https://github.com/NDM0313/NEWPOSV3/commit/f7118c6b930d413415a95cd749f2b1bcbdacb68b |

## Decision matrix (pre-merge)

| Gate | Result |
|------|--------|
| Complete branch diff reviewed (82 files) | **PASS** |
| Secrets / JWTs / Graphify in merge | **PASS** |
| Migration deploy behavior | **A — SKIP** (bookkeeping aligned) |
| GitHub Actions | **PASS** |
| Browser UI write smoke | **BROWSER_UI_SMOKE_UNAVAILABLE** |
| Cases A–G app-path | **PASS** (prior) |
| Unit + client guard tests | **PASS** (204 + 8) |
| Production RO pre-merge | **PASS** |
| Rollback strategy (app ≠ DB) | **PASS** |
| Graphify isolation | **PASS** — stash untouched |

**Pre-merge verdict:** `MERGE_DEPLOY_READY`

## Migration deploy behavior

- Runner: `deploy/deploy.sh` → `deploy/run-migrations-vps.sh`
- Bookkeeping row present before deploy: `schema_migrations` count = **1** for `20260919140000_journal_posting_account_guard_and_verified_remaps.sql`
- Deploy log line: **`[SKIP] 20260919140000_journal_posting_account_guard_and_verified_remaps.sql (already applied)`**
- Outcome: **A** — recognized as already applied; SQL not re-executed
- Manual migration SQL rerun: **NO**
- Repair scripts (`01_backup` / `02_apply` / `03_rollback`): **NOT executed**

## CI

| Field | Value |
|-------|--------|
| Workflow | JE guard review regression |
| Run ID | 35605301628 |
| URL | https://github.com/NDM0313/NEWPOSV3/actions/runs/35605301628 |
| SHA | `75f703047ea933c50efaa7d34b550656239519e3` |
| Conclusion | **success** |

## Browser smoke

| Check | Result |
|-------|--------|
| Write Create/Edit JE on staging | **BROWSER_UI_SMOKE_UNAVAILABLE** (no isolated write staging; localhost ERP is production-backed) |
| Production HTTP load (post-deploy) | **ERP `/` HTTP 200**, `/health` HTTP 200 |
| Write operations in production | **NOT performed** |

## Application deployment

| Field | Value |
|-------|--------|
| Method | `ssh dincouture-vps` → `cd /root/NEWPOSV3 && bash deploy/vps-redeploy-erp.sh` |
| VPS HEAD after pull | `f7118c6b` |
| Container | `erp-frontend` — **Up (healthy)** image `deploy-erp` |
| ERP HTTP | **200** |
| Health | **200** |
| PostgREST logs (10m) | schema cache reload only; **no** journal-guard / permission error spam |

## Production read-only (before and after deploy)

| Check | Pre | Post |
|-------|-----|------|
| JE guard migration bookkeeping | 1 | 1 (SKIP observed) |
| Ibrahim lines | `AP-SUPZHD0026` (JE-0137 / JE-0138) | unchanged |
| JE-0137 / JE-0138 balance | 0.00 | 0.00 |
| Backup `run_id` | `ibrahim_v1_20260919143935` | unchanged |
| `id_lace_status` | `NOT_IMPLEMENTED` | unchanged |
| Company GL imbalance | `0.00` | `0.00` |
| Held fingerprint (DHL/KIRAN/SHAHMIM/ID LACE) | `2e2a9c788c0a7e7575ab10b3857b5b7b` | **same** |

## Commit inventory entering main (23 commits → merge)

Grouped: migration/security; repair safety (scripts/docs only); client/UI guard; tests; evidence/docs; CI workflow. Full tree: 82 files, +7725 / −15.

## Graphify

- Stash `graphify-out-of-scope-ui-phase` (**stash@{0}**) — **untouched, not popped, not committed**
- Graphify committed: **NO**

## Explicit statements

- production migration manually rerun: **NO**
- IBRAHIM repair rerun: **NO**
- IBRAHIM rollback: **NO**
- ID LACE implemented: **NO**
- DHL / KIRAN / SHAHMIM changed: **NO**
- Graphify committed: **NO**

## Rollback policy (recorded)

- App regression → redeploy previous application commit first
- Do **not** auto-run `03_rollback.sql`
- DB rollback requires separate explicit decision

## Final status

`MERGE_DEPLOY_ALIGNMENT_PASS`
