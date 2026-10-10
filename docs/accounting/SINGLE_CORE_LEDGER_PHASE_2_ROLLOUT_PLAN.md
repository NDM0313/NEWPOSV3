# Single Core Ledger Phase 2 — Screen Wiring + Controlled Engine Rollout Plan

> **Historical note:** Plan written 2026-06-25 when engine was OFF by default. DIN CHINA preview wiring and five unified main loaders are **live**; broader program phases remain in [`master-remaining-roadmap.md`](../reports/single-core-ledger/master-roadmap-after-din-china-closure/master-remaining-roadmap.md).

**Status:** `HISTORICAL PLAN — DIN CHINA SCREENS LIVE; remaining screens optional future`  
**Mode:** PLAN — superseded for DIN CHINA by Phases 2.10–2.15 execution  
**Branch:** `feature/single-core-ledger-phase-2-rollout-plan`  
**Base:** `feature/single-core-ledger-phase-1-8-post-migration-validation` @ `4c4bc8e3`  
**Last updated:** 2026-06-25

**Prerequisite (complete):** Phase 1.8 — Gate A **PASS 3/3**, tie-out **PASS 9/9**, MR JALIL **PKR 216,300**, engine **OFF**. Master: [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](SINGLE_CORE_LEDGER_PRODUCTION_READY.md).

---

## 1. Branch strategy

| Item | Value |
|------|-------|
| **New branch** | `feature/single-core-ledger-phase-2-rollout-plan` |
| **Base** | `feature/single-core-ledger-phase-1-8-post-migration-validation` @ `4c4bc8e3` |
| **Do not merge** | `main`, `feature/single-core-ledger-phase-1-7-prod-migration-plan`, or 1.6.2 approval branch until ops sign-off |
| **PR style** | One **plan-only** PR first; implementation split into small follow-up PRs (see §6) |

---

## 2. Phase 2 scope

### In scope
- Wire **read paths** on ledger/report screens to [`unifiedLedgerService.ts`](../../src/app/services/unifiedLedgerService.ts) RPCs behind flags
- **Preview / shadow** modes using existing `shadowForce` pattern ([`UnifiedLedgerTieOutPage.tsx`](../../src/app/components/admin/UnifiedLedgerTieOutPage.tsx))
- Basis lens selection: `official_gl`, `effective_party`, `audit_full_history` ([`unifiedLedgerBasisFilter.ts`](../../src/app/lib/unifiedLedgerBasisFilter.ts); UI: [`financialTruthBasis.ts`](../../src/app/lib/financialTruthBasis.ts) — map `audit_full` ↔ `audit_full_history`)
- Visible engine/basis banners on wired screens
- Pilot company rollout (DIN CHINA first)
- Parallel old-vs-new comparison before any screen becomes default

### Out of scope
- New accounting logic, GL posting changes, payment/expense edit flows
- AR/AP reclassification, opening balance repair, metadata remediation
- Removing legacy engines (`accountingService`, `accountingReportsService`, `roznamchaService`, `effectivePartyLedgerService`)
- Enabling `unified_ledger_engine` for all users on merge/deploy
- Mobile native parity in first implementation wave (defer to Phase 2.mobile)

---

## 3. Screens/modules inventory

