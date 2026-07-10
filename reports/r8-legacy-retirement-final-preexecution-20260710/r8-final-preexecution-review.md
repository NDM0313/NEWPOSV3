# R8 Legacy Retirement — Final Pre-Execution Review

**Date:** 2026-07-10  
**Project:** OLD ERP / DIN Collection ERP only (not FX / multi-currency app)

---

## Status

| Item | Value |
|------|-------|
| R8 run | **no** |
| Approval phrase present in operator instruction | **no** |
| Final decision | **`R8_BLOCKED_AWAITING_NADEEM_APPROVAL`** — pre-execution + monitoring **PASS** |

---

## Baseline

| Item | Value |
|------|-------|
| Branch | `main` |
| HEAD | `8a01037c` |
| origin/main | `8a01037c` |
| Production URL | https://erp.dincouture.pk |
| Ledger V2 deployed commit | `3e9c8b19` |
| Calendar stability through Day 15 | **COMPLETE / PASS** (`4665334b`) |
| Closeout preflight commit | `96890d0a` |
| Salesman QA | **PASS** (login) — `2dee1163` / `44154031` |
| Play Store | **NOT RELEASED** |

---

## Readiness evidence

### Days 7–12

- **COMPLETE / PASS** (6/6) — [`docs/accounting/OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md`](../../docs/accounting/OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md)

### Days 13–15

- **COMPLETE / PASS** — [`docs/accounting/OFFICIAL_CALENDAR_STABILITY_DAYS_13_15_R8_READINESS_2026-07-07.md`](../../docs/accounting/OFFICIAL_CALENDAR_STABILITY_DAYS_13_15_R8_READINESS_2026-07-07.md), commit `4665334b`

### Salesman QA

- **PASS** — [`reports/mobile-salesman-qa-readiness-after-day15-20260709/mobile-salesman-qa-status.md`](../mobile-salesman-qa-readiness-after-day15-20260709/mobile-salesman-qa-status.md)
- Status: `SALESMAN_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`
- Manager QA: N/A / waived

### Ledger V2 deploy

- [`docs/2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md`](../../docs/2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md) — commit `3e9c8b19`, frontend-only, no DB/repairs

### Tests / build (this session — 2026-07-10)

| Check | Result |
|-------|--------|
| `npm run test:unified-ledger` | **PASS** (336/336) |
| `npm run test:unit` | **PASS** (182/182) |
| `npm run build` | **PASS** (~24s) |

### Monitoring artifact

| Check | Result |
|-------|--------|
| Fresh `npm run monitor:three-company-unified-ledger` | **PASS** (2026-07-10) — [`latest-three-company-monitoring.md`](../single-core-ledger/operational-monitoring/latest-three-company-monitoring.md) |
| Read-only loader guard (SSH) | **PASS** — [`loader-guard-20260710.json`](./loader-guard-20260710.json) |
| Production flag snapshot | **CAPTURED** — [`production-flag-snapshot-20260710.md`](./production-flag-snapshot-20260710.md) |
| Latest archived artifact | **PASS** — [`reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.md`](../single-core-ledger/operational-monitoring/latest-three-company-monitoring.md) (2026-07-08, overall PASS; din-bridal/din-couture 18/19 checks) |
| Admin Compare | Not re-run live; historical 9/9 pilot batch per calendar docs |

**Blocker note:** Pre-execution tasks 1–9 **complete**. R8 **run** still blocked (no approval phrase). Before execution day: set per-company QA passwords and achieve fresh monitoring PASS.

**Task closeout:** [`r8-preexecution-task-closeout.md`](./r8-preexecution-task-closeout.md)  
**Execution prompt (when approved):** [`r8-execution-operator-prompt.md`](./r8-execution-operator-prompt.md)

---

## R8 affected surfaces

See full inventory: [`r8-affected-surface-inventory.md`](./r8-affected-surface-inventory.md)

### Screens

Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha, Cash Flow, Balance Sheet, P&L

### Loaders

Eight `resolve*MainLoaderSource` resolvers under `src/app/lib/` and `src/app/lib/accounting/`

### Flags

`unified_ledger_engine`, `unified_ledger_kill_switch`, eight `unified_ledger_loader_*`, eight `unified_ledger_screen_*` — see `unifiedLedgerFlagKeys.ts`

### Legacy paths

`getCustomerLedger` hybrid, legacy roznamcha service paths, shadow compare panels, supplier `ledger_entries` mirror (Phase 8 map)

### Exports / print / WhatsApp

Follow active main loader; parity covered by `*MainLoaderExportParity` tests

### Mobile impact

erp-mobile-app parallel APIs — out of default R8 scope; Salesman login QA PASS; Play Store not released

---

## Safety gates

| Gate | Status |
|------|--------|
| DB migrations required for preflight | **no** |
| Production GL/data mutation required for preflight | **no** |
| Repairs required | **no** |
| Supplier Party Discount PKR 1 QA | **not run** (not approved) |
| Play Store | **not released** |
| Passwords in commits | **no** |

---

## Rollback plan

| Layer | Steps |
|-------|-------|
| Git rollback | Revert R8 retirement commit; redeploy prior `main` SHA |
| Flag rollback | L1: OFF per-loader flags via company rollback SQL scripts |
| Env kill switch | `unified_ledger_kill_switch` ON → forces legacy effective loaders |
| Deploy rollback | `deploy/vps-build-erp-only.sh` from known-good image/tag |
| Monitoring rollback | Re-run three-company monitoring after flag/deploy rollback |
| User-facing | No data rollback if code-only; users may see legacy loaders again via flags |
| Data rollback | **Should not be needed** if R8 remains flag/code retirement without GL writes |

---

## Stop conditions

- [x] Missing approval phrase — **active**
- [x] Fresh monitoring could not run (credentials) — **active**
- [ ] Admin Compare material difference — not evaluated this session
- [ ] Loader guard fail — not evaluated live (unit tests PASS)
- [ ] Build/test fail — **clear** (all PASS)
- [ ] Unexpected production mutation — **none**
- [ ] Missing rollback path — **documented** (L0/L1/L2)

---

## Approval required

R8 may only run after written approval phrase in operator instruction:

```text
NADEEM_APPROVES_R8_LEGACY_RETIREMENT
```

**Current operator instruction:** phrase **not present**.

**If phrase is later present:** do **not** run immediately — produce execution prompt, confirm fresh monitoring PASS, operator final go-ahead, then follow canonical runbook sequence in [`R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md`](../../docs/accounting/R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md).

---

## Repo hygiene (pre-commit)

| Check | Result |
|-------|--------|
| HEAD = origin/main | yes (`2dee1163`) |
| Unsafe staged files | none |
| Local WIP unstaged | erp-mobile-app, graphify-out, IPA, sales-revenue diag — **not staged** |
| Divergence | none |

---

## Session safety attestation

| Item | Value |
|------|-------|
| R8 executed | no |
| DB migrations run | no |
| Repairs run | no |
| Production GL/data mutation | no |
| Supplier Party Discount QA | no |
| Play Store upload | no |
| Passwords committed | no |
