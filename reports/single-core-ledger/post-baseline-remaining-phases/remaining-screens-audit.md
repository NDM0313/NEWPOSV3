# Remaining screens audit — post three-company baseline

**Run:** POST-BASELINE REMAINING PHASES  
**Generated:** 2026-06-14T00:00:00Z  
**Live unified main loaders:** Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha (5/5 per company)

---

## Executive summary

Five high-risk ledger screens are **live on unified main loaders** for DIN CHINA, DIN BRIDAL, and DIN COUTURE. Remaining Phase 2 screens (Balance Sheet, P&L, Cash Flow, Day Book, COA balances, mobile) remain on **legacy data paths** with **no unified loader flags** in [`unifiedLedgerFlagKeys.ts`](../../../src/app/lib/unifiedLedgerFlagKeys.ts). Safe improvement in this run: **docs-only classification** — no migration or loader changes.

---

## Screen inventory

| Screen | Current data source | Unified preview | Unified main loader | RPC support | Migration needed | GL mutation | Risk | Recommendation |
|--------|---------------------|-----------------|---------------------|-------------|------------------|-------------|------|----------------|
| Ledger V2 | `ledgerStatementCenterV2Service` / unified RPCs | Yes | **Yes** (`unified_ledger_loader_ledger_v2`) | `get_unified_party_ledger`, `get_unified_account_ledger` | No (live) | No | High | **COMPLETE** |
| Account Statement | `AccountLedgerReportPage` | Yes | **Yes** | Same | No (live) | No | High | **COMPLETE** |
| Trial Balance | `getTrialBalance` / unified | Yes | **Yes** | `get_unified_trial_balance` | No (live) | No | High | **COMPLETE** |
| Party Ledger | `effectivePartyLedgerService` | Yes | **Yes** | `get_unified_party_ledger` | No (live) | No | Medium | **COMPLETE** |
| Roznamcha | `roznamchaService` + parity assembler | Yes | **Yes** | `get_unified_cash_bank_ledger` + journal path | No (live) | No | High | **COMPLETE** |
| Balance Sheet | `accountingReportsService.getBalanceSheet` | No dedicated preview | **No flag** | Could derive from unified TB (`official_gl`) | Likely new flags + mapping QA | No for read-only wiring | High | **optional future** — blocked on per-screen design + finance sign-off |
| P&L | `accountingReportsService.getProfitLoss` | No | **No flag** | Unified TB + account mapping | Likely flags + golden capture | No for read-only | Medium | **optional future** |
| Cash Flow | `cashFlowReportService` | No | **No flag** | Partial via `get_unified_cash_bank_ledger` | Design + parity plan | No for read-only | Medium | **optional future** |
| Day Book | JE queries / legacy | No | **No flag** | `get_unified_account_ledger` possible | Phase 2d per rollout plan | No for read-only | Medium | **optional future** |
| COA party balances | `get_contact_party_gl_balances` | Admin compare only | **No flag** | Unified party RPC exists | Phase 2b | No for read-only | Medium | **optional future** |
| AR/AP Reconciliation | Party GL RPCs | Partial | **No flag** | Unified party balance | Phase 2b | No for read-only | Medium | **optional future** |
| Mobile ERP reports | Capacitor app — legacy services | No grep hits for `unified_ledger` | **No** | Same Supabase RPCs when called | Mobile phase deferred | No | Medium | **optional future** — Phase 2.mobile |

---

## Admin / diagnostic (complete — no main loader swap)

| Screen | Status |
|--------|--------|
| Unified Tie-Out | Live — compare only |
| Admin Compare | Live — shadow/diagnostic (R2 closed) |
| Developer Center / Integrity Lab | Live — diagnostics |

---

## Safe fixes applied this run

**None required for remaining screens** — no stale UI bug identified that affects live unified loader truth. Balance Sheet / P&L / Cash Flow correctly remain on legacy until explicit Phase 2.9+ per-screen program with finance approval.

---

## Blocked implementations

Any unified **main loader swap** for BS, P&L, Cash Flow, Day Book, or mobile requires:

1. Finance sign-off per company  
2. Golden fixture capture  
3. Per-screen feature flags (additive DB rows — ops step, not migration file in this program state)  
4. Staged pilot → engine → screen → loader pattern per [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md)

**Do not implement in this run.**
