# 14 — Expenses and Manual Entries Engine

> Last updated: 2026-04-12

---

## Business Purpose

Tracks all operating cash outflows that are not inventory purchases: rent, utilities, salaries, marketing, travel, repairs, and miscellaneous spending. Each expense is linked to a vendor (optional), a payment method (Cash or Bank), and an expense category that resolves to a specific GL account. On save the system automatically fires a journal entry: **Dr Expense Account / Cr Cash (1000) or Bank (1010) or Accounts Payable (2000)**.

A second entry path — **Add Entry V2** (via `addEntryV2Service.ts`) — allows accountants to post typed manual transactions (customer receipt, supplier payment, general expense, worker payment, courier payment) directly to the ledger without creating a standard expense row.

---

## UI Entry Points

| Surface | Route / View | Primary Component |
|---------|-------------|-------------------|
| Expenses list | `view: expenses` | `ExpensesDashboard`, `ExpensesList` |
| Add / edit expense | Drawer inside Expenses view | `ExpenseForm` (inside ExpensesDashboard) |
| Manual entry | Accounting → Add Entry V2 | `AccountingDashboard` → `AddEntryV2` dialog |

---

## Frontend Files

| File | Role |
|------|------|
| `src/app/context/ExpenseContext.tsx` | State manager, orchestrates create/update/delete and accounting integration; serialises concurrent edits via `expenseUpdateChainRef` |
| `src/app/services/expenseService.ts` | Supabase CRUD for `expenses` table; `getReversedExpenseIds()` for reversal detection |
| `src/app/services/expenseCategoryService.ts` | CRUD for `expense_categories`; resolves GL account via `getExpenseAccountIdForCategory()` |
| `src/app/services/addEntryV2Service.ts` | Typed manual entry service — one code path per entry type (customer receipt, supplier payment, expense, worker, courier) |
| `src/app/lib/accountingEditClassification.ts` | `classifyPaidExpenseEdit()`, `buildExpenseCanonicalComparisonRows()` — determines whether a paid-expense edit requires a JE reversal+repost |
| `src/app/lib/expenseEditCanonical.ts` | `normalizeNullableText()` — canonical field comparison for edit classification |
| `src/app/lib/expenseEditTrace.ts` | `createExpenseEditTraceId()`, `pushExpenseEditTrace()` — audit trace for every expense edit |
| `src/app/lib/documentEditActivityLog.ts` | `logDocumentEditActivity()`, `formatFieldChangeLines()` — human-readable change log |
| `src/app/services/accountingIntegrityService.ts` | `voidJournalEntries()` — used during expense delete/void to nullify the associated JE |

---

## Backend Services

| Service | Key Functions |
|---------|---------------|
| `expenseService` | `createExpense()`, `getAllExpenses()`, `getExpense()`, `updateExpense()`, `deleteExpense()`, `getReversedExpenseIds()`, `getExpensesByCategory()` |
| `expenseCategoryService` | `getCategories()`, `getTree()`, `create()`, `update()`, `delete()`, `getExpenseAccountIdForCategory()`, `getOperatingCategoriesForPicker()` |
| `documentNumberService` | `getNextDocumentNumber(companyId, branchId, 'expense')` → atomic number from `erp_document_sequences` via `generate_document_number` RPC |
| `accountingService` | Creates journal entries (`journal_entries` + `journal_entry_lines`) when an expense is posted |
| `accountingIntegrityService` | `voidJournalEntries()` — marks prior JEs `is_void = true` |
| `addEntryV2Service` | Manual typed entries; separate code path per type; uses `erp_document_sequences` for payment references |

---

## DB Tables

### `expenses`
| Column | Notes |
|--------|-------|
| `id` | UUID PK |
| `company_id`, `branch_id` | Multi-tenant isolation |
| `expense_no` | Auto-generated: `EXP-NNNN` via `generate_document_number` RPC with type `expense` |
| `expense_date` | Date of spending |
| `category` | Slug string (e.g. `rent`, `utilities`, `salaries`) matching `expense_categories.slug` |
| `description` | Free-text description |
| `amount` | Numeric |
| `payment_method` | `cash` \| `bank` \| `credit` (determines credit account in JE) |
| `payment_account_id` | UUID FK → `accounts.id`; explicit credit account override |
| `vendor_id`, `vendor_name` | Optional vendor link; `vendor_name` may be stripped on schema cache errors (retry logic in `createExpense()`) |
| `status` | `draft` \| `submitted` \| `approved` \| `paid` \| `rejected` |
| `approved_by`, `approved_at` | Approval trail |
| `created_by` | User UUID |

### `expense_categories`
| Column | Notes |
|--------|-------|
| `id` | UUID PK |
| `company_id` | Per-company |
| `name`, `slug` | Display name and machine key (slug derived via `nameToSlug()`) |
| `parent_id` | Self-referential for hierarchy; `NULL` = top-level |
| `type` | `salary` \| `utility` \| `general` |
| `color`, `icon` | UI display |
| `description` | Optional |

