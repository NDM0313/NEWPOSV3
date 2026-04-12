# 11 — Accounting, Journal, Ledger, and Reporting Engine

## Business Purpose

Provides the entire double-entry GL layer for the ERP: Chart of Accounts (COA), journal entry creation and reversal, account and party ledgers, and financial reports (Trial Balance, Balance Sheet, P&L, Day Book/Roznamcha). Every monetary event in the system — sale, purchase, payment, expense, return, opening balance — ultimately produces a `journal_entries` header plus balanced `journal_entry_lines`. All financial reports read exclusively from these two tables joined to `accounts`; no legacy subledger or stored balance column is used as GL truth.

---

## UI Entry Points

| View / Route | Description |
|---|---|
| `/accounting` | Accounting Workbench — journal list, AddEntryV2 form, account statements |
| `/reports` | Reports Dashboard with Trial Balance, Balance Sheet, P&L |
| `/party-ledger` | Effective Party Ledger for a customer or supplier (collapses PF-14 chains) |
| `/ar-ap-reconciliation-center` | AR/AP Integrity Lab — GL vs operational variance dashboard |
| `/reports/trial-balance` | `TrialBalancePage` |
| `/reports/balance-sheet` | `BalanceSheetPage` |
| `/reports/profit-loss` | `ProfitLossPage` |
| `/reports/day-book` | `DayBookReport` |
| `/reports/roznamcha` | `RoznamchaReport` (Daily Cash Book) |

---

## Frontend Files

| File | Role |
|---|---|
| `src/app/components/accounting/AccountingDashboard.tsx` | Master journal workbench; renders `AccountingEntry[]` from `AccountingContext`, shows PF-14 chain flags (`paymentChainIsHistorical`, `paymentChainIsTail`) per row |
| `src/app/components/accounting/AddEntryV2.tsx` | Manual journal entry form; routes cash-touching entries through the payments-row-first path; enforces Roznamcha rule (Cash/Bank/Wallet entries create `payments` row) |
| `src/app/components/accounting/TransactionDetailModal.tsx` | Drilldown into a single JE; displays lines, allows reversal or undo, shows chain history |
| `src/app/components/accounting/EffectivePartyLedgerPage.tsx` | Party ledger page backed by `loadEffectivePartyLedger`; shows collapsed PF-14 chains |
| `src/app/components/reports/ReportsDashboard.tsx` | Navigation hub for all financial reports |
| `src/app/components/reports/TrialBalancePage.tsx` | Renders `TrialBalanceResult`; supports `flat`, `summary`, `expanded` AR/AP modes |
| `src/app/components/reports/BalanceSheetPage.tsx` | Renders `BalanceSheetResult`; AR and AP show as rolled-up control totals with party drilldown |
| `src/app/components/reports/ProfitLossPage.tsx` | Renders `ProfitLossResult` with optional comparison period |
| `src/app/components/reports/DayBookReport.tsx` | Per-account or all-accounts journal view; source: `journal_entry_lines` |
| `src/app/components/reports/RoznamchaReport.tsx` | Daily Cash Book; source: `payments` table (NOT journal lines) |
| `src/app/context/AccountingContext.tsx` | React context; exposes `createEntry`, `createReversalEntry`, `undoLastPaymentMutation`, `refreshEntries`, `getEntriesByReference`, and balance maps; calls `warnIfUsingStoredBalanceAsTruth` guard |

---

## Backend Services

