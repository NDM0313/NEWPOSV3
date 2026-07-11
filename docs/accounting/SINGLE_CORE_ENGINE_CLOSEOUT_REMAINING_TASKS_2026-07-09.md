# Single Core Engine Closeout — Remaining Tasks

**Date:** 2026-07-11 (office post-pull closeout)  
**Scope:** OLD ERP / DIN Collection ERP only (not FX app)

## Baseline

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD / origin/main | `84eb1363` |
| Production URL | https://erp.dincouture.pk |
| Calendar Days 7–15 | **COMPLETE / PASS** |
| Post-pull verify (2026-07-11) | **PASS** — [`OFFICE_PULL_REMAINING_STATUS_2026-07-11.md`](OFFICE_PULL_REMAINING_STATUS_2026-07-11.md) |
| VPS deploy (office) | **COMPLETE** — HEAD matches repo; no redeploy on pull |
| R8 status | **OPERATIONAL COMPLETE (R8-R1)** — 2026-07-10 — see `reports/r8-legacy-retirement-execution-20260710/` |
| Mobile Salesman QA | **PASS** (login) — Play Store **NOT RELEASED** |
| Sales revenue 4000 canonical (sale + return) | **COMPLETE** — SL-0010 + RET-20260711-3835 — see `reports/sales-revenue-canonical-account-correction-20260710/closeout.md` |

## Completed

| Track | Evidence |
|-------|----------|
| Days 7–15 calendar | `OFFICIAL_CALENDAR_STABILITY_DAYS_*` + execution plan |
| R8 preflight pack | `R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md` |
| R8 final pre-execution review | `reports/r8-legacy-retirement-final-preexecution-20260710/` (tasks 1–9 complete; R8 run blocked) |
| 1 PKR parity (read-only) | `reports/admin-compare-1pkr-parity-investigation-20260709/` |
| Ledger V2 production deploy | `2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md` + office redeploy `2026-07-09-OFFICE-VPS-DEPLOY-APPLY.md` |
| Salesman mobile QA (login) | `reports/mobile-salesman-qa-readiness-after-day15-20260709/salesman-role-qa-pass.md` |
| Sales revenue 4000 standardization + live proof (sale + return) | `reports/sales-revenue-canonical-account-correction-20260710/` |
| Manager mobile QA | N/A / waived |

## Remaining approval-gated only

### 1. R8 legacy retirement

- **Status:** **OPERATIONAL COMPLETE (R8-R1)** — 2026-07-10
- **Evidence:** `reports/r8-legacy-retirement-execution-20260710/r8-execution-report.md`
- **Note:** Legacy loader **code not deleted**; kill-switch + L1 SQL rollback retained

### 2. Play Store release

- **Status:** NOT RELEASED — separate operator approval

### 3. Supplier Party Discount PKR 1 QA

- **Status:** NOT APPROVED

### 4. Optional / future

- Created-by on old JEs — data gap; no backfill without audit approval
- Unified RPC fields — optional migration; not approved
- Full Salesman checklist rows 4–20 — optional extended QA on device

## Safety

| Gate | Result |
|------|--------|
| R8 run | yes (operational R8-R1; no legacy code deletion) |
| DB migrations run | no |
| Repairs run | no |
| Production GL mutation | no |
| Passwords committed | no |
