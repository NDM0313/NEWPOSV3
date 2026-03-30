# Web ERP — Accounting Link Map

Audit date: 2026-03-30. Phase 1: documentation only (no code/DB changes).

Legend: **Live** = `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations` (and related RPCs). **Auxiliary** = `worker_ledger_entries`, `contacts`, document tables (`sales`, `purchases`, etc.). **Computed** = derived in browser from loaded journals/context without a dedicated balance RPC.

---

## Core context and data loading

| Area | Path | Purpose | Backend |
|------|------|---------|---------|
| Journal list, accounts list, add-entry flows | `src/app/context/AccountingContext.tsx` | Loads entries and accounts; persists manual/payment-linked journals | `accountingService` → `journal_entries`, `journal_entry_lines`, `accounts`; inserts to `payments` in some flows |
| GL / party queries | `src/app/services/accountingService.ts` | Journal CRUD, customer/supplier/worker party views from GL lines | `journal_entries`, `journal_entry_lines`, `accounts`, `payments`, RPCs `get_customer_ledger_payments`, `get_customer_ledger_sales`, `get_customer_ledger_rentals` |
| COA CRUD / payment account pickers | `src/app/services/accountService.ts` | Account list and filters | `accounts` |
| “Chart” UI model (maps to same table) | `src/app/services/chartAccountService.ts` | Create/update mapped to `accounts` row shape | `accounts` (not `chart_accounts`) |
| Hierarchy / control codes | `src/app/components/accounting/useAccountsHierarchyModel.ts`, `AccountsHierarchyList.tsx`, `ChartOfAccountsPartyDropdown.tsx` | Operational vs professional COA display | In-memory over `accounts` + journal-derived activity; party breakdown via `controlAccountBreakdownService` |
| Posting guard strings | `src/app/services/accountingCanonicalGuard.ts` | Warns on disallowed table names in queries | References `chart_accounts`, `account_transactions` as **disallowed** (not queried) |

---

## Accounting hub: `AccountingDashboard.tsx`

**Path:** `src/app/components/accounting/AccountingDashboard.tsx`

| Tab / feature | UI / child | Service / hook | Tables / RPC | Live vs legacy | Notes |
|---------------|------------|----------------|--------------|----------------|-------|
| Summary cards (income, expense, net profit, receivables, payables) | Inline `useMemo` on `accounting.entries` | `useAccounting()` | **Computed** from journal lines classified by **account name** sets (`INCOME_ACCOUNTS`, `EXPENSE_ACCOUNTS`, `AR_ACCOUNTS`, `AP_ACCOUNTS`) | **MISMATCH risk** vs operational AR/AP RPC | Receivable = AR debit − AR credit on **names** “Accounts Receivable”; payable uses “Accounts Payable” **and** “Worker Payable” together (`AP_ACCOUNTS` set) |
| Journal entries | Table + `TransactionDetailModal` | `AccountingContext` / `accountingService.getAllEntries` | `journal_entries`, `journal_entry_lines`, joins to `accounts`, `payments` where implemented | **Live** | Grouped vs audit modes |
| Day Book | Lazy `DayBookReport` | Report component (see reports) | Typically `journal_entries` / lines | **Live** | |
| Roznamcha | Lazy `RoznamchaReport` | `roznamchaService` | `payments`, `accounts`, `journal_entries` | **Live** | |
| Accounts (COA) | `AccountsHierarchyList`, drawers | `accountService`, `chartAccountService`, `fetchControlAccountBreakdown` | `accounts`; RPC `get_contact_party_gl_balances` in breakdown path | **Live** | |
| Party statements (ledger) | Full-screen `LedgerHub` | See below | Mixed | **Live + auxiliary** | |
| Receivables list | Filter `sales.sales` | `useSales()` | **Document state** on sales loaded in `SalesContext` / `saleService` — not `get_contact_balances_summary` here | **MISMATCH risk** vs Contacts RPC / customer ledger | Invoice-level `due > 0` |
| Payables list | Filter `purchases.purchases` | `usePurchases()` | **Document state** on purchases | **MISMATCH risk** vs supplier GL | Caption mentions courier; list is purchase rows |
| Courier | `CourierReportsTab`, `PayCourierModal` | `shipmentAccountingService`, `courierService` | RPC `get_or_create_courier_payable_account`; journals/payments per service | **Live** | |
| Deposits (rental) | `DepositsTab` | `rentalService` | `journal_entries`, `journal_entry_lines`, `rental_payments` / rental tables per `rentalService.ts` | **Live** (journal path) | |
| Studio costs | `StudioCostsTab` | Studio services; RPC `ensure_erp_accounts_for_current_company` | `journal_entry_lines` primary; **fallback** `worker_ledger_entries` in `studioCostsService.ts` | **Mixed** | Explicit legacy fallback in service comments |
| Account statements | `AccountLedgerReportPage` | `accountingService`, `accountService`, `contactService` | `journal_entry_lines`, `journal_entries`, `accounts`, `payments` | **Live** | Filters include adjustments |
| Integrity lab | `AccountingIntegrityTestLab` | `accountingIntegrityLabService`, related | `payments`, `journal_entries`, many RPCs | **Live** | |

---

## Party statements: `LedgerCustomer/Supplier/User/Worker`