| Service | File | Responsibility |
|---|---|---|
| `accountingService` | `src/app/services/accountingService.ts` | Core JE CRUD (`createJournalEntry`, `createReversalEntry`, `getAllEntries`, `getAccountLedger`, `getCustomerLedger`, `getSupplierApGlJournalLedger`); customer and supplier GL ledger builders; fingerprint idempotency |
| `accountingReportsService` | `src/app/services/accountingReportsService.ts` | `getTrialBalance`, `getProfitLoss`, `getBalanceSheet`, `getAccountBalancesFromJournal`, `getArApGlSnapshot` |
| `accountService` | `src/app/services/accountService.ts` | COA CRUD: `getAllAccounts`, `getPaymentAccountsOnly`, `createAccount`, `updateAccount`, `deleteAccount`; `getAccountsForBranchDefaults` |
| `addEntryV2Service` | `src/app/services/addEntryV2Service.ts` | Typed entry paths: `manual_receipt`, `manual_payment`, expense, transfer; enforces payments-row-first rule; calls `applyManualReceiptAllocations` / `applyManualSupplierPaymentAllocations` |
| `effectivePartyLedgerService` | `src/app/services/effectivePartyLedgerService.ts` | `loadEffectivePartyLedger` — collapses PF-14 payment mutation chains into single effective rows with `mutationCount`, `mutations[]`, `runningBalance` |
| `arApReconciliationCenterService` | `src/app/services/arApReconciliationCenterService.ts` | `IntegrityLabSummary`, unposted document queue, unmapped JE queue, exception flags (`variance`, `missing_posting`, `unmapped`, `manual_adjustment`) |
| `roznamchaService` | `src/app/services/roznamchaService.ts` | `RoznamchaResult` from `payments` table (Cash In/Out only, not from journal lines) |
| `accountingCanonicalGuard` | `src/app/services/accountingCanonicalGuard.ts` | `assertGlTruthQueryTable`, `warnLegacyRead`, `failLegacyReadInDev`, `warnIfUsingStoredBalanceAsTruth`; defines `CANONICAL_GL_TABLES`, `LEGACY_TABLE_BLOCKLIST`, `NON_GL_LEDGER_TABLES` |
| `transactionMutationService` | `src/app/services/transactionMutationService.ts` | `recordTransactionMutation`, `fetchTransactionMutationsForEntity` — append-only audit log |

---

## DB Tables

### `accounts`
The Chart of Accounts. Key columns:
- `id` (UUID PK), `company_id`, `branch_id` (optional; NULL = company-wide)
- `code` — stable identifier (e.g. `'1000'`, `'1100'`, `'2000'`); used for parent resolution and BS classification
- `name`, `type` — type values: `'cash'`, `'bank'`, `'mobile_wallet'`, `'asset'`, `'liability'`, `'equity'`, `'revenue'`, `'expense'`
- `parent_id` — FK to `accounts.id` for hierarchy (AR party subledger children have `parent_id = AR control id`)
- `is_group` — `true` for COA section headers (excluded from pickers and BS detail lines); header code list: `1050, 1060, 1070, 1080, 1090, 2090, 3090, 4050, 6090`
- `is_system` — system-managed accounts (cannot be deleted via UI)
- `is_active` — inactive accounts excluded from pickers and reports
- `linked_contact_id` — FK to `contacts`; set on party subledger accounts (migration 20260364)
- `balance` — cached opening-balance field only; **not** the live GL balance (use journal for that)

### `journal_entries`
One header per accounting event. Key columns:
- `id` (UUID PK), `company_id`, `branch_id`
- `entry_no` — sequential human-readable number (e.g. `JE-0042`)
- `entry_date` — business date (YYYY-MM-DD); used for report filters
- `description` — free text narration
- `reference_type` — event classifier; valid values: `'sale'`, `'sale_return'`, `'purchase'`, `'purchase_return'`, `'expense'`, `'payment'`, `'opening_balance'`, `'rental'`, `'studio'`, `'manual'`, `'manual_receipt'`, `'manual_payment'`, `'on_account'`, `'payment_adjustment'`, `'correction_reversal'`, `'opening_balance_contact_ar'`, `'opening_balance_contact_ap'`, `'worker_payment'`, `'worker_advance_settlement'`
- `reference_id` — FK to the source document (e.g. `sales.id` when `reference_type='sale'`)
- `payment_id` — FK to `payments`; set on all payment-related JEs (primary + PF-14 adjustments)
- `action_fingerprint` — duplicate-prevention string; covered by UNIQUE partial index `idx_journal_entries_fingerprint_active` (`WHERE action_fingerprint IS NOT NULL AND is_void IS NOT TRUE`)
- `economic_event_id` — chain key linking primary + PF-14 adjustment JEs (Phase 4)
- `is_void`, `void_reason`, `voided_at` — void state; voided JEs are excluded from all GL computations
- `total_debit`, `total_credit` — header sum columns (kept in sync by DB trigger migration 20260434)
- `attachments` — JSONB array `[{ url, name }]` for document scans

