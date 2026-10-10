# Post-baseline remaining phase matrix

**Run:** POST-BASELINE REMAINING PHASES EXECUTION + SAFE FIXES  
**Generated:** 2026-06-14T00:00:00Z  
**Baseline commit:** `0a818da2`  
**Scope:** OLD ERP Single Core Ledger — not FX app

---

## Summary

| Classification | Count |
|----------------|-------|
| COMPLETE | 18 |
| SAFE_TO_EXECUTE_NOW (this run) | 2 |
| SAFE_DOCS_ONLY | 4 |
| SAFE_SOURCE_FIX | 1 |
| BLOCKED_NEEDS_FINANCE_SIGNOFF | 2 |
| BLOCKED_NEEDS_MIGRATION_APPROVAL | 2 |
| BLOCKED_R8_RETIREMENT | 1 |
| OPTIONAL_FUTURE | 8 |

---

## Phase matrix

| ID | Phase / workstream | Classification | Evidence / notes |
|----|-------------------|----------------|------------------|
| P0 | DIN CHINA unified rollout (5 loaders) | **COMPLETE** | [`final-program-archive-report.md`](../final-program-archive/final-program-archive-report.md) |
| P1 | DIN BRIDAL R5 rollout | **COMPLETE** | [`r5-soak-complete-report.md`](../r5-din-bridal-execution/r5-soak-complete-report.md) |
| P2 | DIN COUTURE rollout | **COMPLETE** | [`next-company-rollout/din-couture/final-execution-report.md`](../next-company-rollout/din-couture/final-execution-report.md) |
| P3 | Migration closure | **COMPLETE** | [`migration-closure-final-report.md`](../migration-closure/migration-closure-final-report.md) |
| P4 | Three-company baseline archive | **COMPLETE** | [`final-program-archive/`](../final-program-archive/) |
| P5 | Phase 2.16 / R6 monitoring hardening | **COMPLETE** | [`r6-completion-report.md`](../r6-monitoring-hardening/r6-completion-report.md) |
| P6 | R1/R1B docs reconciliation | **COMPLETE** | production ready pack |
| P7 | R2 Admin Compare Cash/Bank diagnostic | **COMPLETE** | [`r2-final-resolution-report.md`](../r2-cash-bank-admin-compare-diagnostic/r2-final-resolution-report.md) |
| P8 | R3 pre-expansion audit | **COMPLETE** | [`r3-audit-complete-report.md`](../r3-pre-expansion-audit/r3-audit-complete-report.md) |
| P9 | R4 per-company rollout runbook | **COMPLETE** (artifact) | [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) |
| P10 | R5 DIN BRIDAL execution | **COMPLETE** | soak + post-completion archive |
| P11 | Phase 1.5 unified RPC pack | **COMPLETE** | applied 2026-06-23; closure verified |
| P12 | PR #21 / Phase 2.18 merge | **COMPLETE** | on `main` |
| P13 | Rollback SQL packs (L1) | **COMPLETE** (artifacts) | per-company + phase-21x scripts |
| P14 | Expansion readiness checklist | **COMPLETE** (template) | docs/accounting |
| P15 | Three-company operational monitoring automation | **SAFE_TO_EXECUTE_NOW** | this run — `run-three-company-operational-monitoring.mjs` |
| P16 | Operational monitoring runbook | **SAFE_TO_EXECUTE_NOW** | this run |
| P17 | Post-baseline phase matrix + screen audit | **SAFE_DOCS_ONLY** | this run |
| P18 | R7 design-only closure pack | **SAFE_DOCS_ONLY** | no migration apply |
| P19 | R8 retirement readiness pack | **SAFE_DOCS_ONLY** | no retirement |
| P20 | Master roadmap / production ready updates | **SAFE_DOCS_ONLY** | this run |
| P21 | Three-company monitoring npm script + tests | **SAFE_SOURCE_FIX** | package.json + test harness |
| P22 | Next company unified rollout | **BLOCKED_NEEDS_FINANCE_SIGNOFF** | [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md) |
| P23 | R7 roznamcha_payment RPC apply | **BLOCKED_NEEDS_MIGRATION_APPROVAL** | design only — [`SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md) |
| P24 | Any new unified RPC / schema for BS-P&L-CF | **BLOCKED_NEEDS_MIGRATION_APPROVAL** | no loader flags exist; TB-derived path needs design |
| P25 | GL/data repair or posting changes | **BLOCKED_NEEDS_GL_DATA_APPROVAL** | system lockdown |
| P26 | R8 legacy engine retirement | **BLOCKED_R8_RETIREMENT** | [`PHASE8_LEGACY_RETIREMENT_MAP.md`](../../../docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md) |
| P27 | Balance Sheet unified main loader | **OPTIONAL_FUTURE** | legacy `getBalanceSheet`; no unified loader flag |
| P28 | P&L unified main loader | **OPTIONAL_FUTURE** | legacy `getProfitLoss` |
| P29 | Cash Flow unified main loader | **OPTIONAL_FUTURE** | `cashFlowReportService` |
| P30 | Day Book unified wiring | **OPTIONAL_FUTURE** | JE queries / optional account ledger RPC |
| P31 | COA party balances unified | **OPTIONAL_FUTURE** | Phase 2b in rollout plan |
| P32 | AR/AP Reconciliation unified | **OPTIONAL_FUTURE** | Phase 2b |
| P33 | Mobile ledger/report parity | **OPTIONAL_FUTURE** | deferred Phase 2.mobile; no unified flags in erp-mobile-app |
| P34 | Remaining Phase 2 screen wiring (BS, P&L, CF, mobile) | **OPTIONAL_FUTURE** | per-screen finance + ops approval |

---

## Verdict

All production-critical rollout and closure work is **COMPLETE**. Safe executable work in this run is **monitoring automation, runbook, audits, and docs**. R7, R8, next company, and remaining financial screens require **explicit blocked approvals**.