| Screen | Route / entry | Current data source | Target unified RPC | Default lens | Risk | Legacy fallback | Pilot-ready |
|--------|---------------|---------------------|-------------------|--------------|------|-----------------|-------------|
| Unified Tie-Out (admin) | `/admin/unified-ledger-tieout` | `unifiedLedgerTieOutService` | `get_unified_party_ledger` | All three | Low | N/A (compare) | **Yes** |
| Accounting Developer Center | `/admin/accounting-developer-center` | Trace tabs | Diagnostics + shadow party | Mixed | Low | Current tabs | **Yes** |
| Financial Trace Center | `/admin/financial-trace-center` | `financialTraceCenterService` | `get_single_core_ledger_systemwide_diagnostics` | `official_gl` | Low | Legacy TB | **Yes** |
| Accounting Integrity Lab | `accounting-integrity-lab` | `accountingIntegrityLabService` | Diagnostics + TB | `official_gl` | Low | Legacy checks | **Yes** |
| Ledger Statement V2 | Accounting → Statements → Advanced | `ledgerStatementCenterV2Service` | `get_unified_party_ledger` / `get_unified_account_ledger` | `effective_party` / `official_gl` | **High** | V2 legacy path | **Yes — DIN CHINA** |
| Account Statement (standard) | Accounting → Statements → Standard | `AccountLedgerReportPage` | Same unified RPCs | `effective_party` / `official_gl` | **High** | Full legacy page | **Yes** |
| Effective Party Ledger | `party-ledger` | `effectivePartyLedgerService` | `get_unified_party_ledger` | `effective_party` / `audit_full_history` | Medium | EffectivePartyLedgerPage | **Yes** |
| AR/AP Reconciliation | `ar-ap-reconciliation-center` | Party GL RPCs | Unified party balance | `effective_party` | Medium | Legacy | Phase 2b |
| Trial Balance | Reports → Trial Balance | `getTrialBalance` | `get_unified_trial_balance` | `official_gl` | **High** | TB legacy | After ledger |
| Balance Sheet | Reports → Balance Sheet | `getBalanceSheet` | Unified TB derived | `official_gl` | **High** | BalanceSheetPage | After TB |
| P&L | Reports → Profit & Loss | `getProfitLoss` | Unified TB + mapping | `official_gl` | Medium | ProfitLossPage | After TB |
| Roznamcha / Cash Book | Accounting `roznamcha` | `roznamchaService` | `get_unified_cash_bank_ledger` | `official_gl` | **High** | RoznamchaReport | Phase 2c |
| Cash Flow | Accounting `cash_flow` | `cashFlowReportService` | `get_unified_cash_bank_ledger` | `official_gl` | Medium | Legacy | Phase 2c |
| Day Book | Reports → Day Book | JE queries | `get_unified_account_ledger` or legacy | `official_gl` | Medium | DayBookReport | Phase 2d |
| COA party balances | Accounting → Accounts | `get_contact_party_gl_balances` | Unified party RPC | `effective_party` | Medium | COA rows | Phase 2b |

**Lens usage**

| Lens | Primary screens |
|------|-----------------|
| `official_gl` | TB, BS, P&L, Cash/Bank, account statements |
| `effective_party` | Party statements, collections, party ledger |
| `audit_full_history` | Developer tie-out, audit mode, trace views |

**Parity tooling:** [`ledgerStatementParityDiagnostics.ts`](../../src/app/services/ledgerStatementParityDiagnostics.ts), [`run-unified-ledger-tieout.mjs`](../../scripts/run-unified-ledger-tieout.mjs).

---

## 4. Feature flag design

**Current:** [`unifiedLedgerFeatureFlag.ts`](../../src/app/lib/unifiedLedgerFeatureFlag.ts) — default OFF; DB per company; dev `localStorage` override.

| Flag | Scope | Default | Purpose |
|------|-------|---------|---------|
| `unified_ledger_engine` | Company | **OFF** | Master enable |
| `unified_ledger_kill_switch` | Global (planned) | **OFF** | Emergency legacy everywhere |
| `unified_ledger_pilot` | Company | **OFF** | Admin preview toggles |
| `unified_ledger_screen_*` | Company (optional) | **OFF** | Per-screen fallback |
| `localStorage` override | Dev only | unset | Never in prod deploy |

**Resolution order:** kill switch → localStorage (dev) → per-screen flag → company engine → default OFF.

**Rules:** No auto-enable on deploy; pilot enablement = manual ops step; no flag migrations in Phase 2 SQL.

---

## 5. Pilot rollout strategy

| Wave | Company | Company ID | Golden parties | Gate |
|------|---------|------------|----------------|------|
| 1 | DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` | MR JALIL, CUS-0000 | Old/new PASS 1 day |
| 2 | DIN BRIDAL | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` | Branch JEs | After wave 1 |
| 3 | Remaining | tie-out set | 9/9 contacts | After wave 2 |
| 4 | All companies | — | Sample tie-out | Ops approval |

**Pilot roles:** `admin`, `super_admin`, `developer`, `accounting_auditor` — preview; `staff`/`manager` — legacy until flags ON.

---

## 6. Screen wiring order

| Phase | PR theme | Flag behavior |
|-------|----------|---------------|
| 2.0 | Plan doc only | — |
| 2.1 | Flag + banner infrastructure | Kill switch + banners |
| 2.2 | Admin comparison tabs | `shadowForce` only |
| 2.3 | Ledger V2 preview toggle | Preview only |
| 2.4 | Account Statement preview | Legacy default |
| 2.5 | Party-ledger preview | Legacy default |
| 2.6 | Roznamcha side-by-side | Legacy default |
| 2.7 | Trial Balance preview | Legacy default |
| 2.8 | DIN CHINA default (one screen) | Company flag |
| 2.9 | BS / P&L | Per-screen flags |
| 2.10 | Expand pilot | Ops approval each wave |