### `journal_entry_lines`
One row per account side per JE. Key columns:
- `id` (UUID PK), `journal_entry_id` (FK), `account_id` (FK to `accounts`)
- `debit`, `credit` — must balance: `SUM(debit) = SUM(credit)` within each `journal_entry_id`
- `description` — optional line narration

### `ar_ap_reconciliation_review_items`
Exception queue for AR/AP integrity findings. Created by `arApReconciliationCenterService`. Key columns:
- `journal_entry_id`, `journal_line_id`, `account_id`, `account_code`, `account_name`
- `status` — `'new'`, `'reviewed'`, `'ready_to_post'`, `'ready_to_relink'`, `'ready_to_reverse_repost'`, `'resolved'`
- `integrity_lab_status` — `'clean'`, `'variance'`, `'missing_posting'`, `'unmapped'`, `'manual_adjustment'`

---

## Chart of Accounts Structure

### Account Types and Categories

| Category | DB type values | GL treatment |
|---|---|---|
| Asset | `'asset'`, `'cash'`, `'bank'`, `'mobile_wallet'`, `'receivable'`, `'inventory'` | Normal balance: Debit |
| Liability | `'liability'`, `'payable'` | Normal balance: Credit |
| Equity | `'equity'` | Normal balance: Credit |
| Revenue | `'revenue'`, `'income'` | Normal balance: Credit |
| Expense / COGS | `'expense'`, `'cost of sales'`, `'cogs'` | Normal balance: Debit |

P&L cost-of-sales codes: `5000`, `5010`, `5100`, `5110` (set `COST_OF_PRODUCTION_CODES`). Codes `5200` (Discount Allowed) and `5300` (Extra Expense) are operating expenses, not COGS.

### Key Account Codes

| Code | Name | Role |
|---|---|---|
| 1000 | Cash | Primary cash account |
| 1001 / 1020 | Petty Cash / Mobile Wallet | Sub-cash |
| 1010 | Bank | Primary bank account |
| 1100 | Accounts Receivable | AR control (parent of party subledger children) |
| 1180 | Worker Advance | Asset — worker advance settlements |
| 1200 | Inventory | Inventory asset |
| 2000 | Accounts Payable | AP control (parent of party subledger children) |
| 2010 | Worker Payable | Separate payroll control (not AP 2000) |
| 2011 | Security Deposit | Liability |
| 2020 | Rental Advance | Liability |
| 2030 | Courier Payable Control | AP sub-control for couriers |
| 3000 | Owner Capital / Opening Balance Equity | Equity; used for `opening_balance` JEs |
| 4000 / 4100 | Sales Revenue | Revenue |
| 4200 | Rental Income | Revenue |
| 5000 | Cost of Production | COGS |
| 6100 | Operating Expenses | P&L expenses section |

### Parent/Child Hierarchy
- `accounts.parent_id` forms a tree. `accountService.getAllAccounts` fetches all accounts for a company including `parent_id`.
- `collectDescendantAccountIds(rows, rootId)` — depth-first traversal used to gather all AR or AP sub-accounts for ledger filtering.
- `accountHierarchy.buildAccountMapById` — builds id → account map for BS classification (`classifyBalanceSheetAsset`, `classifyBalanceSheetLiability`).

### Control vs Party Subledger
- AR control account code `1100` may have child accounts per party, each with `linked_contact_id` set (migration 20260364).
- AP control account code `2000` has the same structure for suppliers.
- Trial Balance `arApMode` options: `'flat'` (each account as a separate row), `'summary'` (one rolled-up row per family), `'expanded'` (control row + indented children with `presentationIndent=1`).

---

## Journal Entry Lifecycle

### States
1. **Draft** — not currently implemented at the DB level; all programmatic inserts go straight to posted.
2. **Posted** — `is_void = false` (or null); active for GL.
3. **Void** — `is_void = true`; `void_reason` and `voided_at` set. Excluded from all reports and ledgers.

