# Single Core Ledger Phase 2.5 — Trial Balance Preview Report

**Status:** `PHASE 2.5 COMPLETE` — Trial Balance preview toggle shipped; legacy default preserved; engine still OFF  
**Branch:** `feature/single-core-ledger-phase-2-5-trial-balance-preview`  
**Base:** `feature/single-core-ledger-phase-2-4-account-statement-preview` @ `c75794bb`  
**Date:** 2026-06-14  

---

## Summary

Phase 2.5 adds a **role-gated preview toggle** on Reports → Financial Reports → Trial Balance (`TrialBalancePage`) only. When enabled, a parallel unified RPC fetch runs in shadow mode (`shadowForce: true`) alongside the existing legacy `getTrialBalance` loader. The main table, PDF, Excel, and WhatsApp export paths remain **legacy-only**.

---

## Behavior

| State | Main TB table | Unified RPC | Export |
|-------|--------------|-------------|--------|
| Toggle **OFF** (default) | Legacy `data` → `filteredRows` | Not called | Legacy only |
| Toggle **ON** | Legacy unchanged | `shadowForce: true` | Legacy only |
| Kill switch **ON** | Legacy only | **Blocked** | Legacy only |

**Critical:** The legacy `useEffect` that calls `setData` from `getTrialBalance` is unchanged — preview never replaces main table data.

---

## Access gate

`canAccessTrialBalanceUnifiedPreview(role)` — `canAccessAccountingDeveloperCenter` OR `canAccessDeveloperIntegrityLab`.

---

## Compare design

| Side | Source |
|------|--------|
| **Old** | On-screen `data` from legacy load (before search / `filteredRows`) |
| **New** | `get_unified_trial_balance` with `asOfDate = endDate`, `shadowForce: true` |

Diff helpers: [`trialBalanceUnifiedPreviewDiff.ts`](src/app/lib/trialBalanceUnifiedPreviewDiff.ts) reuses `diffTrialBalanceAccounts` from Phase 2.2.

---

## Known deltas (documented in panel)

1. **Period vs as-of:** Legacy sums activity in `startDate…endDate`; unified RPC uses `asOfDate = endDate` (admin compare parity).
2. **`arApMode`:** Legacy `summary` / `expanded` reshapes AR/AP presentation rows; unified RPC has no `arApMode`.

---

## Golden fixtures

| Fixture | Value |
|---------|-------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |
| Clone reference | `ledger_stage_20260625_prodcheck` |
| Gate A | 3/3 |
| Tie-out | 9/9 |

Shortcut: **Load DIN CHINA period** — hints when tenant matches; dates remain dashboard-controlled.

---

## Kill switch (stricter than admin compare)

Admin tie-out may still call unified RPC under kill via `shadowForce`. **Trial Balance preview does not** — kill fully disables preview toggle and blocks the preview service.

---

## Safety

- `unified_ledger_engine`: **OFF** — no `feature_flags` writes
- No SQL migrations
- PDF / Excel / WhatsApp: legacy `exportResult` only
- Preview JSON export: client-side, labeled non-official
- Balance Sheet, P&L, Roznamcha, Ledger V2, Account Statement: **unchanged**

---

## Files added

- `src/app/lib/trialBalanceUnifiedPreviewAccess.ts`
- `src/app/lib/trialBalanceUnifiedMapper.ts`
- `src/app/lib/trialBalanceUnifiedPreviewScope.ts`
- `src/app/lib/trialBalanceUnifiedPreviewDiff.ts`
- `src/app/services/trialBalanceUnifiedPreviewService.ts`
- `src/app/components/reports/TrialBalanceUnifiedPreviewPanel.tsx`
- Tests: access, mapper, diff, scope

## Files extended

- `src/app/components/reports/TrialBalancePage.tsx` — toggle, panel wiring, `userRole` gate
- `package.json` — `test:unified-ledger` extended
- `docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md`

---

## Tests

```bash
npm run test:unified-ledger
```

Target: 84+ tests (72 from Phase 2.4 + 12 new TB preview tests).

---

## Rollback

Revert PR 2.5 — no DB changes. Legacy `getTrialBalance` path untouched when toggle OFF.
