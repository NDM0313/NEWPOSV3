# Single Core Engine Closeout — Remaining Tasks

**Date:** 2026-07-09  
**Scope:** OLD ERP / DIN Collection ERP only (not FX app)

## Baseline

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD / origin/main | `5c2610e0` (after closeout preflight commit pending) |
| Production URL | https://erp.dincouture.pk |
| Calendar Days 7–12 | **COMPLETE / PASS** — [`OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md`](OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md) |
| Calendar Days 13–15 | **COMPLETE / PASS** — [`OFFICIAL_CALENDAR_STABILITY_DAYS_13_15_R8_READINESS_2026-07-07.md`](OFFICIAL_CALENDAR_STABILITY_DAYS_13_15_R8_READINESS_2026-07-07.md) |
| R8 status | **BLOCKED** — approval phrase not present |
| Mobile status | **BLOCKED_SALESMAN_DEVICE_QA_PENDING** — `adb` not available locally |

## Completed

| Track | Evidence |
|-------|----------|
| Days 7–12 summary | `OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md` + execution plan § |
| Days 13–15 readiness | `OFFICIAL_CALENDAR_STABILITY_DAYS_13_15_R8_READINESS_2026-07-07.md`; reports `20260713`–`20260715` |
| Day 15 / R8 readiness commit | `4665334b` |
| Ledger V2 follow-up (code) | `3e9c8b19` — Payment/Created-by enrichment, branch column, short labels |
| Ledger V2 production deploy | `deploy/vps-build-erp-only.sh` — [`2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md`](../2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md) |
| Ledger V2 deploy decision (today) | No redeploy — [`2026-07-09-LEDGER-V2-DEPLOY-DECISION.md`](../2026-07-09-LEDGER-V2-DEPLOY-DECISION.md) |
| Courier YAQOOB verify | VPS verify gates PASS (34 rows, balance 0) — session `2026-07-08` |
| Day 12 deploy decision | No frontend deploy required (calendar evidence) |

## Remaining approval-gated tasks

### 1. R8 legacy retirement

- **Status:** BLOCKED
- **Approval phrase required:** `NADEEM_APPROVES_R8_LEGACY_RETIREMENT`
- **Preflight:** [`R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md`](R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md)
- **R8 run:** NOT RUN

### 2. Salesman mobile QA

- **Status:** `BLOCKED_SALESMAN_DEVICE_QA_PENDING`
- **Required:** Pixel 6 Pro connected + authorized on ADB; Salesman password shell-only at QA time
- **Manager QA:** N/A / waived
- **Play Store:** NOT RELEASED
- **Report:** [`reports/mobile-salesman-qa-readiness-after-day15-20260709/`](../reports/mobile-salesman-qa-readiness-after-day15-20260709/)

### 3. Created by on old JEs

- **Status:** DATA GAP
- **Action:** No safe backfill without audit approval and named repair scope

### 4. Unified RPC fields

- **Status:** OPTIONAL FUTURE MIGRATION
- **Action:** Do not run without separate migration approval

### 5. Supplier Party Discount PKR 1 QA

- **Status:** NOT APPROVED
- **Action:** Do not run

### 6. 1 PKR Admin Compare parity investigation

- **Status:** OPTIONAL READ-ONLY — documented; materiality waiver remains valid for monitoring
- **Report:** [`reports/admin-compare-1pkr-parity-investigation-20260709/`](../reports/admin-compare-1pkr-parity-investigation-20260709/)

## Safety (this closeout session)

| Gate | Result |
|------|--------|
| R8 run | no |
| DB migrations run | no |
| Repairs run | no |
| Production GL/data mutation | no |
| Play Store upload | no |
| Passwords committed | no |
| graphify-out staged | no |

## VPS note

VPS working tree may be on branch `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` while **HEAD commit matches `origin/main`**. Frontend deploy uses commit content, not branch name. Untracked WIP on VPS was not touched.
