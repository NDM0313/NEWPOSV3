# Ledger Center V2 — GL Alignment Report

**Date:** 2026-06-09  
**Change:** V2 official statement now uses the same posted-GL services as Accounting → Account Statements.

---

## Routing summary

### Before (operational)

```
customer → customerLedgerAPI (operational)
supplier → ledgerDataAdapters (operational)
worker   → worker_ledger_entries (operational)
account  → getAccountLedger (GL)
```

### After (official GL)

```
customer → accountingService.getCustomerLedger (GL)
supplier → accountingService.getSupplierApGlJournalLedger (GL)
worker   → accountingService.getWorkerPartyGlJournalLedger (GL)
account  → accountingService.getAccountLedger (GL)
documents → diagnostic toggle only (ledgerStatementCenterV2Diagnostic.ts)
```

**Scope:** All party/account statements pass `STATEMENT_ALL_BRANCHES_SCOPE` (`undefined` branchId) — matches `AccountLedgerReportPage`.

---

## Files changed (V2 scope only)

| File | Change |
|------|--------|
| `src/app/services/ledgerStatementCenterV2Service.ts` | GL routing, attachment enrichment (JE, payment, sale, rental, purchase) |
| `src/app/services/ledgerStatementCenterV2Diagnostic.ts` | **New** — operational compare (developer-only) |
| `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` | Basis banner, diagnostic toggle |
| `src/app/features/ledger-statement-center-v2/LedgerFilterBar.tsx` | Branch disabled — all branches (GL scope) |
| `src/app/features/ledger-statement-center-v2/LedgerDocumentComparisonPanel.tsx` | **New** |
| `src/app/features/ledger-statement-center-v2/types.ts` | `basis: 'gl'`, comparison types |

### NOT touched

- `AccountLedgerReportPage.tsx`
- `accountingService.ts` (contracts)
- `customerLedgerApi.ts`, `ledgerDataAdapters.ts` (used by diagnostic only)
- Migrations, triggers, RLS, posting logic

---

## Saqib test checklist (manual QA)

Run both screens with **identical date range** and **all branches**.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Accounting → Account Statements → Customer → **Saqib** | Note opening, closing, total debit/credit, row count, date range |
| 2 | Reports → Ledger Center V2 → Customer → **Saqib** | Same dates; branch shows "All branches (GL scope)" |
| 3 | Compare opening balance | Should match |
| 4 | Compare closing balance | Should match |
| 5 | Compare total debit / credit | Should match |
| 6 | Spot-check reference numbers | Same refs in same order (minor filter/search differences OK) |
| 7 | Click a reference row in V2 | Opens `TransactionDetailModal` (read-only) |
| 8 | Attachment icon on JE/payment/sale rows | Preview loads when attachments exist |

### Test results (fill after manual run)

| Field | Account Statements | Ledger V2 | Match? |
|-------|-------------------|-----------|--------|
| Date range | _pending_ | _pending_ | |
| Opening balance | _pending_ | _pending_ | |
| Closing balance | _pending_ | _pending_ | |
| Total debit | _pending_ | _pending_ | |
| Total credit | _pending_ | _pending_ | |
| Row count | _pending_ | _pending_ | |

---

## If mismatch — investigation (do NOT auto-repair)

1. Enable **Show document comparison (diagnostic)** (developer role / Integrity Lab access).
2. Record rows **only in GL** vs **only in documents**.
3. Check common causes:
   - Walk-in Customer payment posted to wrong contact
   - Payment/JE notes reference wrong party account
   - Manual journal not reflected in operational adapters
   - Opening balance JE vs operational opening
   - Reversal/void timing difference

Document findings below:

### Rows only in Account Statements

_Pending manual test_

### Rows only in Ledger V2

_Pending manual test_

### Suspected data issues

_Pending manual test_

---

## Developer diagnostic

- Toggle: Reports → Ledger Center V2 → **Show document comparison (diagnostic)**
- Gate: `canAccessDeveloperIntegrityLab(userRole)` — same as Integrity Lab
- Module: `compareGlWithDocumentsV2()` — loads operational adapters in parallel; **never** mutates official V2 balance

---

## Verification (automated)

- [x] V2 service routes all statement types through `accountingService` GL methods
- [x] `basis: 'gl'` on result type
- [x] Branch filter disabled with GL scope note
- [x] Attachment flags extended for sale/rental/purchase via GL links
- [ ] Manual Saqib parity test (requires live DB session)
- [ ] `graphify update .` after merge
