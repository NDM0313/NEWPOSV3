# Single Core Ledger — Master Remaining Roadmap (post–DIN CHINA closure)

**Generated:** 2026-06-27T17:45:00Z  
**Main commit:** `bd813ec2`  
**Program scope:** OLD ERP / DIN Collection ERP — **not** the FX / multi-currency app  
**Program scope:** OLD ERP / DIN Collection ERP — **not** the FX / multi-currency app

---

## Scope statement

**DIN CHINA rollout is closed on `main`.** **DIN BRIDAL R5 complete.** **DIN COUTURE rollout complete** (12/12 flags, 5/5 loaders live @ 2026-06-27). Migration closure complete.

**The broader Single Core Ledger program is not complete.** Remaining work includes optional diagnostics, other-company expansion (blocked until finance sign-off), monitoring hardening, optional RPC design, and long-term legacy engine retirement. None of these may start without the approvals listed per phase.

---

## Completed scope (DIN CHINA + governance)

| Item | Evidence |
|------|----------|
| DIN CHINA five unified main loaders live | [`final-production-verify.md`](../phase-2-16-monitoring/final-production-verify.md) |
| Phase 2.16 monitoring PASS | [`phase-2-16-monitoring/`](../phase-2-16-monitoring/) |
| Phase 2.17 release governance | [`phase-2-17-release-governance/`](../phase-2-17-release-governance/) |
| PR #21 merged to `main` | https://github.com/NDM0313/NEWPOSV3/pull/21 |
| Phase 2.18 main merge + archive | [`main-merge-complete-report.md`](../phase-2-18-main-merge-closure/main-merge-complete-report.md), [`final-archive-and-monitoring-report.md`](../phase-2-18-main-merge-closure/final-archive-and-monitoring-report.md) |
| Rollback SQL pack (per loader L1) | `scripts/single-core-ledger/phase-21x-rollback-*.sql` |
| Expansion readiness checklist (template) | [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md) |
| Unified ledger unit tests (240) | `npm run test:unified-ledger` |

### DIN CHINA golden values (production truth)

| Screen | Fixture | Value |
|--------|---------|-------|
| Ledger V2 | MR JALIL closing | PKR 216,300 |
| Account Statement | MR JALIL closing | PKR 216,300 |
| Party Ledger | MR JALIL closing | PKR 216,300 |
| Trial Balance | debit = credit | PKR 407,957,271.02 |
| Roznamcha | Cash In / Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 |

---

## Workstream reconciliation table