### Void vs Reversal
- **Void** (`is_void = true`): terminal. The JE disappears from all GL views. Used for cleanup of erroneous entries, or to zero out a full payment chain.
- **Reversal** (`reference_type = 'correction_reversal'`): creates a new active JE with Dr/Cr swapped from the original. Both the original and the reversal remain in the GL (net to zero). Idempotent: `findActiveCorrectionReversalJournalId` ensures at most one active `correction_reversal` per original JE.

### action_fingerprint Guard
```
UNIQUE partial index: idx_journal_entries_fingerprint_active
  ON journal_entries (action_fingerprint)
  WHERE action_fingerprint IS NOT NULL AND is_void IS NOT TRUE
```
On `23505` (duplicate key) conflict, `accountingService.createJournalEntry` recovers the existing row instead of throwing — the insert is idempotent. Fingerprint format examples:
- Payment adjustment (amount edit): `payment_adjustment_amount:{companyId}:{paymentId}:{oldAmount}:{newAmount}:{liquidityAccountId}`
- Checked via `hasExistingPaymentAmountAdjustment` and `hasExistingPaymentAccountAdjustment` before creating adjustment JEs.

---

## Manual Entry Flow (AddEntryV2)

`AddEntryV2.tsx` → `addEntryV2Service.ts`

### What can be manually entered
- **General journal** (any account pair, `reference_type = 'manual'`): free Dr/Cr against any two accounts.
- **Customer receipt** (`reference_type = 'manual_receipt'`): Dr Cash/Bank/Wallet, Cr AR. Creates `payments` row first; triggers FIFO allocation.
- **Supplier payment** (`reference_type = 'manual_payment'`): Dr AP, Cr Cash/Bank/Wallet. Creates `payments` row first; triggers FIFO allocation.
- **Expense** (`reference_type = 'expense'`): Dr Expense account, Cr Cash/Bank/Wallet. If debit side is Cash/Bank/Wallet, creates a `payments` row (Roznamcha rule — `isPaymentAccount` check in `AccountingContext`).
- **Opening balance** (`reference_type = 'opening_balance'`): Dr/Cr against equity account 3000.

### What is blocked
- Manual entry **cannot** change `reference_type` to `'sale'` or `'purchase'`. Those JEs are owned by their respective modules (see Source-Owned JE Protection below).
- `AddEntryV2` does not expose the `payment_id` field; payment linkage is done automatically.
- The Roznamcha rule: any Dr or Cr touching an account whose code starts with `100x` (Cash/Bank/Wallet codes 1000, 1010, 1020, and sub-wallet codes starting `102`) must also create a `payments` row so the transaction appears in the Daily Cash Book.

---

## Source-Owned JE Protection (reference_type Guard)

Certain `reference_type` values are owned by a source module and must not be edited or reversed from the Journal UI:

| reference_type | Owner module | Policy |
|---|---|---|
| `'sale'` | `saleAccountingService` | Journal edit/reverse blocked; use Sale void/return flows |
| `'sale_return'` | `saleReturnService` | Journal UI blocked |
| `'purchase'` | `purchaseAccountingService` | Journal UI blocked |
| `'purchase_return'` | `purchaseReturnService` | Journal UI blocked |
| `'rental'` | Rental module | Journal UI blocked |
| `'studio'` | Studio module | Journal UI blocked |

Enforcement: `journalEntryEditPolicy.journalReversalBlockedReason` (called inside `createReversalEntry` unless `options.bypassJournalSourceControlPolicy = true`). Sale/purchase return modules pass `bypassJournalSourceControlPolicy: true` because they need to post reversal JEs for their own compensation entries.

**PF-14 payment chain historical guard** also blocks reversal when the target JE is not the tail of its payment chain (see document 10).

---

## Party Ledger (effectivePartyLedgerService)

### Function: `loadEffectivePartyLedger`
Parameters: `companyId`, `contactId`, `partyType` (`'customer'` | `'supplier'`), `fromDate`, `toDate`, `branchId?`

