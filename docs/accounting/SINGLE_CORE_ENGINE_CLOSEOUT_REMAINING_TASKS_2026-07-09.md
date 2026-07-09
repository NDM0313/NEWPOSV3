# Single Core Engine Closeout — Remaining Tasks

**Date:** 2026-07-09 (updated after Salesman login PASS)  
**Scope:** OLD ERP / DIN Collection ERP only (not FX app)

## Baseline

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD / origin/main | `e983ae96`+ |
| Production URL | https://erp.dincouture.pk |
| Calendar Days 7–15 | **COMPLETE / PASS** |
| VPS deploy (office) | **COMPLETE** — [`2026-07-09-OFFICE-VPS-DEPLOY-APPLY.md`](../2026-07-09-OFFICE-VPS-DEPLOY-APPLY.md) |
| R8 status | **BLOCKED** — approval phrase not present |
| Mobile Salesman QA | **PASS** (login) — Play Store **NOT RELEASED** |

## Completed

| Track | Evidence |
|-------|----------|
| Days 7–15 calendar | `OFFICIAL_CALENDAR_STABILITY_DAYS_*` + execution plan |
| R8 preflight pack | `R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md` |
| 1 PKR parity (read-only) | `reports/admin-compare-1pkr-parity-investigation-20260709/` |
| Ledger V2 production deploy | `2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md` + office redeploy `2026-07-09-OFFICE-VPS-DEPLOY-APPLY.md` |
| Salesman mobile QA (login) | `reports/mobile-salesman-qa-readiness-after-day15-20260709/salesman-role-qa-pass.md` |
| Admin mobile QA | PASS 21/21 (prior) |
| Manager mobile QA | N/A / waived |

## Remaining approval-gated only

### 1. R8 legacy retirement

- **Status:** BLOCKED
- **Required:** `NADEEM_APPROVES_R8_LEGACY_RETIREMENT`
- **Preflight:** `R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md`

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
| R8 run | no |
| DB migrations run | no |
| Repairs run | no |
| Production GL mutation | no |
| Passwords committed | no |
