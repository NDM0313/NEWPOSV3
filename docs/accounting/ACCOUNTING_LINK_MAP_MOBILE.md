# Mobile ERP — Accounting Link Map

Audit date: 2026-03-30. Repo folder: `erp-mobile-app/`. Phase 1: documentation only.

---

## Important: two different “Accounting” UIs

| Path | Connected to Supabase? | Notes |
|------|------------------------|-------|
| `erp-mobile-app/src/components/accounts/AccountsModule.tsx` and children (`AccountsDashboard`, flows, reports shortcuts) | **Yes** | Real COA / journals / payments — primary mobile accounting surface |
| `erp-mobile-app/src/components/accounting/AccountingModule.tsx` | **No** | **Hardcoded mock** — **not imported** by `App.tsx` or any other file under `erp-mobile-app/src` (dead UI as of 2026-03-30 audit) |

---

## API layer (single-file map)

| File | Tables | RPCs | Role |
|------|--------|------|------|
| `erp-mobile-app/src/api/accounts.ts` | `accounts`, `journal_entries`, `journal_entry_lines`, `purchases`, `contacts`, `workers`, **`worker_ledger_entries`** | `record_payment_with_accounting`, `generate_document_number` (via `documentNumber.ts`) | COA, JE create, supplier pay (RPC), **worker list/pay uses `worker_ledger_entries`** |
| `erp-mobile-app/src/api/contactBalancesRpc.ts` | — | `get_contact_balances_summary` | Operational AR/AP map; branch rules mirrored to web |
| `erp-mobile-app/src/api/contacts.ts` | `contacts` | `get_contact_balances_summary` (via fetch helper) | Contact list balances |
| `erp-mobile-app/src/api/customerLedger.ts` | `sales`, `contacts`, `payments` | `get_customer_ledger_sales` | Customer ledger + **opening from `contacts.opening_balance`** |
| `erp-mobile-app/src/api/reports.ts` | `sales`, `purchases`, `journal_entries`, `journal_entry_lines`, `accounts` | — | Summaries, day book, receivables total |
| `erp-mobile-app/src/api/sales.ts` | `sales`, `sales_items` / `sale_items`, `payments`, `payment_allocations`, `stock_movements`, `studio_productions` | `get_sale_studio_charges_batch`, `get_sale_studio_summary`, **`record_payment_with_accounting`**, **`record_customer_payment`**, `log_share`, `log_print` | Sale lifecycle and payments |
| `erp-mobile-app/src/api/purchases.ts` | `purchases`, `purchase_items`, `payments` | — | Purchase + payment reads |
| `erp-mobile-app/src/api/rentals.ts` | `rentals`, `rental_items`, `rental_payments`, `accounts`, `stock_movements` | — | Rental flows; touches `accounts` for payment account resolution |
| `erp-mobile-app/src/api/expenses.ts` | `expenses`, `expense_categories` | — | Expense list/create |
| `erp-mobile-app/src/api/inventory.ts` | `products`, `stock_movements` | — | Stock; not GL |
| `erp-mobile-app/src/api/studio.ts` | Studio/sales tables | Multiple `rpc_*` studio workflow | Studio production (sideband to sales accounting) |
| `erp-mobile-app/src/api/documentNumber.ts` | `branches` | `generate_document_number` | JE/PAY refs |
| `erp-mobile-app/src/api/employees.ts` | `employees`, `employee_ledger`, `users`, `user_branches` | — | **Separate** `employee_ledger` (not `ledger_entries`) |

---

## Screens ↔ services (live paths only)

### Accounts module (real)

| Screen | Path | Calls | Backend |
|--------|------|-------|---------|
| Accounts dashboard | `components/accounts/AccountsDashboard.tsx` | `getJournalEntries`, `getAccounts` from `api/accounts.ts` | `journal_entries`, `journal_entry_lines`, `accounts` |
| General journal | `components/accounts/GeneralEntryFlow.tsx` | `getAccounts`, `createJournalEntry` | `accounts`, `journal_entries`, `journal_entry_lines` |
| Account transfer / supplier / expense flows | `AccountTransferFlow.tsx`, `SupplierPaymentFlow.tsx`, `ExpenseEntryFlow.tsx` | Same API file patterns | Mix of **direct JE** and **RPC** where used |
| Chart of accounts | `ChartOfAccountsView.tsx`, `AddAccountForm.tsx` | `getAccounts`, `createAccount` | `accounts` |
| Account ledger report | `components/accounts/AccountLedgerReport.tsx` | `getAccountLedger` | `journal_entry_lines`, `journal_entries` |
| Day book (from accounts) | `components/reports/DayBookReport.tsx` | `getDayBookEntries` in `api/reports.ts` | `journal_entries`, `journal_entry_lines` |
| Cash / bank summaries | `CashSummaryReport.tsx`, `BankSummaryReport.tsx` | Account-type filtered reads via API | `accounts` (+ journals where implemented in file) |
| Payables report | `PayablesReport.tsx` | `getSuppliersWithPayable`, `getPurchasesBySupplier`, `recordSupplierPayment` | **`purchases.due_amount`** aggregation + RPC pay | **Document-based payable** |
| Receivables report | `ReceivablesReport.tsx` | Customer balance helpers | RPC / sales-based per file |
| Worker payment | `components/accounts/WorkerPaymentFlow.tsx` | **`recordWorkerPayment`** | **`worker_ledger_entries` INSERT only** | **Canonical web path is `payments` + `journal_entries` + `worker_ledger_entries` per web `workerPaymentService.ts`** |