### How GL balance is computed per contact
For **customers** (`partyType='customer'`):
1. Fetches all `sales`, `payments`, and `transaction_mutations` for the contact.
2. Groups payment rows by `paymentId`; collapses PF-14 mutation chains (each `amount_edit` or `account_change` mutation reduces the effective amount to the latest state).
3. Opens balance computation from JE lines on AR accounts (1100 + children) attributed to this customer's sales and receipts.
4. Builds `EffectiveLedgerRow[]` with `effectiveAmount`, `runningBalance`, `mutationCount`, `mutations[]`.

For **suppliers** (`partyType='supplier'`):
- Mirror of customer flow but uses AP accounts (2000 + children).
- `totalPurchases`, `totalPaid`, `unapplied` in `EffectiveLedgerSummary`.

### `EffectiveLedgerRow` fields
- `type`: `'sale'`, `'purchase'`, `'payment'`, `'receipt'`, `'opening'`, `'return'`, `'reversal'`, `'expense'`, `'adjustment'`, `'journal'`
- `status`: `'active'`, `'voided'`, `'cancelled'`
- `runningBalance` — cumulative Dr − Cr on the party's AR or AP accounts
- `mutationCount` — number of PF-14 mutations collapsed into this row
- `journalEntryNos[]` — all JE `entry_no` values in the chain

---

## AR/AP Reconciliation Center (arApReconciliationCenterService)

### Purpose
Compares GL AR/AP balances (from `journal_entry_lines`) against operational receivables/payables (from the Contacts RPC) to detect and surface variances.

### Key output: `IntegrityLabSummary`
- `gl_ar_net_dr_minus_cr` — AR control (1100) TB balance (debit − credit): positive = money owed to company
- `gl_ap_net_credit` — AP control (2000) TB net credit balance: positive = money owed by company
- `operational_receivables_full` — sum from Contacts RPC (includes openings, workers)
- `operational_payables_full` — sum from Contacts RPC
- `variance_receivables = gl_ar_net_dr_minus_cr − operational_receivables_full`
- `variance_payables = gl_ap_net_credit − operational_payables_full`
- `unposted_document_count` — final/received documents with no matching non-void JE
- `unmapped_ar_je_count`, `unmapped_ap_supplier_je_count`, `unmapped_ap_worker_je_count` — JE lines on AR/AP accounts that cannot be attributed to any customer/supplier
- `manual_adjustment_je_count` — JEs with `reference_type = 'manual_adjustment'` on AR/AP accounts
- `status`: `'clean'`, `'variance'`, `'missing_posting'`, `'unmapped'`, `'manual_adjustment'`

### Exception queues
- `UnpostedDocumentRow` — source documents without matching GL JE
- `UnmappedJournalRow` — JE lines on AR/AP with no recognisable party attribution
- `ar_ap_reconciliation_review_items` — persisted exception rows with workflow status (`'new'` → `'reviewed'` → `'resolved'`)

---

## Reporting Engine

All financial reports go through `accountingReportsService`. The single internal primitive is `getTrialBalance`, which all other reports call. Branch-scoped queries always include JEs with `branch_id IS NULL` (company-wide openings and legacy rows).

### Trial Balance — `getTrialBalance(companyId, startDate, endDate, branchId?, options?)`
1. `assertGlTruthQueryTable` guard called for both `'accounts'` and `'journal_entry_lines'`.
2. Fetches all active accounts for the company from `accounts`.
3. Fetches all `journal_entry_lines` with embedded `journal_entries` (date, `is_void`, `branch_id`).
4. Aggregates `SUM(debit)` and `SUM(credit)` per `account_id`, filtering: `is_void != true`, `entry_date BETWEEN startDate AND endDate`, branch scope.
5. Returns `{ rows: TrialBalanceRow[], totalDebit, totalCredit, difference }`.
6. AR/AP presentation: `applyTrialBalanceArApPresentation(rows, accounts, mode)` — `'flat'` (default), `'summary'` (rolled single row per control family), `'expanded'` (control + indented children).

### Balance Sheet — `getBalanceSheet(companyId, asOfDate, branchId?)`
1. Calls `getTrialBalance(companyId, '1900-01-01', asOfDate)` — cumulative from inception.
2. AR and AP rolled up: AR balance = sum of 1100 + all child account balances; AP balance = sum of 2000 + all child account balances. Children excluded from the detail list to avoid double-counting.
3. Groups by `accountTypeCategory`: assets, liabilities, equity. Revenue − Expense balance is rolled into retained earnings on equity.
4. Returns `{ assets, liabilities, equity, totalAssets, totalLiabilitiesAndEquity, difference }`.

