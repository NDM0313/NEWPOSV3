# R8-R2 Legacy Deletion Readiness Plan

**Date:** 2026-07-11  
**Scope:** OLD ERP / DIN Collection ERP — physical legacy **main-loader** code removal  
**R8-R1 status:** Operational retirement **COMPLETE** (2026-07-10)  
**R8-R2 status:** **Not started** — readiness planning only

## Do not delete

This document is a **readiness plan**. No code, imports, kill switches, or rollback branches were removed in this session.

**Blocker:** `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`

---

## R8-R1 baseline (retained intentionally)

| Item | Status |
|------|--------|
| Unified main loaders ON | 8 screens × 3 companies (54 flags) |
| Kill switch | OFF in production |
| Legacy loader **code** | **Retained** for L0/L1 rollback |
| Pre-R8 git tag | `r8-pre-operational-retirement-20260710` @ `ba7dadd7` |
| Evidence | `reports/r8-legacy-retirement-execution-20260710/` |

---

## Kill-switch and rollback (must retain until drill complete)

| Layer | Mechanism | Location |
|-------|-----------|----------|
| L0 DB | `unified_ledger_kill_switch` | `unifiedLedgerEngineState.ts` |
| L0 Env | `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true` | build-time |
| L1 SQL | 35 rollback scripts | `scripts/single-core-ledger/**/rollback-*.sql` |
| L2 Deploy | Tag checkout + `deploy/vps-build-erp-only.sh` | ops runbook |
| Resolver triple-gate | kill → flag → engine → screen | 8× `resolve*MainLoaderSource.ts` |
| BS/P&L error fallback | unified failure → legacy service | `BalanceSheetPage.tsx`, `ProfitLossPage.tsx` |
| Loader guard | SSH read-only SQL | `threeCompanyLoaderGuard.mjs` |

---

## Legacy inventory table

| Legacy path | Canonical replacement | Runtime refs | Test refs | Rollback dependency | Proposed action | Readiness | Blocker |
|-------------|----------------------|--------------|-----------|---------------------|-----------------|-----------|---------|
| Ledger V2 main — `getLedgerStatementV2()` | `getLedgerStatementV2UnifiedMain()` | 4 files | 18+ tests | L1 `phase-210-rollback-loader-ledger-v2.sql` | Remove page legacy branch after drill | **NEEDS MORE SOAK** | Kill-switch drill; `getCustomerLedger` hybrid |
| Account Statement — `loadAccountStatementLegacyMain()` | `loadAccountStatementUnifiedMain()` | 3 files | 20+ tests | L1 `phase-211-rollback-account-statement-loader.sql` | Delete legacy main service + page branch | **NEEDS KILL-SWITCH DRILL** | Customer hybrid dependency |
| Trial Balance — `loadTrialBalanceLegacyMain()` | `loadTrialBalanceUnifiedMain()` | 3 files | 20+ tests | L1 `phase-212-rollback-trial-balance-loader.sql` | Delete page branch; **keep** `getTrialBalance` for dashboards | **NEEDS MORE SOAK** | Soak + drill |
| Party Ledger — `loadPartyLedgerLegacyMain()` | `loadPartyLedgerUnifiedMain()` | 3 files | 20+ tests | L1 `phase-213-rollback-party-ledger-loader.sql` | Delete page branch | **NEEDS MORE SOAK** | Phase 8 effective-party parity |
| Roznamcha — `loadRoznamchaLegacyMain()` | `loadRoznamchaUnifiedMain()` | 3 files | 22+ tests | L1 `phase-214-rollback-roznamcha-loader.sql` | Delete page branch; keep service for cash-flow shadow | **NEEDS MORE SOAK** | Soak + drill |
| Cash Flow — `getCashFlowReport()` page branch | `loadCashFlowUnifiedMain()` | 3 files | 12+ tests | L1 `phase-3b-m-cash-flow-loader-swap/rollback-*.sql` | Delete page branch | **NEEDS MORE SOAK** | Mobile legacy fallthrough |
| Balance Sheet page legacy branch | `loadBalanceSheetUnifiedMain()` | 4+ indirect | 12+ tests | `disable-bs-pl-loader-flags.sql` | Page branch only; keep dashboard uses | **STILL REFERENCED** | Live error fallback |
| P&L page legacy branch | `loadProfitLossUnifiedMain()` | 4+ indirect | 10+ tests | Same as BS | Page branch only | **STILL REFERENCED** | Live error fallback |
| Legacy shadow compare (5 services) | Unified preview panels | ~30 refs | ~25 tests | Diagnostic contract | **DO NOT DELETE** in R8-R2 | **DO NOT DELETE** | Admin Compare / monitoring |
| `getCustomerLedger` hybrid | `get_unified_party_ledger` RPC | 15 files | 2 tests | Phase 8 map | **DO NOT DELETE** in R8-R2 | **DO NOT DELETE** | Phase 8 not started |
| 8× resolvers + engine state | Same (gates) | ~50 refs | 100+ tests | L0/L1 rollback | Keep through R8-R2 | **DO NOT DELETE** | Drill not executed |
| Mobile legacy paths | `unifiedLedgerRpc.ts` | ~12 refs | 0 dedicated | L0 kill switch | Out of web R8-R2 scope | **STILL REFERENCED** | Separate mobile approval |
| L1 rollback SQL (35 files) | N/A | ops only | 5 tests | Primary rollback | **DO NOT DELETE** | **READY FOR FUTURE REVIEW** (keep) | None |
| Loader guard scripts | N/A | 2 scripts | 5 tests | Production baseline | **DO NOT DELETE** | **READY FOR FUTURE REVIEW** (keep) | None |

---

## Prerequisites before any deletion

1. **30-day production soak** from R8-R1 (started 2026-07-10; office verify 2026-07-11 PASS).
2. **Kill-switch drill (L0/L1)** without code revert — **NOT DONE**.
3. **Written approval:** `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.
4. Fresh three-company monitoring PASS after drill.
5. `npm run test:unified-ledger` (336+) and `npm run build` PASS.
6. VPS deploy only if `src/` deletion diff exists.

## Recommended deletion order (future, post-approval)

1. Thin `*LegacyMainService.ts` wrappers (Account Stmt, TB, Party, Roznamcha).
2. Ledger V2 page legacy branch (keep `getLedgerStatementV2` until Phase 8).
3. Cash Flow page legacy branch.
4. BS/P&L page branches — **last** (after removing try/catch fallback).
5. Defer: shadow compare, `getCustomerLedger`, mobile fallbacks, resolvers.

## Evidence package required (before deletion)

- Kill-switch drill log + monitoring artifact
- Pre/post Admin Compare for DIN CHINA
- Git tag `r8-r2-pre-code-deletion-{date}`
- Rollback rehearsal confirmation (L1 SQL only)
- Operator sign-off referencing `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`

## Explicit stop point

**Stop before deleting any file** until all prerequisites above are met and operator approval is recorded.

---

`R8_R2_CODE_DELETION_APPROVAL_REQUIRED`
