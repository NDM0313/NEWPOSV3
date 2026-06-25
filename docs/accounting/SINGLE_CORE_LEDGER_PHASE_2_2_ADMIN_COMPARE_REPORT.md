# Single Core Ledger Phase 2.2 — Admin Compare Surfaces Report

**Status:** `PHASE 2.2 COMPLETE` — admin compare center shipped; engine still OFF  
**Branch:** `feature/single-core-ledger-phase-2-2-admin-compare`  
**Base:** `feature/single-core-ledger-phase-2-1-flags-banners` @ `c8fc1d3d`  
**Date:** 2026-06-14  

---

## Summary

Phase 2.2 extends `/admin/unified-ledger-tieout` into a **Unified Ledger Compare Center** with five admin-only tabs. All unified RPC calls use `shadowForce: true`. No production statement screen data sources were changed.

---

## Compare tabs

| Tab | Legacy source | Unified RPC |
|-----|---------------|-------------|
| Party | `loadLegacyPartyLedgerForTieOut` | `get_unified_party_ledger` |
| Pilot Batch | same (9/9 DIN CHINA matrix) | same |
| Account | `accountingService.getAccountLedger` | `get_unified_account_ledger` |
| Trial Balance | `accountingReportsService.getTrialBalance` | `get_unified_trial_balance` |
| Cash / Bank | `roznamchaService.getRoznamcha` | `get_unified_cash_bank_ledger` |

---

## Golden fixtures

| Fixture | Value |
|---------|-------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |
| MR JALIL | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` |
| Expected balance | PKR **216,300** (±0.01) |
| Pilot batch | 3 bases × 3 branch scopes = **9** comparisons |
| Clone reference | `ledger_stage_20260625_prodcheck` |

---

## Safety

- `unified_ledger_engine`: **OFF** — no flag writes
- No SQL migrations
- Phase 2.1 banners reused (`preview` / `killed` modes)
- Kill switch blocks normal RPC; shadow compare still allowed
- Client-side JSON export only (no server report writes)

---

## Files added

- `src/app/lib/unifiedLedgerCompareTypes.ts`
- `src/app/lib/unifiedLedgerCompareDiff.ts`
- `src/app/lib/unifiedLedgerGoldenFixtures.ts`
- `src/app/services/unifiedLedgerAccountCompareService.ts`
- `src/app/services/unifiedLedgerTrialBalanceCompareService.ts`
- `src/app/services/unifiedLedgerCashBankCompareService.ts`
- `src/app/services/unifiedLedgerPilotBatchCompareService.ts`
- `src/app/components/admin/unified-ledger-compare/*`

---

## Tests

`npm run test:unified-ledger` — **49/49 PASS**

---

## Rollback

Revert PR 2.2 — instant code revert, no DB restore.

---

## Next (PR 2.3+)

Ledger V2 preview toggle — still legacy default for end users.
