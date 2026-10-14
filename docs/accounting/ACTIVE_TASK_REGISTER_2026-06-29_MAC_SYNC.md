# Active Task Register — Mac Sync 2026-06-29

**Generated:** Home MacBook post office merge  
**Branch:** `main` @ `24023a0f` (party discount posting QA + keep closure)  
**Authoritative sources:** [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](SINGLE_CORE_LEDGER_PRODUCTION_READY.md), [`remaining-tasks-master-register.md`](../reports/single-core-ledger/final-production-ops-handoff/remaining-tasks-master-register.md)

---

## A. Immediate code integration / release candidates

| ID | Task | Status | Next step |
|----|------|--------|-----------|
| A1 | **Party Ledger Discount** (Ledger v2) | **Production posting QA COMPLETE** — JE-0003 kept; golden 216,299 | Optional supplier PKR 1 QA (separate approval) |
| A2 | **Create Business email OTP** | Code merged @ `ae6c69d0`; tests PASS | Browser QA signup flow → push approval |
| A3 | **Push to GitHub** | Local `main` +1 vs `origin/main` | Operator approval — see push-readiness report |

---

## B. Unified ledger blocked gates

| ID | Task | Gate |
|----|------|------|
| B1 | Cash Flow Phase 3B-M loader swap (additional cos / rollback) | Operator written approval; 3 cos already live per production-ready pack |
| B2 | BS/P&L unified **main** loader swap | Finance sign-off **PENDING** |
| B3 | R7 roznamcha_payment RPC | **BLOCKED_R7** — design only |
| B4 | R8 legacy engine retirement | **BLOCKED_R8** |
| B5 | 4th company unified ledger rollout | **BLOCKED_NEEDS_FINANCE_SIGNOFF** |

---

## C. Accounting / GL backlog — fresh diagnostics required

| ID | Task | Note |
|----|------|------|
| C1 | MURAD DC-0007 Rs 257,140 | Business payment/adjustment — **no repair this phase** |
| C2 | AZIZ JAMURAD 1100 mismatch | Diagnose first |
| C3 | ABDUL WAJID partial mismatch | Diagnose first |
| C4 | DIN BRIDAL control 1100 -136,500 | Business decision |

*Source: old [`remaining-tasks-2026-06-16.md`](remaining-tasks-2026-06-16.md) — revalidate before any apply.*

---

## D. Business / UI QA backlog

| ID | Task |
|----|------|
| D1 | REN-0005 Amount Due KPI vs list filter |
| D2 | Reports header date reload (BS, TB, P&L, C&S) |
| D3 | Product Reports pie overlap |
| D4 | Customers & Suppliers Due/Advance GL full table |
| D5 | Expenses receipt upload + edit without duplicate |
| D6 | Sales / Purchases / Inventory KPI strips |

---

## E. DIN CHINA import backlog

| ID | Task |
|----|------|
| E1 | 12 products missing `cost_price` |
| E2 | Purchase CSV delta ~Rs 464k — business approval |
| E3 | Optional sell returns import |
| E4 | Opening/fabric stock Oct 2023 — excluded by design |

---

## F. Mobile backlog

| ID | Task |
|----|------|
| F1 | Rental AR sub-ledger on mobile booking flow |
| F2 | APK rebuild if needed |

---

## G. Ongoing ops (no code change)

| ID | Task |
|----|------|
| G1 | `npm run monitor:three-company-unified-ledger` |
| G2 | Optional launchd / scheduler for monitoring on Mac |

---

## Stale docs — do not use as active roadmap

- [`OFFICE_CLOSING_PHASE_1_5_REMAINING_TASKS.md`](OFFICE_CLOSING_PHASE_1_5_REMAINING_TASKS.md) — historical Phase 1.5 staging handoff

---

## Audit artifacts

Full Mac sync audit: [`reports/mac-home-sync-audit-20260629/`](../reports/mac-home-sync-audit-20260629/)
