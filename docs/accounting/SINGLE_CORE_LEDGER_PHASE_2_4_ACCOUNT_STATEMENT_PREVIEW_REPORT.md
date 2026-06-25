# Single Core Ledger Phase 2.4 — Account Statement Preview Report

**Status:** `PHASE 2.4 COMPLETE` — Account Statement preview toggle shipped; legacy default preserved; engine still OFF  
**Branch:** `feature/single-core-ledger-phase-2-4-account-statement-preview`  
**Base:** `feature/single-core-ledger-phase-2-3-ledger-v2-preview` @ `b4cf5b62`  
**Date:** 2026-06-14  

---

## Summary

Phase 2.4 adds a **role-gated preview toggle** on Accounting → Account Statements (`AccountLedgerReportPage`) only. When enabled, a parallel unified RPC fetch runs in shadow mode (`shadowForce: true`) alongside the existing legacy loaders. The main table, PDF, and Excel export paths remain **legacy-only**.

---

## Behavior

| State | Main statement table | Unified RPC | Export |
|-------|---------------------|-------------|--------|
| Toggle **OFF** (default) | Legacy `entries` → `presentedEntries` | Not called | Legacy only |
| Toggle **ON** | Legacy unchanged | `shadowForce: true` | Legacy only |
| Kill switch **ON** | Legacy only | **Blocked** | Legacy only |

**Critical:** The legacy load `useEffect` that calls `setEntries(loaded)` is unchanged — preview never replaces main table data.

---

## Access gate

`canAccessAccountStatementUnifiedPreview(role)` — `canAccessAccountingDeveloperCenter` OR `canAccessDeveloperIntegrityLab`.

---

## Statement mode → unified RPC (preview only)

| Mode | Legacy loader | Unified RPC | Default basis |
|------|---------------|-------------|---------------|
| `customer` | `getCustomerLedger` (hybrid) | `get_unified_party_ledger` | `effective_party` |
| `supplier` | `getSupplierApGlJournalLedger` | `get_unified_party_ledger` | `effective_party` |
| `worker` | `getWorkerPartyGlJournalLedger` | `get_unified_party_ledger` | `effective_party` |
| `gl` / `cash_bank` / `account_contact` (pure GL) | `getAccountLedger` | `get_unified_account_ledger` | `official_gl` |
| `gl` with party-routed subledger | Party loaders above | `get_unified_party_ledger` | `effective_party` |

Preview target resolution: [`accountStatementUnifiedPreviewTarget.ts`](src/app/lib/accountStatementUnifiedPreviewTarget.ts).

---

## Golden fixtures

| Fixture | Value |
|---------|-------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |
| MR JALIL | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` |
| Expected balance | PKR **216,300** (±0.01) |
| Shortcut | **Load MR JALIL** button |

---

## Kill switch (stricter than admin compare)

Admin tie-out may still call unified RPC under kill via `shadowForce`. **Account Statement preview does not** — kill fully disables preview toggle and blocks the preview service.

---

## Safety

- `unified_ledger_engine`: **OFF** — no `feature_flags` writes
- No SQL migrations
- PDF / Excel export: legacy `presentedEntries` only
- Preview JSON export: client-side, labeled non-official
- Ledger V2, Trial Balance, Roznamcha, Party Ledger: **unchanged**

---

## Files added

- `src/app/lib/accountStatementUnifiedPreviewAccess.ts`
- `src/app/lib/accountStatementUnifiedPreviewTarget.ts`
- `src/app/lib/accountStatementUnifiedMapper.ts`
- `src/app/lib/accountStatementUnifiedPreviewDiff.ts`
- `src/app/services/accountStatementUnifiedPreviewService.ts`
- `src/app/components/reports/AccountStatementUnifiedPreviewPanel.tsx`
- Tests: `accountStatementUnifiedPreviewAccess.test.ts`, `accountStatementUnifiedMapper.test.ts`, `accountStatementUnifiedPreviewTarget.test.ts`, `accountStatementUnifiedPreviewDiff.test.ts`

## Files extended

- [`AccountLedgerReportPage.tsx`](src/app/components/reports/AccountLedgerReportPage.tsx) — toggle, panel wiring
- [`package.json`](package.json) — `test:unified-ledger` includes new tests

---

## Manual QA checklist

1. Staff user opens Account Statements → no preview toggle
2. Admin/developer opens Account Statements → toggle visible, default OFF
3. Customer Statement → MR JALIL, enable preview → legacy table unchanged; compare panel visible
4. Toggle OFF → unified RPC not called; panel hidden
5. GL / cash_bank account + preview → account unified RPC shadow call
6. Kill switch env set → toggle disabled
7. PDF / Excel → legacy totals only
8. Ledger V2 preview still works independently
9. Compare Center still works independently

---

## Next

Phase 2.5 — Trial Balance preview (not started).