### Customer ledger (bottom nav / ledger screen)

| Screen | Path | Calls | Backend |
|--------|------|-------|---------|
| Customer list with due | `components/ledger/LedgerModule.tsx` | `customerLedger.ts` | `get_contact_balances_summary` with **`p_branch_id: null`** (company-wide) per `customerLedger.ts` header comment |
| Detail / lines | same | `getCustomerReceivableBalance`, `getCustomerLastTransactions` | RPC `get_customer_ledger_sales` or fallback **`sales`**; **`payments`** (`sale`, `on_account`, `manual_receipt`); **`contacts.opening_balance`** |

### Reports hub

| Screen | Path | Calls | Backend |
|--------|------|-------|---------|
| Reports home stats | `components/reports/ReportsModule.tsx` | `getSalesSummary`, `getReceivables` | `sales`; **`get_contact_balances_summary`** via `reportsApi.getReceivables` |
| Day book | `DayBookReport.tsx` | `getDayBookEntries` | `journal_entries` (comment: **all company, no branch filter**) |

### Dashboard

| Screen | Path | Calls | Backend |
|--------|------|-------|---------|
| Home dashboard | `components/dashboard/DashboardModule.tsx` | `getSalesSummary`, `getPurchasesSummary`, `inventory` | **`sales`**, **`purchases`**, stock | **“Profit” = sales − purchases (not P&L from GL)** |

### Contacts, sales, purchase, rental (touch accounting)

| Screen | Path | Accounting-related backend |
|--------|------|----------------------------|
| Contacts | `components/contacts/ContactsModule.tsx` | `contacts.ts` → **`get_contact_balances_summary`** (+ branch param from screen) |
| Sales / POS | `sales/*`, `pos/POSModule.tsx` | `sales.ts` — `payments`, `payment_allocations`, posting RPCs |
| Purchase | `purchase/*` | `purchases.ts`, `record_payment_with_accounting` for pay |
| Rental | `rental/*` | `rentals.ts` — `accounts`, `rental_payments` |
| Studio | `studio/*` | `studio.ts` RPCs |

---

## Legacy / non-spine mobile usage

| Item | Path | Notes |
|------|------|-------|
| **`chart_accounts` / `ledger_master` / `account_transactions`** | **No matches** in `erp-mobile-app/src/**/*.ts(x)` | |
| **`worker_ledger_entries`** | `api/accounts.ts` | **Reads and writes** — outstanding workers and **recordWorkerPayment** |
| **`employee_ledger`** | `api/employees.ts` | Separate subsystem |

---

## Cached / computed vs journal truth (mobile)

1. **Dashboard profit** — `sales − purchases`, not income statement from journals (`DashboardModule.tsx`).
2. **Customer ledger header balance** — RPC `get_contact_balances_summary` with **null branch** (see `customerLedger.ts` lines 4–8); activity lines from sales/payments RPC/fallback — can diverge from branch-scoped web Contacts.
3. **Contacts list** — RPC when available; **`opening_balance` only if RPC fails** (`contacts.ts` lines 96–100).
4. **Opening row in customer ledger** — synthesized from **`contacts.opening_balance`**, not from opening balance journal alone (`customerLedger.ts` ~197–218).
5. **Supplier payables (mobile)** — **`purchases.due_amount`**, not `get_contact_balances_summary` payables (`getSuppliersWithPayable` in `api/accounts.ts`).

---

## Duplicated logic vs web

| Concern | Web | Mobile |
|---------|-----|--------|
| Contact balance RPC branch rules | `contactService.ts` | `contactBalancesRpc.ts` (explicit mirror comment) |
| Day book | `DayBookReport` (web) | `reports.ts` `getDayBookEntries` — same tables, mobile explicitly **no branch filter** (comment in `reports.ts` line 124) |
| Journal create | `accountingService` | `accounts.ts` `createJournalEntry` — parallel insert pattern |
| Worker payment | `workerPaymentService.ts` — payments + JE + worker ledger | **`recordWorkerPayment`** — **worker_ledger only** |

---

## Account code hardcoding (mobile)

| Location | Content |
|----------|---------|
| `api/accounts.ts` | `RESERVED_CODES`: `cash: '1000'`, `bank: '1010'`, `mobile_wallet: '1020'`; generic other series `'200'…` |
| Comments in `api/studio.ts` | References **5000**, **2010** in narrative |