---

## Expense Create Flow

1. User fills the expense form and clicks Save.
2. `ExpenseContext.createExpense()` calls `documentNumberService.getNextDocumentNumber(companyId, branchId, 'expense')`, which hits the `generate_document_number` Supabase RPC → increments `erp_document_sequences`.
3. `expenseService.createExpense(payload)` inserts into `expenses`. If `vendor_name` column is missing (schema cache error), the service retries without it.
4. `ExpenseContext` calls `expenseCategoryService.getExpenseAccountIdForCategory(companyId, categorySlug)` to resolve the debit account:
   - Looks up `CATEGORY_SLUG_TO_CODE` map (e.g. `rent → 5400`, `utilities → 5500`, `salaries → 5600`, `office_supplies → 5810`, `repairs → 5820`, `other/miscellaneous → 5900`).
   - If account by code not found, falls back to first active operating-expense account (excluding codes `5000`, `5010`, `5100`, `5200`, `5300` and names matching `/cost of production|cost of studio|shipping expense|courier/i`).
5. Credit account is resolved from `payment_method`:
   - `cash` → account code `1000` (Cash)
   - `bank` → account code `1010` (Bank)
   - `credit` / AP → account code `2000` (Accounts Payable)
   - If `payment_account_id` is set on the expense row, that UUID takes precedence.
6. `accountingService` posts: **Dr expense_account_id / Cr credit_account_id** with `reference_type = 'expense'`, `reference_id = expense.id`.

---

## Expense Edit Flow

1. User opens an existing expense and saves changes.
2. `ExpenseContext.updateExpense()` serialises the update through `expenseUpdateChainRef` (per-expense promise chain) to prevent race conditions.
3. `classifyPaidExpenseEdit()` in `accountingEditClassification.ts` compares the canonical snapshot of the current paid JE lines against the new values.
4. Classification result:
   - **`no_change`** — fields only changed are non-accounting (description, notes). Only DB row updated.
   - **`repost_needed`** — amount, category, or payment method changed. Prior JE is voided (`voidJournalEntries()`), new JE is created.
   - **`amount_adjustment`** — partial correction JE posted (Dr/Cr delta only).
5. `expenseService.updateExpense(id, updates)` writes the DB row. Same `vendor_name` retry logic applies.
6. Edit activity logged via `logDocumentEditActivity()` and `pushExpenseEditTrace()`.

---

## Expense Delete / Void

`expenseService.deleteExpense(id)` performs a **soft delete** by setting `status = 'rejected'` — no physical row deletion. The `expenses` row persists so audit trails and JEs remain consistent.

To fully offset the GL effect: the caller should void the associated JE via `accountingIntegrityService.voidJournalEntries()`. The `getReversedExpenseIds()` function identifies expenses whose latest active JE has a corresponding `correction_reversal` JE, making them invisible in operational totals by default.

---

## Category System (How Categories Link to GL Accounts)

Resolution order in `getExpenseAccountIdForCategory(companyId, categorySlug)`:

1. **Slug → code lookup** via `CATEGORY_SLUG_TO_CODE`:
   ```
   rent             → 5400
   utilities        → 5500
   salaries/salary  → 5600
   marketing        → 5700
   travel           → 5800
   office_supplies  → 5810
   repairs/repairs_maintenance → 5820
   other/miscellaneous         → 5900
   ```
2. Query `accounts` table: `.eq('code', code).eq('is_active', true)`.
3. Fallback: scan all `type = 'expense'` accounts, exclude **internal codes** (`5000`, `5010`, `5100`, `5200`, `5300`) and **internal names** (`/cost of production|cost of studio|shipping expense|extra expense|courier|payable|receivable/i`). Return first match.
4. Returns `null` if no operating expense account found (posting will fail — known failure point).

The `getOperatingCategoriesForPicker()` function surfaces only user-facing categories (excludes same internal name patterns) and falls back to eight hardcoded defaults if the `expense_categories` table is empty or absent.

---

## Payment Method (Cash / Bank — Credit Account in JE)

| `payment_method` value | Credit account used |
|------------------------|---------------------|
| `cash` / `Cash` | Account code `1000` (Cash) |
| `bank` / `Bank` | Account code `1010` (Bank) |
| `credit` (on account) | Account code `2000` (Accounts Payable) |
| Any value + `payment_account_id` set | UUID in `payment_account_id` overrides all |

If `payment_account_id` is present on the expense row, the context uses that UUID directly as the credit account without doing a code lookup.

---

## Accounting Effect (JE Format)

```
Dr  [Expense Account]   amount    (e.g. 5400 Rent, 5600 Salaries)
Cr  [Cash/Bank/AP]      amount    (1000 Cash, 1010 Bank, or 2000 AP)

journal_entries.reference_type = 'expense'
journal_entries.reference_id   = expenses.id
```