### P&L — `getProfitLoss(companyId, startDate, endDate, branchId?, options?)`
1. Calls `getTrialBalance` for the period.
2. Revenue: `credit − debit` on accounts with `accountTypeCategory = 'revenue'`.
3. Cost of Sales: `debit − credit` on expense accounts where `code IN ('5000','5010','5100','5110')` or `type` includes `'cogs'` / `'cost'`.
4. Operating Expenses: `debit − credit` on remaining expense accounts (excludes COGS codes).
5. `grossProfit = revenue − costOfSales`; `netProfit = grossProfit − expenses`.
6. Optional comparison period: second `getTrialBalance` call for `compareStartDate`/`compareEndDate`.

### Day Book — `DayBookReport`
Source: `journal_entry_lines` joined to `journal_entries` (no `payments` table).
Filters by `entry_date`, `account_id` (optional), `company_id`, `branch_id`. Shows Dr/Cr per account per day with `entry_no` references.

### Roznamcha (Daily Cash Book) — `roznamchaService.getRoznamcha`
Source: **`payments` table only** — not from `journal_entry_lines`.
Shows Cash In / Cash Out per day for Cash/Bank/Wallet accounts. Columns: `cashIn`, `cashOut`, `runningBalance`, `accountLabel`. Filter: `payment_account_id` type must be `'cash'`, `'bank'`, or `'wallet'`. This is a business cash-flow view, not a GL view.

---

## GL Source of Truth

```
Canonical GL = journal_entries + journal_entry_lines
```

This is enforced by `accountingCanonicalGuard.ts`:

| Guard function | Purpose |
|---|---|
| `assertGlTruthQueryTable(screen, table)` | Fails in dev (`VITE_ACCOUNTING_LEGACY_HARD_FAIL=true`) when called with a retired table name |
| `warnLegacyRead(screen, reason)` | Throttled console warning in dev when legacy source is accessed |
| `failLegacyReadInDev(screen, reason)` | Throws in CI/dev strict mode |
| `warnIfUsingStoredBalanceAsTruth(screen, field)` | Warns when `'current_balance'` or `'balance'` is used as numeric truth |
| `assertNotLegacyTableForGlTruth(screen, table)` | Explicitly checks against `ledger_master`, `ledger_entries`, `chart_accounts`, `account_transactions`, `backup_cr`, `backup_pf145` |

Constants:
- `CANONICAL_GL_TABLES = ['journal_entries', 'journal_entry_lines', 'accounts']`
- `LEGACY_TABLE_BLOCKLIST = ['chart_accounts', 'account_transactions', 'backup_cr', 'backup_pf145']`
- `NON_GL_LEDGER_TABLES = ['ledger_master', 'ledger_entries']` (retired duplicate subledger tables — obfuscated in source to survive repo grep)

**Never use**: `contacts.current_balance`, `accounts.balance` (as GL truth), `ledger_master`, `ledger_entries` for any live GL computation or financial report.

---

## Known Failure Points

### Orphan JEs
1. **Orphan sale/purchase JEs**: `getAllEntries` in `accountingService` cross-references `reference_id` against `sales` and `purchases` to detect JEs whose source document was hard-deleted. However, this is a UI filter only — the orphan JEs remain in the DB and are included in trial balance totals, causing a variance between TB and operational data.

2. **Orphan payment JEs**: If a `payments` row is deleted directly (bypassing `voidPaymentAfterJournalReversal`), the corresponding JEs remain active. Detection: `payments LEFT JOIN journal_entries WHERE journal_entries.payment_id IS NOT NULL AND payments.id IS NULL`.

### Unbalanced Entries
3. **Partial line insert failure**: `createJournalEntry` inserts the `journal_entries` header then inserts `journal_entry_lines` in a separate call. If the lines insert fails after the header succeeds, a header with zero lines exists in the DB — visible in the workbench, silently adds 0 to the trial balance but is structurally invalid. No compensating delete runs on lines failure.