| Phase / Workstream | Scope | Status | Evidence file | Risk if skipped | Required approval | Next action |
|--------------------|-------|--------|---------------|-----------------|-------------------|-------------|
| DIN CHINA loader rollout | 5 main loaders for DIN CHINA only | **Complete** | [`final-production-verify.md`](../phase-2-16-monitoring/final-production-verify.md) | N/A — live | Done (finance + ops) | None — maintain only |
| PR / main merge / archive | Governance merge to `main` | **Complete** | [`main-merge-complete-report.md`](../phase-2-18-main-merge-closure/main-merge-complete-report.md) | Low — code drift | Done | None |
| Phase 2.16 monitoring | Production browser + flags audit | **Complete** (authoritative) | [`final-production-verify.md`](../phase-2-16-monitoring/final-production-verify.md) | Medium — stale truth if never re-run | Ops for re-run | Re-run only when `QA_BROWSER_PASSWORD` available |
| Rollback pack readiness | L1 rollback SQL per loader | **Complete** (artifacts) | [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md) | High on future rollout | N/A | Keep scripts; do not execute without incident |
| Master roadmap + docs reconciliation (R1/R1B) | Align status wording across docs | **Complete** | [`r2-final-resolution-report.md`](../r2-cash-bank-admin-compare-diagnostic/r2-final-resolution-report.md) | — | Engineering | — |
| Phase 2.9A-CB / Admin Compare Cash/Bank cleanup (R2) | Shadow diagnostic labeling; raw GL vs roznamcha semantics | **Complete** | [`r2-final-resolution-report.md`](../r2-cash-bank-admin-compare-diagnostic/r2-final-resolution-report.md) | Low — production uses parity assembler | None for diagnostic | — |
| Docs inconsistency cleanup | Stale headers in 2.9 plan, production ready footer | **Complete** | R1B pass @ 2026-06-27 | — | Engineering | — |
| Other-company expansion planning | Per-company sign-off + golden capture plan | **Audit complete — next company blocked on finance sign-off** | [`r3-audit-complete-report.md`](../r3-pre-expansion-audit/r3-audit-complete-report.md) | High if skipped before rollout | **Finance sign-off** | Do not auto-start DIN COUTURE or any next company |
| Company-specific golden fixtures | Non–DIN CHINA golden JSON per company | **Candidate baselines captured** | [`din-bridal/golden-fixtures.json`](../din-bridal/golden-fixtures.json), [`din-couture/golden-fixtures.json`](../din-couture/golden-fixtures.json) | High — wrong enablement | Finance + operator | Finance validate shadow RPC baselines before R5 |
| Per-company staged pilot/engine/screen/loader enablement | Repeat 2.9→2.15 pattern per company | **Blocked for unapproved companies** | Expansion checklist + DIN CHINA/DIN BRIDAL phase reports | Critical — money/report errors | Finance + operator per step | DIN BRIDAL complete; next company needs separate sign-off |
| First non-DIN company pilot rollout | Full staged enablement for one company | **R5 COMPLETE — DIN BRIDAL live** @ 2026-06-27 | [`r5-soak-complete-report.md`](../r5-din-bridal-execution/r5-soak-complete-report.md) | — | — | Next company needs separate sign-off |
| Monitoring / accelerated waiver workflow | Extend Phase 2.16 script + waiver templates | **Optional** | [`run-phase-216-monitoring-verify.mjs`](../../../scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs) | Medium on future rollouts | Ops | Parameterize company/golden constants |
| Phase 1.5 unified ledger RPC migrations | Shadow + diagnostics + RPCs + indexes on production | **Complete** | [`migration-closure-final-report.md`](../migration-closure/migration-closure-final-report.md) | High if skipped | Done (applied 2026-06-23) | None — closure verified 2026-06-27 |
| `roznamcha_payment` RPC mode (R7) | Optional unified GL path for roznamcha rows | **Design-only** | [`SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md) | Low short-term | **Migration approval** | Do not apply without separate approval |
| Legacy engine retirement / cleanup | Deprecate `getCustomerLedger`, `roznamchaService`, etc. | **Blocked** (long-term) | [`SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md) §14, [`PHASE8_LEGACY_RETIREMENT_MAP.md`](../../../docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md) | High if premature | Finance + engineering after all target companies stable | Do not delete legacy paths yet |
| Remaining screen wiring (BS, P&L, Cash Flow, Day Book, COA balances, mobile) | Phase 2 rollout plan screens beyond five loaders | **Optional / future** | [`SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md) | Medium — screen-by-screen drift | Per-screen approval | Out of DIN CHINA closure scope |

---

## Pending / optional / blocked summary

### Complete (do not re-rollout DIN CHINA without incident)
- DIN CHINA five unified main loaders
- PR #21 merge and Phase 2.18 archive on `main`

### Complete (2026-06-27)
- **DIN COUTURE rollout** — unified loaders live with accelerated waiver — [`final-execution-report.md`](../next-company-rollout/din-couture/final-execution-report.md)

### Blocked (removed)
- ~~DIN COUTURE browser credentials~~ — resolved; rollout complete

### Complete (2026-06-27)
- **Migration closure** — Phase 1.5 applied; no approved pending migrations — [`migration-closure-final-report.md`](../migration-closure/migration-closure-final-report.md)
- **R5 post-completion archive** — commit reconciliation + monitoring baseline — [`r5-post-completion-commit-reconciliation.md`](../r5-din-bridal-execution/r5-post-completion-commit-reconciliation.md)
- **R3** Other-company pre-expansion audit + candidate golden baselines — [`r3-audit-complete-report.md`](../r3-pre-expansion-audit/r3-audit-complete-report.md)
- **R4** Per-company staged rollout runbook — [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md)

### Complete (2026-06-27)
- **R1/R1B** Master roadmap + docs reconciliation
- **R2** Cash/Bank Admin Compare diagnostic semantics (safe UI fix)

### Optional (no production impact if deferred)
- **R6** Monitoring + rollback automation hardening
- **R7** `roznamcha_payment` RPC design
- Remaining Phase 2 screen wiring (BS, P&L, Cash Flow, mobile parity)

### Blocked (explicit gate)
- **R4** Per-company staged rollout framework execution — blocked until finance sign-off per company
- **R5** First non-DIN company pilot — blocked until R3 + finance sign-off
- **R8** Legacy engine retirement — blocked until all target companies stable on unified loaders

---

## Large phase bundles (recommended execution order)

### R1 — Master roadmap + docs reconciliation
| Field | Detail |
|-------|--------|
| **Objective** | One authoritative program status; remove stale “PR READY”, “2.9A BLOCKED”, and “program complete” wording |
| **Files / areas** | `docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md`, phase plan headers (2.9, 2 rollout), this roadmap folder |
| **Safety** | Docs only — no flags, SQL, migrations, GL changes |
| **Verification** | Git diff docs/reports only; `npm run test:unified-ledger` unchanged |
| **Rollback** | Revert doc commit |
| **Finance sign-off** | No |
| **Operator approval** | No |
| **Production DB** | No |
| **Required?** | **Recommended next** |

### R2 — Cash/Bank / Admin Compare diagnostic cleanup
| Field | Detail |
|-------|--------|
| **Objective** | Close Phase 2.9A-CB backlog: Admin Compare Cash/Bank row parity or signed waiver; document roznamcha vs unified GL closing delta |
| **Files / areas** | `src/app/lib/roznamchaCashBankCompareMappers.ts`, `unifiedLedgerCashBankCompareService.ts`, Admin Compare UI, compare reports |
| **Safety** | Shadow/diagnostic only — **no** production loader or flag changes |
| **Verification** | Admin Compare Cash/Bank on preview or read-only prod session; unit tests in `roznamchaCashBankCompareMappers.test.ts` |
| **Stop condition** | Any requirement to switch roznamcha main loader semantics → stop; DIN CHINA loader already live |
| **Finance sign-off** | Only if closing delta waiver needed for audit |
| **Operator approval** | Yes for production browser QA |
| **Production DB** | No |
| **Required?** | **Optional** |

### R3 — Other-company pre-expansion audit + golden fixture capture
| Field | Detail |
|-------|--------|
| **Objective** | Select target company; finance sign-off; capture legacy golden fixtures before any flag |
| **Files / areas** | `reports/single-core-ledger/<company-slug>/golden-fixtures.json`, expansion checklist, tie-out scripts |
| **Safety** | Read-only production queries / browser capture — **no** flag enablement |
| **Verification** | Golden JSON reviewed by finance; Admin Compare baseline 9/9 equivalent |
| **Stop condition** | No finance sign-off → stop |
| **Finance sign-off** | **Yes — mandatory** |
| **Operator approval** | Yes |
| **Production DB** | Read-only only |
| **Required?** | **Pending** (before any non-DIN rollout) |

### R4 — Per-company staged rollout framework
| Field | Detail |
|-------|--------|
| **Objective** | Operationalize DIN CHINA 2.9→2.15 runbook as reusable per-company playbook (pilot → engine → screens → loaders one-at-a-time) |
| **Files / areas** | `docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`, `scripts/single-core-ledger/phase-21x-*.sql` (artifacts), monitoring script |
| **Safety** | Framework docs + parameterized scripts — SQL **not executed** until R5 |
| **Verification** | Dry-run checklist against DIN CHINA evidence |
| **Finance sign-off** | Template only until R5 |
| **Operator approval** | Yes when executing |
| **Production DB** | Only during R5 execution |
| **Required?** | **Pending** (parallel with R3 planning) |

### R5 — First non-DIN company pilot rollout
| Field | Detail |
|-------|--------|
| **Objective** | Repeat staged enablement for one approved company |
| **Files / areas** | Same as DIN CHINA phases 2.9–2.15; company-specific golden reports |
| **Safety** | One company; one loader at a time; L1 rollback ready |
| **Verification** | Phase 2.16-style monitoring; golden match; flags audit (only target company ON) |
| **Stop condition** | Any golden fail → L1 rollback that loader |
| **Finance sign-off** | **Yes — mandatory** |
| **Operator approval** | **Yes — per step** |
| **Production DB** | Yes — flag SQL only with approval |
| **Required?** | **Blocked** until R3 complete |

### R6 — Monitoring + rollback automation hardening
| Field | Detail |
|-------|--------|
| **Objective** | Parameterize `run-phase-216-monitoring-verify.mjs` for company/golden; document accelerated waiver workflow |
| **Files / areas** | `scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs`, `unifiedLedgerBrowserQaHelpers.mjs`, phase-2-16 reports |
| **Safety** | Read-only browser QA + flag read scripts |
| **Verification** | Script PASS against DIN CHINA (regression); dry-run for second company config |
| **Finance sign-off** | For accelerated waiver only |
| **Operator approval** | For production monitoring runs |
| **Production DB** | Read-only |
| **Required?** | **Optional** (recommended before R5) |

### R7 — Optional `roznamcha_payment` RPC mode
| Field | Detail |
|-------|--------|
| **Objective** | Design/additive RPC path for payment-linked roznamcha rows if pure GL mode desired |
| **Files / areas** | New migration under `migrations/`, unified RPC family, roznamcha mappers |
| **Safety** | **No migration apply** without explicit approval; DIN CHINA roznamcha loader uses journal-path filter today |
| **Verification** | Shadow compare only until approved |
| **Stop condition** | Migration approval missing → design docs only |
| **Finance sign-off** | Yes before apply |
| **Operator approval** | Yes |
| **Production DB** | Only after approved migration |
| **Required?** | **Optional future** |

### R8 — Legacy engine retirement / cleanup
| Field | Detail |
|-------|--------|
| **Objective** | Master plan Phase 5: deprecate `getCustomerLedger`, `customerLedgerApi`, `effectivePartyLedgerService`, legacy roznamcha paths |
| **Files / areas** | `src/app/services/accountingService.ts`, `customerLedgerApi.ts`, `effectivePartyLedgerService.ts`, `erp-mobile-app/` |
| **Safety** | **Blocked** until all target companies on unified loaders + 2–4 week stable window per master plan |
| **Verification** | Full golden set; mobile parity; export parity |
| **Stop condition** | Any company still on legacy main loader |
| **Finance sign-off** | Yes |
| **Operator approval** | Yes |
| **Production DB** | No data mutation; code removal only after sign-off |
| **Required?** | **Blocked long-term** |

---

## Recommended next phase

**R5 — First non-DIN company pilot rollout** — **blocked** until finance sign-off, target company selection, and legacy browser golden capture (especially roznamcha parity).

**R3 audit is complete** — see [`r3-audit-complete-report.md`](../r3-pre-expansion-audit/r3-audit-complete-report.md).

**Do not start R5** without finance sign-off artifact and operator target company selection.

---

## What not to do

- Do **not** enable other companies' unified loaders without finance sign-off
- Do **not** run migrations or execute flag SQL during planning or doc tasks
- Do **not** mutate GL, journal entries, payments, or production balances
- Do **not** touch the FX / multi-currency app
- Do **not** treat DIN CHINA closure as “entire program complete”
- Do **not** delete legacy ledger engines until R8 gates pass

---

## Recommended next consolidated prompt (operator copy)

```text
Single Core Ledger program — post–DIN CHINA closure.

Context:
- DIN CHINA five unified main loaders are CLOSED on main (PR #21 merged).
- Phase 2.16 production monitoring is authoritative.
- Broader program has pending/optional phases — see reports/single-core-ledger/master-roadmap-after-din-china-closure/master-remaining-roadmap.md

Task: Execute phase [R1|R2|R3|R6] only.
Hard constraints: no flags, no migrations, no SQL execution, no GL mutations, no other-company enablement without finance sign-off, no FX app.

If R3/R5: require finance sign-off artifact before any production DB access.
If R2: shadow/diagnostic only — do not change DIN CHINA main loaders.
Return: status, evidence files, gates PASS/FAIL, stop conditions.
```

---

## Authoritative doc index

| Document | Role |
|----------|------|
| [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Live DIN CHINA truth + program entry |
| [`SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md) | Long-term migration architecture |
| [`SINGLE_CORE_LEDGER_MIGRATION.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_MIGRATION.md) | Engine analysis + UCLE target |
| [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md) | Other-company gate |
| [`master-remaining-roadmap.json`](master-remaining-roadmap.json) | Machine-readable roadmap |

---

## Final statement

**DIN CHINA Single Core Ledger rollout is closed on `main`. No further DIN CHINA rollout phases are required** unless a production incident triggers per-loader L1 rollback and re-enable.

**The overall Single Core Ledger program continues** with optional diagnostics, expansion planning (blocked on finance), and long-term legacy retirement — each requiring its own approvals.