A **correction_reversal** JE is posted when a paid expense is edited:
```
Dr  [Old Credit Account]  old_amount   (reversal of credit)
Cr  [Old Expense Account] old_amount   (reversal of debit)
— then —
Dr  [New Expense Account] new_amount
Cr  [New Credit Account]  new_amount
```

Account codes 5100 / 6100 (legacy Operating Expenses) are filtered out of the user-facing category picker as `INTERNAL_EXPENSE_CODES` but may still appear in older JEs on legacy tenants.

---

## Manual Journal Entry (Add Entry V2)

`addEntryV2Service.ts` provides typed entry functions, each with a distinct code path:

| Entry type | Function | Key accounting effect |
|-----------|----------|----------------------|
| Customer receipt | `postCustomerReceipt()` | Dr Cash/Bank, Cr Accounts Receivable (1100) |
| Supplier payment | `postSupplierPayment()` | Dr Accounts Payable (2000), Cr Cash/Bank |
| General expense | Posts to `expenses` then triggers normal expense JE | Dr Expense account, Cr Cash/Bank |
| Worker payment | `postWorkerPayment()` | Dr Worker Payable (2010), Cr Cash/Bank |
| Courier payment | `postCourierPayment()` — uses `get_or_create_courier_payable_account` RPC | Dr Courier Payable, Cr Cash/Bank |

**Constraints on manual entries:**
- Every cash/bank-touching entry creates a `payments` row first, then a JE with `payment_id` linked.
- Contact ID is validated against `contacts` table before insertion to prevent FK violations (`validPaymentsContactId()`).
- Payment method is normalised: `cash/Cash → cash`, `bank/Bank → bank`, `mobile wallet → mobile_wallet`, `card/cheque → other`.
- Numbers use `erp_document_sequences` (`customer_receipt`, `supplier_payment` types) via `getNextDocumentNumber()`.
- Users cannot post a manual entry with no debit or no credit side (enforced in UI).

---

## Source of Truth

| Concern | Authoritative source |
|---------|---------------------|
| Expense rows | `expenses` table (`company_id` + `branch_id` scoped) |
| Category → GL code | `CATEGORY_SLUG_TO_CODE` map in `expenseCategoryService.ts` |
| Expense numbering | `erp_document_sequences` (`document_type = 'expense'`) via `generate_document_number` RPC |
| Accounting effect | `journal_entries` + `journal_entry_lines` (`reference_type = 'expense'`) |
| Reversal detection | `getReversedExpenseIds()` — checks for `correction_reversal` JE chained from the latest expense JE |

---

## Known Failure Points

1. **`vendor_name` column missing in some tenants** — `createExpense()` and `updateExpense()` each have a silent retry that strips `vendor_name` from the payload. If both attempts fail the error is rethrown; callers may not surface it clearly.

2. **`expense_categories` table absent** — `getAllExpenses()` catches `PGRST200` and falls back to a plain `expenses` select without the category join. Category name is then unavailable in the list.

3. **`company_id` / `expense_date` column drift** — `getAllExpenses()` has a cascade of fallbacks (`order by created_at`, then no ordering at all) when column `42703` errors occur. This masks schema migration gaps rather than flagging them.

4. **`getExpenseAccountIdForCategory()` returns `null`** — if no matching GL account exists the expense is saved to DB but the JE is never posted. No error is shown to the user. The GL silently goes out of balance.

5. **Concurrent edit race** — `expenseUpdateChainRef` serialises updates per expense ID, but only within the same browser session. Two users editing the same expense simultaneously on different clients can each void and repost, leaving duplicate active JEs.

6. **Soft delete does not void JE** — `deleteExpense()` only sets `status = 'rejected'`. If the caller forgets to also call `voidJournalEntries()`, the GL entry remains active and the expense disappears from the UI but stays in the ledger.

7. **Legacy account code 6100 / 5100 on picker** — `INTERNAL_EXPENSE_CODES` blocks them from user-facing dropdowns but existing historical records may still reference those codes, causing mismatch in reports.

---

## Recommended Standard

1. **Always void the JE when deleting an expense.** `deleteExpense()` must call `voidJournalEntries(expenseId)` atomically — wrap both in a DB transaction or RPC.

2. **Require account mapping before save.** Block form submission if `getExpenseAccountIdForCategory()` returns `null`; show an actionable error pointing to Chart of Accounts setup.

3. **Enforce `expense_categories` and required columns** via migration health checks on tenant onboarding, eliminating the silent fallback cascade in `getAllExpenses()`.

4. **Replace `vendor_name` retry** with a proper migration that ensures the column exists on all tenants, then remove the dual-attempt pattern in `createExpense()` / `updateExpense()`.

5. **Optimistic locking for concurrent edits** — add a `version` or `updated_at` check when calling `updateExpense()` so stale updates are rejected rather than silently overwriting.
