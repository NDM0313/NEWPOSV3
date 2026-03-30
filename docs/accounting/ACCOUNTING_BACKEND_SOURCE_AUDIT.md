# Accounting Backend Source Audit (Web vs Mobile)

Single matrix: **intended** source is the live accounting spine you named: **`accounts`**, **`journal_entries`**, **`journal_entry_lines`**, **`payments`**, **`payment_allocations`**, plus PostgreSQL functions that aggregate those (**`get_contact_balances_summary`**, **`get_contact_party_gl_balances`**, **`get_customer_ledger_*`**, **`record_payment_with_accounting`**, etc.).

Auxiliary: **`worker_ledger_entries`** (studio/worker UX; web posts via payments+JE+worker ledger).

| Feature / module | Web source (files) | Mobile source (files) | Intended source | Status | Notes |
|------------------|-------------------|----------------------|-----------------|--------|-------|
| Chart of accounts | `accountService.ts`, `chartAccountService.ts` → **`accounts`** | `api/accounts.ts` → **`accounts`** | **`accounts`** | **MATCH** | No `chart_accounts` in either TS app |
| Manual / general journal | `accountingService.ts`, `AccountingContext.tsx` | `accounts.ts` `createJournalEntry` | **`journal_*`** | **MATCH** | Parallel implementations |
| Day book | `DayBookReport` + services | `reports.ts` `getDayBookEntries` | **`journal_*`** | **MATCH** (scope) | Mobile comment: no branch filter for day book |
| Roznamcha / payment register | `roznamchaService.ts` | *(no dedicated module in grep)* | **`payments`** + **`journal_*`** | **UNKNOWN** (mobile) | Web has full path |
| Account ledger / GL statement | `accountingService.ts`, `AccountLedgerReportPage.tsx` | `accounts.ts` `getAccountLedger` | **`journal_entry_lines`** | **MATCH** | |
| Party — customer operational balance | `contactService.ts` RPC **`get_contact_balances_summary`** | `contactBalancesRpc.ts` same RPC | **RPC** | **MATCH** | Mobile customer ledger forces **`p_branch_id: null`** per `customerLedger.ts` — can **MISMATCH** web when web branch ≠ all |
| Party — customer GL comparison | `contactService.ts` RPC **`get_contact_party_gl_balances`** | *(not surfaced in mobile grep)* | **RPC** | **MISMATCH** | Web Contacts has explicit GL tab tooling |
| Customer ledger activity | `customerLedgerApi.ts` RPCs + `payments` | `customerLedger.ts` RPC + `payments` + **`sales`** fallback | **RPC + `payments`** | **MIXED** | Mobile fallback queries **`sales`** directly |
| Customer opening **display** | Web ledger / contacts | **`contacts.opening_balance`** in `customerLedger.ts` | **Opening balance JE + contact field** | **LEGACY / MISMATCH risk** | Not solely journal-derived |
| Receivables **total** (reports) | Multiple: journal summary cards vs invoice lists | `reports.ts` **`getReceivables`** → contact RPC | **RPC** | **MISMATCH** (web hub) | Web `AccountingDashboard` summary uses **journal name classification**; receivables tab uses **`sales.due`** |
| Payables **total / list** | `AccountingDashboard` summary journal-based; tab uses **`purchases.due`** | `getSuppliersWithPayable` **`purchases.due_amount`** | **RPC or AP GL** | **MISMATCH** | Document **`due`** vs GL can diverge |
| Supplier payment posting | `supplierPaymentService.ts`, `addEntryV2Service.ts` | `record_payment_with_accounting` RPC | **`payments` + `journal_*`** | **MATCH** | Same RPC on mobile |
| Worker outstanding list | `studioService.ts`, `controlAccountBreakdownService.ts`, GL lines | **`worker_ledger_entries`** unpaid sums `api/accounts.ts` | **GL 2010 + auxiliary worker ledger** | **MISMATCH risk** | Mobile totals from **worker_ledger**; web worker party statement emphasizes **2010/1180 journals** in `accountingService.ts` |
| Worker payment | `workerPaymentService.ts` — **`payments`**, **`journal_*`**, **`worker_ledger_entries`** | **`recordWorkerPayment`** inserts **`worker_ledger_entries` only** | **Full canonical trio** | **MISMATCH** | **High severity** for balance drift |
| Sale / receipt | `saleService.ts`, `paymentAllocationService.ts` | `sales.ts` `record_payment_with_accounting`, `record_customer_payment` | **`payments`**, **`payment_allocations`**, **`journal_*`** | **MATCH** (intent) | Verify RPC parity with DB |
| Purchase | `purchaseService.ts` | `purchases.ts` + RPC pay | **`purchases`**, **`payments`**, **`journal_*`** | **MATCH** (intent) | |
| Expense | `expenseService.ts` | `expenses.ts` | **`expenses`**, **`journal_*`** (web) | **UNKNOWN** | Mobile may not post same JE — verify expense posting path |
| Inventory | `inventoryService.ts` | `inventory.ts` stock only | **Stock tables** | **N/A** | |
| Opening balance GL | `openingBalanceJournalService.ts` | *(no dedicated file in mobile api list)* | **`journal_*`** | **UNKNOWN** | Web sync from contacts per `contactService.ts` |
| Financial dashboard | `financialDashboardService.ts` RPC **`get_financial_dashboard_metrics`** | `DashboardModule.tsx` **sales − purchases** | **RPC / GL** | **MISMATCH** | Mobile dashboard not using finance RPC |
| Integrity / audit | `accountingIntegrityLabService.ts`, `developerAccountingDiagnosticsService.ts` | *(no equivalent)* | **DB RPCs** | **MISMATCH** | Web-only tooling |
| Legacy `ledger_master` / `ledger_entries` | **`ledgerService.ts` stubs only** | none | **Unused in app** | **LEGACY (dead in TS)** | DB may still have tables from **`migrations/ledger_master_and_entries.sql`** |

---

## RPC quick reference (named in app code)

| RPC | Example web path | Example mobile path |
|-----|------------------|---------------------|
| `get_contact_balances_summary` | `contactService.ts` | `contactBalancesRpc.ts`, `contacts.ts`, `reports.ts` |
| `get_contact_party_gl_balances` | `contactService.ts`, `partyFormBalanceService.ts`, `controlAccountBreakdownService.ts` | *(not in mobile grep)* |
| `get_customer_ledger_sales` | `customerLedgerApi.ts` | `customerLedger.ts` |
| `get_customer_ledger_payments` | `customerLedgerApi.ts` | *(mobile uses direct `payments` in `customerLedger.ts`)* |
| `get_customer_ledger_rentals` | `customerLedgerApi.ts` | *(not in mobile customerLedger excerpt)* |
| `record_payment_with_accounting` | `addEntryV2Service.ts`, purchase/supplier flows | `accounts.ts`, `sales.ts` |
| `record_customer_payment` | *(web sale service may use delete/reverse RPCs)* | `sales.ts` |
| `get_financial_dashboard_metrics` | `financialDashboardService.ts` | — |
| `get_or_create_courier_payable_account` | `shipmentAccountingService.ts`, `courierService.ts`, `addEntryV2Service.ts` | — |
| `ensure_erp_accounts_for_current_company` | `StudioCostsTab.tsx` | — |

