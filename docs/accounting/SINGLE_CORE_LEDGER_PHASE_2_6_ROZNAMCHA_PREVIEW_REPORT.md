# Single Core Ledger Phase 2.6 — Roznamcha / Cash Book Preview Report

**Status:** `PHASE 2.6 COMPLETE` — Roznamcha preview toggle shipped; legacy default preserved; engine still OFF  
**Branch:** `feature/single-core-ledger-phase-2-6-roznamcha-preview`  
**Base:** `feature/single-core-ledger-phase-2-5-trial-balance-preview` @ `fa3bff70`  
**Date:** 2026-06-14  

---

## Summary

Phase 2.6 adds a **role-gated preview toggle** on Accounting → Roznamcha (`RoznamchaReport`) only. When enabled, a parallel unified RPC fetch runs in shadow mode (`shadowForce: true`) alongside the existing legacy `getRoznamcha` loader. The main table, PDF, Excel, and WhatsApp export paths remain **legacy-only**.

---

## Behavior

| State | Main Roznamcha table | Unified RPC | Export |
|-------|---------------------|-------------|--------|
| Toggle **OFF** (default) | Legacy `data` → display pipeline | Not called | Legacy only |
| Toggle **ON** | Legacy unchanged | `shadowForce: true` | Legacy only |
| Kill switch **ON** | Legacy only | **Blocked** | Legacy only |

**Critical:** The legacy `load` callback that calls `setData` from `getRoznamcha` is unchanged — preview never replaces main table data.

---

## Access gate

`canAccessRoznamchaUnifiedPreview(role)` — `canAccessAccountingDeveloperCenter` OR `canAccessDeveloperIntegrityLab`.

---

## Compare design

| Side | Source |
|------|--------|
| **Old** | On-screen `data` from legacy load (before search/sort/pagination) |
| **New** | `get_unified_cash_bank_ledger` with matching date range, branch, liquidity |

Diff helpers: [`roznamchaUnifiedPreviewDiff.ts`](src/app/lib/roznamchaUnifiedPreviewDiff.ts) reuses `diffLedgerRows` + shared mappers from [`roznamchaCashBankCompareMappers.ts`](src/app/lib/roznamchaCashBankCompareMappers.ts).

---

## Known deltas (documented in panel)

1. **Row identity:** Legacy rows keyed by economic entity id (`pay:uuid`); unified rows keyed by JE line id.
2. **Single payment account filter:** Legacy filters at query time; unified filtered client-side on preview rows when account selected.
3. **Stream semantics:** Legacy is payments/rental_payments/journal-liquidity composite; unified is GL liquidity legs.

---

## Golden fixtures

| Fixture | Value |
|---------|-------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |
| Clone reference | `ledger_stage_20260625_prodcheck` |
| Gate A | 3/3 |
| Tie-out | 9/9 |

Shortcut: **Load DIN CHINA period** — tenant hint when company matches.

---

## Kill switch (stricter than admin compare)

Admin tie-out may still call unified RPC under kill via `shadowForce`. **Roznamcha preview does not** — kill fully disables preview toggle and blocks the preview service.

---

## Safety

- `unified_ledger_engine`: **OFF** — no `feature_flags` writes
- No SQL migrations
- PDF / Excel / WhatsApp: legacy export only
- Preview JSON export: client-side, labeled non-official
- Cash Flow, Day Book, Balance Sheet, P&L, Trial Balance, Ledger V2, Account Statement: **unchanged**

---

## Files added

- `src/app/lib/roznamchaUnifiedPreviewAccess.ts`
- `src/app/lib/roznamchaCashBankCompareMappers.ts` (extracted from admin compare)
- `src/app/lib/roznamchaUnifiedMapper.ts`
- `src/app/lib/roznamchaUnifiedPreviewScope.ts`
- `src/app/lib/roznamchaUnifiedPreviewDiff.ts`
- `src/app/services/roznamchaUnifiedPreviewService.ts`
- `src/app/components/reports/RoznamchaUnifiedPreviewPanel.tsx`
- Tests: access, mappers, mapper, diff, scope

## Files extended

- `src/app/components/reports/RoznamchaReport.tsx` — toggle, panel wiring, `userRole` gate
- `src/app/services/unifiedLedgerCashBankCompareService.ts` — import shared mappers
- `package.json` — `test:unified-ledger` extended
- `docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md`

---

## Tests

```bash
npm run test:unified-ledger
```

Target: 95+ tests.

---

## Rollback

Revert PR 2.6 — no DB changes. Legacy `getRoznamcha` path untouched when toggle OFF.
