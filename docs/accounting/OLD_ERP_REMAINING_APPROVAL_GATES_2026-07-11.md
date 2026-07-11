# OLD ERP — Remaining Approval Gates

**Date:** 2026-07-11  
**Scope:** OLD ERP / DIN Collection ERP only  
**HEAD:** `f7c66fd9`  
**Last updated:** 2026-07-11 (Salesman extended QA attempt)

---

## COMPLETED

| Track | Status | Evidence |
|-------|--------|----------|
| Calendar Days 7–15 | **COMPLETE / PASS** | `reports/single-core-engine-calendar-stability-official-202607*` |
| R8-R1 operational retirement | **COMPLETE** | `reports/r8-legacy-retirement-execution-20260710/` |
| Ledger V2 production deploy | **COMPLETE** | `docs/2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md` |
| Salesman login QA | **PASS** | `reports/mobile-salesman-qa-readiness-after-day15-20260709/` |
| Monitoring flake hardening | **COMPLETE** | `6281fcc4`, `ba7dadd7`, three-company PASS |
| Sales Revenue 4000 production proof | **COMPLETE** | SL-0010, RET-20260711-3835 |
| Post-pull verify (2026-07-11 AM) | **PASS** | `reports/single-core-engine-calendar-stability-office-post-pull-verify-20260711/` |

### Accounting decisions locked

- Future/native Sales Revenue = **4000**
- Account **4100** = DIN CHINA imported historical / fallback only
- No historical 4100 → 4000 reclass has been run
- Unified main loaders are canonical production path; legacy code retained for rollback only

---

## READY BUT BLOCKED

| Track | Readiness doc | Blocker |
|-------|---------------|---------|
| Play Store release | `docs/mobile/PLAY_STORE_RELEASE_READINESS_2026-07-11.md` | `PLAY_STORE_FINAL_UPLOAD_APPROVAL_REQUIRED` |
| Supplier Party Discount PKR 1 QA | `docs/accounting/SUPPLIER_PARTY_DISCOUNT_PKR1_QA_READINESS.md` | `APPROVE_SUPPLIER_PARTY_DISCOUNT_PKR1_QA` |
| R8-R2 legacy code deletion | `docs/accounting/R8_R2_LEGACY_DELETION_READINESS_PLAN.md` | `R8_R2_CODE_DELETION_APPROVAL_REQUIRED` |
| Sales Revenue Phase 2 reclass | `docs/accounting/SALES_REVENUE_4000_4100_RECLASS_PHASE2_READINESS.md` | `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2` |

---

## DEVICE STATUS (2026-07-11 extended QA session)

| Check | Result |
|-------|--------|
| `adb devices` (after kill-server/start-server retry) | **empty** — no devices attached |
| Pixel 6 Pro | **not connected** |
| USB authorization | N/A |
| Salesman extended QA rows 4–20 | **BLOCKED** — device gate (16 BLOCKED, 1 N/A) |
| Evidence | `reports/salesman-extended-qa-pixel-rows-4-20-20260711/` |

Rows 1–3 (login path): **PASS** from 2026-07-09 office (`24281FDEE0023P`) — not re-run.

Password: **not requested** (device gate).

---

## EXACT APPROVAL STRINGS

| Gate | Phrase |
|------|--------|
| Play Store upload | `PLAY_STORE_FINAL_UPLOAD_APPROVAL_REQUIRED` |
| Supplier discount QA execution | `APPROVE_SUPPLIER_PARTY_DISCOUNT_PKR1_QA` |
| R8-R2 code deletion | `R8_R2_CODE_DELETION_APPROVAL_REQUIRED` |
| Sales revenue Phase 2 reclass | `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2` |

Do not use a single general approval to bypass individual gates.

---

## Safety (this session)

| Item | Status |
|------|--------|
| DB migrations | no |
| GL repairs | no |
| Production data mutation | no |
| Transfer / reclass JE | no |
| R8-R2 code deletion | no |
| Play Store upload | no |
| Supplier PKR 1 transaction | no |
| Passwords saved in repo | no |

---

## Stable state verdict

All safe autonomous work for OLD ERP readiness is complete. Salesman extended QA rows 4–20 remain **device-blocked** until Pixel 6 Pro appears as `device` in adb. Further gated work requires operator approval strings above.