| Path | Purpose | Backend |
|------|---------|---------|
| `src/app/components/accounting/LedgerHub.tsx` | Routes entity picker | `customerLedgerAPI`, `contactService`, `userService`, `studioService` |
| `src/app/components/customer-ledger-test/CustomerLedgerPageOriginal.tsx` (via hub) | Customer operational ledger UI | `customerLedgerApi.ts` → RPCs + `payments` |
| `src/app/components/accounting/GenericLedgerView.tsx` | Supplier / user / worker views | `accountingService` party methods; worker narrative references `worker_ledger_entries` |
| `src/app/services/customerLedgerApi.ts` | Customer ledger assembly | `get_customer_ledger_*` RPCs, `payments` |
| `src/app/services/ledgerDataAdapters.ts` | Adapters | `payments`, `worker_ledger_entries` for worker path |

---

## Other web screens (accounting-related)

| Screen | Path | Backend |
|--------|------|---------|
| Contacts | `src/app/components/contacts/ContactsPage.tsx` | `contactService.getContactBalancesSummary` → RPC `get_contact_balances_summary`; optional `get_contact_party_gl_balances` for GL comparison |
| Add Entry V2 | `src/app/components/accounting/AddEntryV2.tsx` | `addEntryV2Service.ts` → `payments` insert + posting helpers |
| Reports (global) | `src/app/components/reports/DayBookReport.tsx`, `RoznamchaReport.tsx`, `AccountLedgerReportPage.tsx` | Journals / payments per service |
| Admin integrity | `src/app/components/admin/AccountingIntegrityLabPage.tsx` | `payments`, integrity RPCs |
| Customer ledger test | `src/app/components/accounting/CustomerLedgerTestPage.tsx` | `customerLedgerApi` |
| AR/AP center | `src/app/components/accounting/ArApReconciliationCenterPage.tsx` | `arApReconciliationCenterService` → RPCs e.g. `ar_ap_integrity_lab_snapshot`, `upsert_ar_ap_reconciliation_item` |

---

## Services writing / reading live spine (non-exhaustive, high traffic)

| Service | Path | Tables / RPC |
|---------|------|----------------|
| `paymentAllocationService.ts` | `src/app/services/` | `payment_allocations`, `payments` |
| `paymentAdjustmentService.ts` | same | `journal_entries`, `journal_entry_lines`, `payments` |
| `paymentLifecycleService.ts` | same | `payment_allocations`, `payments` |
| `saleService.ts`, `saleAccountingService.ts` | same | `sales`, `payments`, `payment_allocations`, `journal_*` |
| `purchaseService.ts`, `purchaseAccountingService.ts` | same | `purchases`, `payments`, `payment_allocations`, `journal_*`, `accounts` |
| `expenseService.ts` | same | `expenses`, `journal_entries` |
| `openingBalanceJournalService.ts` | same | `journal_entries`, `journal_entry_lines` |
| `workerPaymentService.ts` | same | `payments`, `accounts`, `journal_*`, `worker_ledger_entries` |
| `financialDashboardService.ts` | same | RPC `get_financial_dashboard_metrics`, `get_dashboard_metrics`; `accounts` |

---

## Legacy cluster in web TypeScript

| Item | Path | Status |
|------|------|--------|
| `ledger_master` / `ledger_entries` runtime use | **`src/app/services/ledgerService.ts`** | **Stub only** — functions return `null` / `[]`; comment states duplicate ledger removed from app |
| `chart_accounts`, `account_transactions` | **`src/app/services/accountingCanonicalGuard.ts`** | **String deny-list** only — no queries |

**No remaining `.from('chart_accounts')` or `.from('ledger_master')` in `src/**/*.ts(x)`** (verified by repo search, 2026-03-30).

---

## Cached / computed vs journal truth (web)

1. **Accounting dashboard summary cards** — computed from in-memory journal rows and **fixed account name sets**, not from `get_contact_balances_summary`.
2. **Receivables / Payables tabs** — **document balances** from Sales/Purchase contexts (`due`, `paid`), not party GL or RPC totals.
3. **Studio costs** — primary journal lines; **fallback** to `worker_ledger_entries` in `studioCostsService.ts`.

---

## Parent / child / party drift (web)

- **Contacts page** can show operational balance (RPC) **and** party GL (`get_contact_party_gl_balances`) — UI copy references divergence (`ContactsPage.tsx` ~1599).
- **Worker** party view in `accountingService.ts` uses GL lines on **2010 / 1180** only; separate **worker_ledger_entries** path exists for studio/operational lists (`ledgerDataAdapters`, `GenericLedgerView`).

---

## Account code hardcoding (web, representative)

| Codes / pattern | Example path |
|-----------------|--------------|
| `1000`, `1010`, `1020`, `1100`, `2000`, `2010`, `1180` | `AccountingContext.tsx`, `useAccountsHierarchyModel.ts`, `accountingService.ts`, `workerPaymentService.ts`, `workerAdvanceService.ts`, `supplierPaymentService.ts`, `AccountsHierarchyList.tsx` |
| `1200`, `1500`, `5210` purchase posting | `purchaseAccountingService.ts` |
| `COA_HEADER_CODES` | `accountService.ts` (import from `src/app/data/defaultCoASeed`) |

