# Remaining tasks master register — Single Core Ledger

**Status:** `REMAINING TASKS MASTER REGISTER COMPLETE`  
**Program mode:** Production ops  
**Generated:** 2026-06-29T14:00:00.000Z  
**Latest main at start:** `fdb68235`

---

## Classification key

| Class | Meaning |
|-------|---------|
| `COMPLETE` | Done; maintain only |
| `ONGOING_OPS` | Daily/weekly read-only monitoring |
| `SAFE_DOCS_ONLY` | Documentation updates without runtime impact |
| `SAFE_LOCAL_CLEANUP` | Review local files; no delete without approval |
| `SAFE_AUDIT_ONLY` | Read-only audits; no GL/flag changes |
| `OPTIONAL_FUTURE` | Deferred; per-screen/per-feature approval |
| `BLOCKED_NEEDS_FINANCE_SIGNOFF` | Finance written approval required |
| `BLOCKED_NEEDS_MIGRATION_APPROVAL` | Approved migration + backup required |
| `BLOCKED_R7` | R7 design-only until all gates met |
| `BLOCKED_R8` | Legacy retirement blocked |
| `BLOCKED_NEEDS_DATA_APPROVAL` | GL/journal/payment/balance mutations |

---

## Master register

| ID | Task | Class | Evidence / pointer |
|----|------|-------|-------------------|
| T01 | Three-company unified ledger baseline (DIN CHINA · BRIDAL · COUTURE) | **COMPLETE** | [`final-production-ops-handoff.md`](final-production-ops-handoff.md) |
| T02 | Migration closure — no pending approved migrations | **COMPLETE** | [`migration-closure-final-report.md`](../migration-closure/migration-closure-final-report.md) |
| T03 | Monitoring credential hardening | **COMPLETE** | [`credential-hardening-report.md`](../operational-monitoring/credential-hardening-report.md) |
| T04 | Ops schedule + incident runbook | **COMPLETE** | [`ops-schedule-closure-report.md`](../operational-monitoring/ops-schedule-closure-report.md) |
| T05 | Password rotation + post-rotation monitoring PASS | **COMPLETE** | [`password-rotation-final-closure-manifest.json`](../operational-monitoring/password-rotation-final-closure-manifest.json) |
| T06 | Final production ops handoff archive | **COMPLETE** | [`final-production-ops-handoff-manifest.json`](final-production-ops-handoff-manifest.json) |
| T07 | Scheduled three-company monitoring | **ONGOING_OPS** | `npm run monitor:three-company-unified-ledger` |
| T08 | Windows Task Scheduler / launchd setup | **ONGOING_OPS** | [`windows-task-scheduler-guide.md`](../operational-monitoring/windows-task-scheduler-guide.md) |
| T09 | Remaining tasks register (this doc) | **SAFE_DOCS_ONLY** | This file |
| T10 | Office PC local change inventory | **SAFE_LOCAL_CLEANUP** | [`office-pc-local-change-inventory.md`](office-pc-local-change-inventory.md) |
| T11 | Seven-phase remaining plan | **SAFE_DOCS_ONLY** | [`seven-phase-remaining-plan.md`](seven-phase-remaining-plan.md) |
| T12 | Operator decision dashboard | **SAFE_DOCS_ONLY** | [`operator-decision-dashboard.md`](operator-decision-dashboard.md) |
| T13 | BS / P&L / Cash Flow / Day Book / COA unified loader audit | **SAFE_AUDIT_ONLY** | [`remaining-screens-audit.md`](../post-baseline-remaining-phases/remaining-screens-audit.md) |
| T14 | Mobile unified parity audit | **SAFE_AUDIT_ONLY** | Master roadmap Phase 2.mobile |
| T15 | Safe report/UI labeling fixes (no loader/GL change) | **OPTIONAL_FUTURE** | R2 pattern — diagnostic labeling only |
| T16 | R6 monitoring automation hardening | **OPTIONAL_FUTURE** | [`r6-completion-report.md`](../r6-monitoring-hardening/r6-completion-report.md) |
| T17 | Balance Sheet unified loader | **OPTIONAL_FUTURE** | Per-screen design + golden capture |
| T18 | P&L unified loader | **OPTIONAL_FUTURE** | Per-screen design + golden capture |
| T19 | Cash Flow unified loader | **OPTIONAL_FUTURE** | Per-screen design + golden capture |
| T20 | Next company rollout (4th company+) | **BLOCKED_NEEDS_FINANCE_SIGNOFF** | [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) |
| T21 | R7 roznamcha_payment RPC migration | **BLOCKED_R7** | [`SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md) |
| T22 | R8 legacy engine retirement | **BLOCKED_R8** | [`PHASE8_LEGACY_RETIREMENT_MAP.md`](../../../docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md) |
| T23 | Ad-hoc GL / journal / payment repair | **BLOCKED_NEEDS_DATA_APPROVAL** | Incident runbook only |
| T24 | FX / multi-currency app | **OUT_OF_SCOPE** | Separate product |

---

## Summary counts

| Class | Count |
|-------|-------|
| COMPLETE | 6 |
| ONGOING_OPS | 2 |
| SAFE_DOCS_ONLY | 3 |
| SAFE_LOCAL_CLEANUP | 1 |
| SAFE_AUDIT_ONLY | 2 |
| OPTIONAL_FUTURE | 5 |
| BLOCKED (all types) | 4 |
| OUT_OF_SCOPE | 1 |

---

## Constraints

Remaining phases are **classified, not automatically approved**. R7, R8, and next company remain blocked until separate approval. Safe next step: local cleanup review dry-run.
