# OLD ERP — Remaining Approval Gates

**Date:** 2026-07-19 (status sync)
**Scope:** OLD ERP / DIN Collection ERP only
**HEAD:** see latest `main` (A-to-Z pack: `docs/accounting/SINGLE_CORE_ENGINE_COMPLETE_A_TO_Z_2026-07-19.md`)
**Last updated:** 2026-07-19 — R8-R2 main-loader deletion COMPLETE; Play Store still skipped

---

## COMPLETED

| Track | Status | Evidence |
|-------|--------|----------|
| Calendar Days 7–15 | **COMPLETE / PASS** | `reports/single-core-engine-calendar-stability-official-202607*` |
| R8-R1 operational retirement | **COMPLETE** | `reports/r8-legacy-retirement-execution-20260710/` |
| Ledger V2 production deploy | **COMPLETE** | `docs/2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md` |
| Salesman login QA | **PASS** | `reports/mobile-salesman-qa-readiness-after-day15-20260709/` |
| **Salesman extended QA (rows 4–20)** | **PASS** | `reports/salesman-extended-qa-pixel-rows-4-20-20260711/` — `SALESMAN_EXTENDED_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED` |
| Monitoring flake hardening | **COMPLETE** | `6281fcc4`, `ba7dadd7`, three-company PASS |
| DIN CHINA Phase 2.16 golden refresh | **COMPLETE** | `reports/din-china-phase-216-golden-refresh-20260712/` — monitoring **PASS** all 3 companies |
| Sales Revenue 4000 production proof | **COMPLETE** | SL-0010, RET-20260711-3835 |
| Sales Revenue Phase 2 reclass | **COMPLETE** | `reports/sales-revenue-phase2-closeout-20260712/` |
| Supplier Party Discount PKR 1 QA | **COMPLETE** | JE-0028 verified; evidence recovery 2026-07-15 |
| AR/AP Phase 2b | **PRODUCTION COMPLETE** | `official_gl` parity — `reports/ar-ap-phase-2b-official-gl-parity-closeout-20260715/` |
| R8-R2 main-loader legacy deletion (A1+A2) | **COMPLETE** (2026-07-17; date gate waived) | `docs/accounting/R8_R2_PRODUCTION_EXECUTION_CLOSEOUT_2026-07-17.md` |
| `SINGLE_CORE_ENGINE_TECHNICALLY_CLOSED` | **YES** (approved main-loader scope) | Same R8-R2 closeout |
| R8-R2 kill-switch drill (Jul 12 claim) | **CLAIM RETRACTED** (2026-07-15) | Post-R8-R2 kill ON = fail-closed; use L2 tag rollback |
| Post-pull verify (2026-07-11 AM) | **PASS** | `reports/single-core-engine-calendar-stability-office-post-pull-verify-20260711/` |

### Accounting decisions locked

- Future/native Sales Revenue = **4000**
- Account **4100** = DIN CHINA imported historical / fallback only
- No historical 4100 → 4000 reclass has been run
- Unified main loaders are canonical production path; approved main-loader legacy wrappers **deleted** (R8-R2)

---

## READY BUT BLOCKED / DEFERRED

| Track | Readiness doc | Status |
|-------|---------------|--------|
| Play Store release | `docs/mobile/PLAY_STORE_RELEASE_READINESS_2026-07-11.md` | **SKIPPED** per operator 2026-07-12 |
| BS/P&L error-fallback second wave | `docs/accounting/R8_R2_LEGACY_DELETION_READINESS_PLAN.md` | **DEFERRED** — not part of A1+A2 closeout |
| Contacts page unified party GL | `docs/accounting/CONTACTS_AR_AP_SINGLE_SOURCE_AUDIT.md` | **OPTIONAL** — still legacy RPC |

---

## DEVICE STATUS (2026-07-11 â€” signed off)

| Check | Result |
|-------|--------|
| Pixel 6 Pro | `24281FDEE0023P` â€” connected during QA sessions |
| Salesman extended QA rows 4â€“20 | **PASS** (operator attestation + device evidence) |
| Classification | `SALESMAN_EXTENDED_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED` |
| Evidence | `reports/salesman-extended-qa-pixel-rows-4-20-20260711/` |

Rows 1â€“3: **PASS** (2026-07-09). Rows 5â€“11: **N/A** (full-accounting reports not in Salesman scope). Rows 4, 12â€“20: **PASS**.

Password: **not requested** in sign-off session.

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

Single Core approved main-loader scope is **technically closed** as of **2026-07-17**. Current A-to-Z: [`SINGLE_CORE_ENGINE_COMPLETE_A_TO_Z_2026-07-19.md`](SINGLE_CORE_ENGINE_COMPLETE_A_TO_Z_2026-07-19.md).

- Play Store: skipped until `PLAY_STORE_FINAL_UPLOAD_APPROVAL_REQUIRED`
- BS/P&L fallback second wave: deferred (separate approval)
- Contacts unified RPC: optional
