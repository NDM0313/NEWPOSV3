# Single Core Ledger Phase 2.3 — Ledger Statement V2 Preview Report

**Status:** `PHASE 2.3 COMPLETE` — Ledger V2 preview toggle shipped; legacy default preserved; engine still OFF  
**Branch:** `feature/single-core-ledger-phase-2-3-ledger-v2-preview`  
**Base:** `feature/single-core-ledger-phase-2-2-admin-compare` @ `bc3de799`  
**Date:** 2026-06-14  

---

## Summary

Phase 2.3 adds a **role-gated preview toggle** on Ledger Statement V2 only. When enabled, a parallel unified RPC fetch runs in shadow mode (`shadowForce: true`) alongside the existing legacy statement. The main table, export, print, and PDF paths remain **legacy-only**.

---

## Behavior

| State | Main `LedgerTable` | Unified RPC | Export / print |
|-------|-------------------|-------------|----------------|
| Toggle **OFF** (default) | Legacy `getLedgerStatementV2` | Not called | Legacy only |
| Toggle **ON** | Legacy unchanged | `shadowForce: true` | Legacy only |
| Kill switch **ON** | Legacy only | **Blocked on V2** | Legacy only |

**Critical:** `getLedgerStatementV2` and `loadStatement()` are unchanged — preview never replaces `setResult(data)`.

---

## Access gate

`canAccessLedgerV2UnifiedPreview(role)` — `canAccessAccountingDeveloperCenter` OR `canAccessDeveloperIntegrityLab`. Staff users do not see the toggle.

---

## Statement type → unified RPC (preview only)

| `LedgerStatementV2Type` | Legacy loader | Unified RPC | Default basis |
|-------------------------|---------------|-------------|---------------|
| `customer` | `getCustomerLedger` (hybrid) | `get_unified_party_ledger` | `effective_party` |
| `supplier` | `getSupplierApGlJournalLedger` | `get_unified_party_ledger` | `effective_party` |
| `worker` | `getWorkerPartyGlJournalLedger` | `get_unified_party_ledger` | `effective_party` |
| `account` | `getAccountLedger` | `get_unified_account_ledger` | `official_gl` |

---

## Golden fixtures

| Fixture | Value |
|---------|-------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |
| MR JALIL | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` |
| Expected balance | PKR **216,300** (±0.01) |
| Shortcut | **Load MR JALIL** button on V2 page |

---

## Kill switch (stricter than admin compare)

Admin tie-out (2.2) may still call unified RPC under kill via `shadowForce`. **Ledger V2 preview does not** — kill fully disables preview toggle and blocks the preview service.

---

## Safety

- `unified_ledger_engine`: **OFF** — no `feature_flags` writes
- No SQL migrations
- Export / print / CSV / Excel / WhatsApp: legacy rows only
- Preview JSON export: client-side, labeled non-official
- Account Statement, Trial Balance, Roznamcha: **unchanged**

---

## Files added

- `src/app/lib/ledgerV2UnifiedPreviewAccess.ts`
- `src/app/lib/ledgerStatementV2UnifiedMapper.ts`
- `src/app/lib/ledgerStatementV2UnifiedPreviewDiff.ts`
- `src/app/services/ledgerStatementCenterV2UnifiedPreviewService.ts`
- `src/app/features/ledger-statement-center-v2/LedgerV2UnifiedPreviewPanel.tsx`
- Tests: `ledgerV2UnifiedPreviewAccess.test.ts`, `ledgerStatementV2UnifiedMapper.test.ts`, `ledgerStatementV2UnifiedPreviewDiff.test.ts`

## Files extended

- `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` — toggle, panel wiring
- `src/app/lib/unifiedLedgerEngineState.ts` — `screenPreview` option
- `src/app/hooks/useUnifiedLedgerEngineState.ts` — pass through `screenPreview`
- `package.json` — `test:unified-ledger` includes new tests

---

## Manual QA checklist

1. Staff user opens Ledger V2 → no preview toggle
2. Admin/developer opens Ledger V2 → toggle visible, default OFF
3. Load MR JALIL customer, enable preview → legacy table unchanged; panel shows compare
4. Toggle OFF → unified RPC not called; panel hidden
5. Account statement + preview → `get_unified_account_ledger` shadow call
6. Kill switch env set → toggle disabled; killed banner
7. Print / PDF / CSV → legacy totals only
8. Account Statement / TB / Roznamcha → no preview UI

---

## Next

Phase 2.4 — Account Statement preview (not started).