4. **`total_debit` / `total_credit` staleness**: These header summary columns are written by a DB trigger (migration 20260434) and also set explicitly after insert. On older DBs without the trigger, the columns may be stale. All report logic uses `journal_entry_lines` directly, not header totals, so this is a display issue only.

### Stale Account Caches
5. **`accounts.balance` cache drift**: The `balance` column on `accounts` is an opening-balance cache. Any code that reads `accounts.balance` as a live GL figure (rather than `accountingReportsService.getAccountBalancesFromJournal`) will show stale data. The `warnIfUsingStoredBalanceAsTruth` guard warns in dev but does not block in production.

6. **`accountService.getAllAccounts` branch filter schema miss**: When the `accounts.branch_id` column is absent from the PostgREST schema cache, `getAllAccounts` silently retries without the branch filter, returning all company accounts regardless of branch. The retry is logged but there is no runtime error.

### Duplicate JEs
7. **`action_fingerprint` not set on older paths**: The partial unique index only guards JEs where `action_fingerprint IS NOT NULL`. Any code path that creates a JE without a fingerprint (pre-PF-14 code, direct DB scripts) can create duplicates. The `createJournalEntry` duplicate-recovery fallback (checking `reference_type + reference_id` for sales/purchases) covers only a subset of cases.

8. **Duplicate `entry_no`**: `pickPreferredJournalEntryRow` handles the case where `maybeSingle()` would fail due to multiple rows matching the same `entry_no`. The preferred row is the oldest non-void one. The underlying cause (two inserts with the same sequence number) is not auto-repaired.

### AR/AP Reconciliation
9. **Unmapped AR/AP JEs**: Manual JEs posted to AR (1100) or AP (2000) without a recognisable `reference_type` or `reference_id` appear in the reconciliation center's unmapped queue and inflate the GL balance without a corresponding operational document. `manual_adjustment_je_count` tracks these.

10. **Party subledger account vs control account split**: When a party has a dedicated subledger account (`linked_contact_id` set) AND the generic control account (1100/2000) also carries some of their history, the party ledger may show a different total than the TB control row. `collectDescendantAccountIds` should capture all children, but only if `parent_id` is correctly set on the subledger account.

---

## Recommended Standard

1. **All GL reads must go through `journal_entries + journal_entry_lines`**. Call `assertGlTruthQueryTable` at any new aggregation boundary. Never use `contacts.current_balance`, `accounts.balance`, `ledger_master`, or `ledger_entries` as GL truth.

2. **All JE inserts must set `action_fingerprint`** for any event that could be triggered more than once (payment adjustments, return JEs, opening balance posts). Format: `{event_type}:{companyId}:{documentId}[:{additional_discriminators}]`.

3. **Manual entries touching Cash/Bank/Wallet must create a `payments` row first** (Roznamcha rule). The JE `payment_id` must reference that payments row. `isPaymentAccount` in `AccountingContext` identifies qualifying accounts by code prefix (`1000`, `1010`, `1020`, `102x`) and account type.

4. **`reference_type` on JEs must match the canonical list**. Do not invent new values without updating: `glStatementSourceModuleFromReferenceType`, `glStatementDocumentTypeFromReferenceType`, `journalReversalBlockedReason`, and the AR/AP reconciliation attribution logic.

5. **Reversal JEs must use `reference_type = 'correction_reversal'`** with `reference_id` set to the original `journal_entries.id`. Use `createReversalEntry` — it enforces the idempotency check (`findActiveCorrectionReversalJournalId`) and the source-owned JE protection (`journalReversalBlockedReason`).

6. **Trial Balance is the single primitive** for all financial reports. Do not build a separate aggregation path for P&L or Balance Sheet — call `getTrialBalance` and derive from its rows to ensure consistency.

7. **AR and AP control accounts (1100, 2000) must be rolled up including child subledger accounts** in all BS and reconciliation views. Use `collectDescendantAccountIds(rows, rootId)` to gather the full family before summing TB rows.

8. **Voided JEs must be excluded everywhere**: filter `is_void != true` in every GL query. The `effectivePartyLedgerService` and all `accountingReportsService` methods already do this, but any new query must add the filter explicitly.
