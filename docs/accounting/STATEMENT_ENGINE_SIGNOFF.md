# Statement engine — implementation signoff

**Date:** 2026-04-05  
**Scope:** Runtime accounting workbench correctness (no Figma; no Batch 5).  
**Canonical sources:** `journal_entries`, `journal_entry_lines`, `accounts`, `payments` (plus existing RPCs/services already in use).

---

## 1. Pattern (“single statement engine”)

There is **one primary statement workbench** in the ERP UI: **`AccountLedgerReportPage`** (Accounting → **Account Statements** tab). It is the shared place for:

| Mode (`AccountingStatementMode`) | Data path |
|----------------------------------|-----------|
| `gl` | `accountingService.getAccountLedger` |
| `cash_bank` | Same (account picker restricted to cash/bank category in UI) |
| `account_contact` | Same + contact filter on payment-linked rows |
| `customer` | `getCustomerLedger` |
| `supplier` | `getSupplierApGlJournalLedger` |
| `worker` | `getWorkerPartyGlJournalLedger` (WP 2010 / WA 1180 GL net) |

**Shared vocabulary** lives in:

- `src/app/lib/accounting/statementEngineTypes.ts` — mode union + human/export labels  
- `src/app/components/reports/StatementScopeBanner.tsx` — visible **period / branch scope / basis** strip  

**Other “statement-like” surfaces** (not merged into one route in this pass):

- **LedgerHub** (`LedgerHub` + `GenericLedgerView`) — party/worker operational ledgers (worker subledger still uses **`worker_ledger_entries`** where that path is intentional).  
- **Per-account** `AccountLedgerView` / `AccountLedgerPage` — same canonical journals, narrower scope.  
- **Reports dashboard** — Trial Balance, P&amp;L, Balance Sheet via `accountingReportsService` / related pages (branch passed where supported).

---

## 2. Required features (checklist)

| Feature | Account Statements (`AccountLedgerReportPage`) |
|---------|--------------------------------------------------|
| Account picker (where applicable) | Yes — grouped by category |
| Customer / supplier / worker picker | Yes — contacts + `studioService.getAllWorkers` for worker |
| Date / period | From parent `startDate` / `endDate` |
| Branch scope | Passed to services as `branchId`; banner + export metadata |
| Debit / credit / running balance | Yes |
| Reference / journal ref | Yes; reference is clickable → View |
| Description, branch column | Yes |
| Actions: View / Edit | Yes — `openTransactionDetail` (entry_no preferred for View; UUID for Edit+unified editor) |
| Print / export | PDF + Excel; title includes mode slug + period + branch line |
| Search / filters | Search, module, doc type, polarity, include toggles |
| Open source document | **Partial** — use Transaction Detail from View; dedicated “open sale/purchase” from each row not wired here (see click matrix) |

---

## 3. Accounting dashboard alignment

- **Account Statements** period now follows **global filter** dates when set (`useGlobalFilter`), consistent with Day Book / Roznamcha intent.  
- **Journal Entries** table: **Lines** (group size or `1` in audit) and **Status** (Posted / Reversal) columns; **View** vs **Edit** on actions.

---

## 4. Readiness

| Status | **PARTIALLY READY** |
|--------|---------------------|
| Rationale | Shared types + banner + worker statement + drill-down improvements are in place; full parity with every legacy screenshot and deep source-doc navigation is not claimed. |

**Batch 5:** NOT APPROVED.