**Do not** replace all screens in one PR.

---

## 7. Parallel old-vs-new comparison plan

| Dimension | Pass rule |
|-----------|-----------|
| Closing balance | Exact ±0.01 PKR for golden parties |
| Row count | Document deltas; basis may differ |
| Missing/extra rows | Zero unexplained for pilot sign-off |
| Basis | `audit_full` ↔ `audit_full_history` explicit |
| Date range / branch | Same filters both engines |
| Export/print | Totals match |
| Performance | No timeout regression |

Artifacts: `reports/single-core-ledger/phase2-compare-*.json`.

---

## 8. UI safety banners / diagnostics

| Banner | When |
|--------|------|
| Legacy engine | Production default |
| Unified preview | Admin/pilot compare mode |
| Engine OFF | Flag off, no preview |
| Official GL / Effective party / Audit full history | Per lens |
| Kill switch active | Global kill ON |

Extend [`ReportBasisBanner.tsx`](../../src/app/components/accounting/ReportBasisBanner.tsx); surface `UnifiedLedgerMeta` on preview screens.

---

## 9. Testing plan

- Unit: basis, branch, flag resolution, compare helpers
- Integration: clone `ledger_stage_20260625_prodcheck`
- Parity: MR JALIL **216,300**; DIN CHINA 9/9; date/branch/basis matrix
- E2E: admin preview on erp.dincouture.pk
- Regression: `npm run test:unified-ledger` every PR
- Clone Gate A after major PRs: `run-phase-18-post-migration-validation.sh`

---

## 10. Production rollout plan

1. Deploy code — **all flags OFF**
2. Admin preview routes live
3. `unified_ledger_pilot` ON for DIN CHINA (manual ops)
4. 1-day parallel compare (read-only RPCs)
5. Per-screen default flip — one at a time
6. Expand companies — ops approval each wave
7. Kill switch drill in staging

**Deploy rule:** flag enablement is a **separate approval ticket**.

---

## 11. Rollback plan

| Scenario | Action | DB |
|----------|--------|-----|
| Preview wrong | Disable toggle | None |
| Pilot wrong | Company flag OFF | Flag only |
| Emergency | Kill switch ON | Flag only |
| Bad deploy | Redeploy prior bundle | None |
| RPC issue | Flags OFF; keep RPCs | None |

Preserve Phase 1.8 and compare JSON artifacts.

---

## 12. What remains blocked

| Item | Status |
|------|--------|
| `unified_ledger_engine` ON globally | **Blocked** until plan + pilot sign-off |
| Phase 2 implementation (2.1+) | **Blocked** until plan approved |
| Merge / deploy | **Ops decision** |
| Legacy engine removal | **Blocked** until 2–4 weeks parity |
| Mobile wiring | **Blocked** until web pilot |

---

## 13. Acceptance criteria

Phase 2 **plan** acceptable when:

- [x] Engine OFF by default in code and runbook
- [x] Every screen has legacy fallback named
- [x] Pilot scoped DIN CHINA → DIN BRIDAL → all
- [x] Old/new diff before default switch
- [x] Kill switch + rollback documented
- [x] No data mutation in Phase 2 scope
- [x] Small PR split defined
- [x] Three lenses mapped
- [x] MR JALIL + DIN CHINA fixtures named
- [x] Mobile deferred

---

## 14. Final status

**`PHASE 2 PLAN READY — waiting for approval to implement preview-only wiring`**

---

## Implementation sequence (after plan approval — not now)

1. ~~Branch `feature/single-core-ledger-phase-2-rollout-plan`~~ **Done**
2. ~~This document + `PRODUCTION_READY.md` update~~ **Done**
3. Draft PR — plan only
4. PR 2.1 (flags + banners) — engine OFF
5. Stop before any pilot flag change on production

---

## Related documents

| Document | Purpose |
|----------|---------|
| [Production ready pack](SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Master status |
| [Phase 1.8 validation](SINGLE_CORE_LEDGER_PHASE_1_8_POST_MIGRATION_VALIDATION_REPORT.md) | Gate A evidence |
| [Migration master plan v3](SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md) | Program context |
