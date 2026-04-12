# 18 — Source of Truth Matrix

**Last updated:** 2026-04-12
**Stack:** Next.js + Supabase (multi-tenant)
**Scope:** Cross-cutting canonical data sources for every domain entity in the ERP

---

## Governing Principle

GL truth comes **only** from `journal_entries` + `journal_entry_lines` joined to `accounts`.

Operational tables (`sales`, `purchases`, `expenses`, `payments`, `contacts`, `inventory_balance`, etc.) are source of truth for their own document state (status, line items, dates) but are **never** the source of truth for any GL balance, running balance, or financial report figure.

The `accountingCanonicalGuard` service (`assertGlTruthQueryTable`, `warnIfUsingStoredBalanceAsTruth`) enforces this boundary in code.

---

## Domain Source of Truth Matrix

---

### 1. Sale Total / Revenue

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` = account with `code = '4100'` (Revenue) AND `journal_entries.reference_type = 'sale'` AND `is_void = false` → `SUM(credit) − SUM(debit)` |
| **Cached / derived** | `sales.total` — the invoice total stored on the sales document at creation time |
| **GL representation** | Account code `4100` (Revenue); Dr Accounts Receivable (1100) / Cash (1000), Cr Revenue (4100) |
| **Staleness risk** | `sales.total` reflects the invoice amount at posting time. If a sale is edited post-finalization, a delta JE is created but `sales.total` may be updated directly. If the delta JE creation failed silently, the GL and `sales.total` diverge. |
| **Dashboard shortcut** | `sales.total` WHERE `status = 'final'` is used for dashboard KPIs — accepted documented shortcut |
| **Reconciliation query** | `SELECT SUM(jel.credit) - SUM(jel.debit) AS gl_revenue FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code = '4100' AND je.is_void = false AND je.entry_date BETWEEN $2 AND $3` vs `SELECT SUM(total) FROM sales WHERE company_id = $1 AND status = 'final' AND invoice_date BETWEEN $2 AND $3` |

---

### 2. Sale Return Refund Amount

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `journal_entries.reference_type = 'sale_return'` AND `is_void = false` → `SUM(debit)` on account code `4100` (revenue reversed) |
| **Cached / derived** | `sale_returns.total` — stored on the return document |
| **GL representation** | Dr Revenue (4100) to reverse original credit; Cr AR (1100) or Cash (1000) depending on refund method |
| **Staleness risk** | `sale_returns.total` is populated at return creation. If the reversal JE fails, operational and GL diverge. |
| **Reconciliation query** | `SELECT SUM(jel.debit) AS gl_returns FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code = '4100' AND je.reference_type = 'sale_return' AND je.is_void = false` vs `SELECT SUM(total) FROM sale_returns WHERE company_id = $1` |

---

### 3. Purchase Total

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `journal_entries.reference_type = 'purchase'` AND `is_void = false` → `SUM(debit)` on inventory (account code `1200`) or COGS (5000) accounts |
| **Cached / derived** | `purchases.total` — invoice total on the purchase document |
| **GL representation** | Dr Inventory (1200) or COGS (5000/5010), Cr Accounts Payable (2000) |
| **Staleness risk** | `purchases.total` is set at document creation. Purchase edits before posting may not yet have a JE. Dashboard uses `purchases.total` with status filter `IN (PURCHASE_POSTED_ACCOUNTING_STATUSES)` as accepted shortcut. |
| **Reconciliation query** | `SELECT SUM(jel.debit) AS gl_purchases FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code IN ('1200','5000','5010') AND je.reference_type = 'purchase' AND je.is_void = false AND je.entry_date BETWEEN $2 AND $3` vs `SELECT SUM(total) FROM purchases WHERE company_id = $1 AND status IN ('received','posted','final') AND po_date BETWEEN $2 AND $3` |

---

### 4. Purchase Return Amount

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `journal_entries.reference_type = 'purchase_return'` AND `is_void = false` |
| **Cached / derived** | `purchase_returns.total` (if table exists) |
| **GL representation** | Dr AP (2000), Cr Inventory (1200) or COGS account |
| **Staleness risk** | Same pattern as sale returns — operational total at document creation; GL at JE posting. |
| **Reconciliation query** | Compare `SUM(jel.credit)` on inventory accounts for `reference_type = 'purchase_return'` vs operational return totals. |

---

### 5. Customer (AR) Balance

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` IN (AR control 1100 + all party subledger children with `accounts.parent_id = ar_control_id` AND `accounts.linked_contact_id = $contactId`) AND `journal_entries.is_void = false` → `SUM(debit) − SUM(credit)` = net AR balance for that customer |
| **Cached / derived** | `contacts.current_balance` — a denormalized cache, updated on payment allocation events. **Do not use as GL truth.** |
| **GL representation** | Account code `1100` (AR Control) + party subledger child accounts created per contact (via `linked_contact_id`). Reference types: `sale`, `payment`, `sale_return`, `opening_balance_contact_ar`, `manual_receipt` |
| **Staleness risk** | `contacts.current_balance` can diverge from GL 1100 subledger if: (a) a payment allocation JE fails; (b) a manual journal directly debits/credits the subledger without updating `contacts.current_balance`; (c) opening balance correction. **High staleness risk.** |
| **Reconciliation query** | `SELECT a.linked_contact_id, SUM(jel.debit) - SUM(jel.credit) AS gl_ar_balance FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.parent_id = $ar_control_id AND je.is_void = false GROUP BY a.linked_contact_id` vs `SELECT id, current_balance FROM contacts WHERE company_id = $1 AND contact_type = 'customer'` |

---

### 6. Supplier (AP) Balance

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` IN (AP control 2000 + party subledger children with `accounts.parent_id = ap_control_id` AND `accounts.linked_contact_id = $contactId`) AND `journal_entries.is_void = false` → `SUM(credit) − SUM(debit)` = net AP liability |
| **Cached / derived** | `contacts.current_balance` for suppliers — same cache, same staleness risk as AR. `purchases.due_amount` — document-level remaining balance after payments applied. |
| **GL representation** | Account code `2000` (AP Control) + party subledger children. Reference types: `purchase`, `payment` (payment_type='paid'), `purchase_return`, `opening_balance_contact_ap`, `on_account` |
| **Staleness risk** | High. `contacts.current_balance` for suppliers diverges identically to AR. `purchases.due_amount` diverges when payments are partially allocated or when on-account payments are applied via JE without updating the document's `due_amount`. |
| **Reconciliation query** | Same pattern as AR but `SUM(credit) − SUM(debit)` on AP subledger accounts, compared to `contacts.current_balance` for suppliers and `SUM(purchases.due_amount)`. |

---

### 7. Stock Quantity per Product / Variation

| Field | Detail |
|---|---|
| **Canonical source** | `SELECT SUM(quantity_change) FROM stock_movements WHERE product_id = $1 AND (variation_id = $2 OR variation_id IS NULL) AND company_id = $3` |
| **Cached / derived** | `products.current_stock` — updated synchronously on sale/purchase/return events; can be stale if an operation fails mid-transaction. `inventory_balance` table — may be a snapshot that is not always updated. |
| **GL representation** | No direct GL line per stock unit. Inventory value is GL (account 1200). Stock quantity is operational. |
| **Staleness risk** | `products.current_stock` is a running balance updated on each stock event. If a sale posts stock movement but the balance update fails (e.g. partial transaction), `current_stock` can undercount. `inventory_balance` table has higher staleness risk if it is batch-updated rather than event-driven. |
| **Reconciliation query** | `SELECT sm.product_id, SUM(sm.quantity_change) AS canonical_qty, p.current_stock AS cached_qty FROM stock_movements sm JOIN products p ON p.id = sm.product_id WHERE sm.company_id = $1 GROUP BY sm.product_id, p.current_stock HAVING ABS(SUM(sm.quantity_change) - p.current_stock) > 0.001` |

---

### 8. Inventory Value

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` = account with `code = '1200'` (Inventory) AND `journal_entries.is_void = false` → `SUM(debit) − SUM(credit)` = net inventory asset value (all-time cumulative) |
| **Cached / derived** | `inventory_balance.total_value` (if populated) — snapshot, likely stale. `products.average_cost × current_stock` — derived estimate. |
| **GL representation** | Account code `1200` (Inventory / Stock). Debited on purchase receipt; credited on COGS recognition at sale time. |
| **Staleness risk** | `inventory_balance` table staleness risk is high (batch updates). Computed `average_cost × current_stock` diverges when costs change or returns occur. Only GL (1200) is authoritative for financial reporting. |
| **Reconciliation query** | `SELECT SUM(jel.debit) - SUM(jel.credit) AS gl_inventory FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code = '1200' AND je.is_void = false` vs `SELECT SUM(average_cost * current_stock) FROM products WHERE company_id = $1` |

---

### 9. Expense Total

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` on expense accounts (codes 5xxx) AND `journal_entries.reference_type = 'expense'` AND `is_void = false` → `SUM(debit)` for a date range |
| **Cached / derived** | `expenses.amount` WHERE `status = 'paid'` — document-level amount. Used as dashboard shortcut. |
| **GL representation** | Dr expense account (5100+ for operating expenses), Cr Cash (1000) or Bank (1010) or AP (2000) depending on payment method. Reference type: `'expense'`. |
| **Staleness risk** | `expenses.amount` is set at document creation. An expense can be in `paid` status without a JE if accounting posting failed. Dashboard uses `expenses.amount` as accepted shortcut. |
| **Reconciliation query** | `SELECT SUM(jel.debit) AS gl_expenses FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code LIKE '5%' AND je.reference_type = 'expense' AND je.is_void = false AND je.entry_date BETWEEN $2 AND $3` vs `SELECT SUM(amount) FROM expenses WHERE company_id = $1 AND status = 'paid' AND expense_date BETWEEN $2 AND $3` |

---

### 10. Rental Payment Status

| Field | Detail |
|---|---|
| **Canonical source** | `payments` WHERE `reference_type = 'rental'` AND `reference_id = $rentalId` AND `voided_at IS NULL` → `SUM(amount)` compared to `rentals.total_amount` to derive outstanding balance |
| **Cached / derived** | `rentals.status`, `rentals.paid_amount`, `rentals.due_amount` — document-level cached values |
| **GL representation** | `journal_entries.reference_type = 'rental'`; Dr Cash/Bank (1000/1010), Cr Rental Revenue (4xxx) or deferred revenue account |
| **Staleness risk** | `rentals.due_amount` can diverge from payments SUM if a payment record is voided after the rental document cache was last updated. |
| **Reconciliation query** | `SELECT r.id, r.due_amount AS cached_due, r.total_amount - COALESCE(p.paid, 0) AS computed_due FROM rentals r LEFT JOIN (SELECT reference_id, SUM(amount) AS paid FROM payments WHERE reference_type = 'rental' AND voided_at IS NULL GROUP BY reference_id) p ON p.reference_id = r.id WHERE r.company_id = $1 AND ABS(r.due_amount - (r.total_amount - COALESCE(p.paid,0))) > 0.01` |

---

### 11. Studio Production Cost

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `journal_entries.reference_type = 'studio'` AND `is_void = false` → `SUM(debit)` on account code `5100` (Studio/Production Cost) |
| **Cached / derived** | `studio_orders.production_cost` or similar document-level column |
| **GL representation** | Account code `5100` (Production Cost); reference type `'studio'`. Dr Production Cost (5100), Cr Cash/Bank/AP |
| **Staleness risk** | Document column is set at creation; GL is posted separately. Risk of divergence if posting fails. |
| **Reconciliation query** | Compare `SUM(jel.debit)` on account 5100 for `reference_type = 'studio'` vs `SUM(production_cost)` from studio orders in the same period. |

---

### 12. Worker Advance Balance

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` on account code `1300` (Worker Advances / Employee Advances) AND `journal_entries.is_void = false` → `SUM(debit) − SUM(credit)` cumulative = outstanding advance balance per worker |
| **Cached / derived** | `workers.advance_balance` or `contacts.current_balance` for worker contact type — may be updated on payment events only |
| **GL representation** | Account code `1300` (Worker Advance). Reference types: `'worker_payment'` (advance issued, Dr 1300 Cr Cash), `'worker_advance_settlement'` (settled, Dr Wage Expense Cr 1300). Worker Payable is separate at account code `2010`. |
| **Staleness risk** | Any cached advance balance on the worker/contact record can diverge if a settlement JE is posted manually without updating the cache. |
| **Reconciliation query** | `SELECT SUM(jel.debit) - SUM(jel.credit) AS gl_advance FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code = '1300' AND je.is_void = false` per worker contact/account. |

---

### 13. Cash Balance (Account 1000)

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` = account with `code = '1000'` AND `journal_entries.is_void = false` → `SUM(debit) − SUM(credit)` cumulative (all-time) |
| **Cached / derived** | Roznamcha running balance (`payments` table SUM). `accounts.balance` column — opening balance only, **not live GL**. |
| **GL representation** | Account code `1000`. Every cash-touching event creates a JE line on this account. Reference types: `sale`, `payment`, `expense`, `purchase`, `rental`, `manual_receipt`, `manual_payment`, etc. |
| **Staleness risk** | `accounts.balance` is an opening balance seed — never reflects post-opening activity. Roznamcha is a payment-only view and diverges when manual JEs touch Cash without a payments row. GL (1000) is always current. |
| **Dashboard source** | `getAccountBalancesFromJournal` — GL is used even on the dashboard. No operational shortcut for this metric. |
| **Reconciliation query** | `SELECT SUM(jel.debit) - SUM(jel.credit) AS gl_cash FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code = '1000' AND je.is_void = false` vs Roznamcha closing balance for the same period. |

---

### 14. Bank Balance (Account 1010)

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `account_id` = account with `code = '1010'` (or `type = 'bank'`) AND `is_void = false` → `SUM(debit) − SUM(credit)` cumulative |
| **Cached / derived** | Roznamcha bank split (`payments` table WHERE liquidity = 'bank'). `accounts.balance` — opening only. |
| **GL representation** | Account code `1010` (primary bank). Additional bank accounts may have codes `1011`, `1012`, etc. All with `type = 'bank'`. |
| **Staleness risk** | Same as Cash (1000). `accounts.balance` is not live. Roznamcha bank split diverges from GL when direct bank JEs exist without payments rows. |
| **Dashboard source** | `getAccountBalancesFromJournal` — GL-sourced. Aggregates all accounts with `code = '1010'` or `type = 'bank'`. |
| **Reconciliation query** | Same pattern as Cash but filter `a.type = 'bank'` or `a.code LIKE '101%'`. |

---

### 15. Opening Balance Equity

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` WHERE `journal_entries.reference_type IN ('opening_balance', 'opening_balance_contact_ar', 'opening_balance_contact_ap')` AND `account_id` on equity account (code `3000` or `type = 'equity'`) AND `is_void = false` → `SUM(credit) − SUM(debit)` |
| **Cached / derived** | `accounts.balance` on equity account — the seed value entered at COA setup. After JEs are posted, the live equity is in the journal, not this column. |
| **GL representation** | Account code `3000` (Opening Balance Equity / Retained Earnings). Credited when assets are brought in as opening; debited for liabilities. |
| **Staleness risk** | `accounts.balance` is the seed only. Live equity = seed + all subsequent P&L net profit + manual equity adjustments, computed from JE lines. Balance Sheet equity section derives from GL. |
| **Reconciliation query** | `SELECT SUM(jel.credit) - SUM(jel.debit) AS gl_equity FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id JOIN accounts a ON a.id = jel.account_id WHERE je.company_id = $1 AND a.code = '3000' AND je.is_void = false` vs `accounts.balance` for the equity account. |

---

### 16. Trial Balance

| Field | Detail |
|---|---|
| **Canonical source** | `journal_entry_lines` → `journal_entries` (filter `company_id`, `entry_date` range, `is_void = false`, optional `branch_id`) → `SUM(debit)`, `SUM(credit)` per `account_id` |
| **Cached / derived** | None — Trial Balance has no cache. It is always computed on demand. |
| **GL representation** | The Trial Balance IS the GL. Every account in the COA with JE activity in the date range appears. |
| **Staleness risk** | Zero — computed live from JE lines every time. |
| **Branch filter behaviour** | JEs with `branch_id IS NULL` are always included (company-wide opening entries). Only JEs with a non-matching `branch_id` are excluded. |
| **Implementation guard** | `assertGlTruthQueryTable('accountingReportsService.getTrialBalance', 'journal_entry_lines')` is called at the top of the function. |
| **Reconciliation query** | `SELECT account_id, SUM(debit) AS total_dr, SUM(credit) AS total_cr FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.company_id = $1 AND je.is_void = false AND je.entry_date BETWEEN $2 AND $3 GROUP BY account_id` — the Trial Balance IS this query. |

---

### 17. Profit & Loss

| Field | Detail |
|---|---|
| **Canonical source** | Trial Balance (from `journal_entry_lines`) filtered to revenue and expense account types for a date range. Revenue = `SUM(credit) − SUM(debit)` on `type IN ('revenue','income')` accounts. Expenses = `SUM(debit) − SUM(credit)` on `type IN ('expense','cost of sales','cogs')` accounts. |
| **Cached / derived** | Dashboard `monthly_profit` — operational shortcut (`sales.total − purchases.total − expenses.amount`). Not GL. |
| **GL representation** | Revenue accounts (4xxx), Cost of Sales accounts (5000, 5010, 5100, 5110), Operating Expense accounts (5200, 5300, and other 5xxx). |
| **Cost of Sales vs Expense split** | `COST_OF_PRODUCTION_CODES = {5000, 5010, 5100, 5110}`. Codes 5200 and 5300 are operating expenses. Custom accounts with codes outside this set follow their `type`. |
| **Staleness risk** | P&L is computed live from JE lines. Zero staleness for the formal report. Dashboard operational shortcut has documented staleness. |
| **Reconciliation query** | GL P&L result should match `getTrialBalance` revenue rows (credit − debit) and expense rows (debit − credit). Any dashboard monthly_profit divergence from GL P&L netProfit is expected and documented. |

---

### 18. Payment Allocation Status

| Field | Detail |
|---|---|
| **Canonical source** | `payments` WHERE `reference_id = $documentId` AND `reference_type = $docType` AND `voided_at IS NULL` → `SUM(amount)` = total paid against document. Remaining = `document.total − SUM(payments.amount)`. |
| **Cached / derived** | `sales.due_amount` — updated on payment events; can be stale. `purchases.due_amount` — same. `sales.paid_amount` / `purchases.paid_amount` — same pattern. |
| **GL representation** | Payment JEs: Dr Cash/Bank (1000/1010) or Dr AP (2000), Cr AR (1100) for customer payments. Allocation clears AR/AP subledger. Reference type: `'payment'`. |
| **Staleness risk** | `sales.due_amount` and `purchases.due_amount` are updated synchronously on payment recording. If a payment is voided after the document balance was updated, the document `due_amount` may not be recalculated, causing staleness. **Medium risk.** |
| **Reconciliation query** | `SELECT s.id, s.total, s.due_amount AS cached_due, s.total - COALESCE(p.paid, 0) AS computed_due FROM sales s LEFT JOIN (SELECT reference_id, SUM(amount) AS paid FROM payments WHERE reference_type = 'sale' AND voided_at IS NULL GROUP BY reference_id) p ON p.reference_id = s.id WHERE s.company_id = $1 AND s.status = 'final' AND ABS(s.due_amount - (s.total - COALESCE(p.paid, 0))) > 0.01` |

---

## Summary: What NOT to Use as Source of Truth

The following fields and tables must NOT be used as the source of truth for financial figures. They are caches, operational snapshots, or legacy artifacts.

| Field / Table | Domain | Why Not Canonical | What to Use Instead |
|---|---|---|---|
| `contacts.current_balance` | AR / AP balance | Denormalized cache; diverges when JEs are posted manually or payment allocation fails | `journal_entry_lines` net on account 1100 (AR) or 2000 (AP) subledger for the contact |
| `accounts.balance` | All GL accounts | Opening balance seed only; not updated by journal activity | `journal_entry_lines` SUM (via `getAccountBalancesFromJournal` or Trial Balance) |
| `inventory_balance` table | Stock value / quantity | Batch-updated snapshot; can be hours or days stale | `stock_movements` SUM for quantity; `journal_entry_lines` net on account 1200 for value |
| `products.current_stock` | Stock quantity | Running balance maintained synchronously but can diverge on partial transaction failure | `SUM(stock_movements.quantity_change)` per product |
| `sales.due_amount` / `purchases.due_amount` | Payment allocation status | Updated on payment events but not always recalculated on void; used as dashboard shortcut | `SUM(payments.amount)` WHERE `reference_id = document.id` AND `voided_at IS NULL` |
| `sales.total` | Revenue | Operational invoice total; does not reflect GL account 4100 net credits; excludes manual revenue JEs | `journal_entry_lines` Cr on account 4100 for GL revenue |
| `expenses.amount` | Expense total | Document amount; GL posting may lag or fail | `journal_entry_lines` Dr on 5xxx accounts for `reference_type = 'expense'` |
| `purchases.total` | Purchase / COGS | Operational document total; GL posting may lag | `journal_entry_lines` Dr on 1200 / 5000-5010 for `reference_type = 'purchase'` |
| Roznamcha running balance | Cash position | Payments-only view; excludes direct cash JEs without a payments row | `journal_entry_lines` net Dr on account 1000 (Trial Balance) |
| `sales.commission_amount` | Commission liability | Operational capture; GL not updated until batch post | `journal_entry_lines` Dr on commission expense account for `reference_type = 'commission'` after batch post |
| `sale_items` table | Sale line items | Legacy table; canonical is `sales_items` | `sales_items` (fallback to `sale_items` only for backward compatibility) |
| Legacy subledger tables | Any GL balance | All deprecated; blocked by `LEGACY_TABLE_BLOCKLIST` in `accountingCanonicalGuard` | `journal_entry_lines` always |

---

## Quick Reference: Account Code to Domain Map

| Account Code | Account Name | Domain | Canonical Balance Formula |
|---|---|---|---|
| `1000` | Cash in Hand | Cash balance | `SUM(debit) − SUM(credit)` on JEL, all-time, `is_void = false` |
| `1010` | Bank Account | Bank balance | Same pattern, type = 'bank' |
| `102x` | Mobile Wallets | Wallet balance | Same pattern, code starts with 102 |
| `1100` | Accounts Receivable | AR / Customer balance | `SUM(debit) − SUM(credit)` on 1100 + all child accounts with parent_id = 1100.id |
| `1200` | Inventory / Stock | Inventory value | `SUM(debit) − SUM(credit)` on JEL, all-time |
| `1300` | Worker Advances | Worker advance balance | `SUM(debit) − SUM(credit)` on JEL |
| `2000` | Accounts Payable | AP / Supplier balance | `SUM(credit) − SUM(debit)` on 2000 + subledger children |
| `2010` | Worker Payable | Worker payable | `SUM(credit) − SUM(debit)` on JEL |
| `3000` | Opening Balance Equity | Equity | `SUM(credit) − SUM(debit)` on JEL |
| `4100` | Revenue / Sales | Revenue | `SUM(credit) − SUM(debit)` on JEL, date-filtered |
| `5000` | Cost of Goods Sold | COGS | `SUM(debit) − SUM(credit)` on JEL, date-filtered |
| `5010` | Purchase Cost | Purchase COGS | Same |
| `5100` | Production / Studio Cost | Studio cost | Same |
| `5110` | Shipping / Fulfillment | Fulfillment cost | Same |
| `5200` | Discount Allowed | Operating expense (not COGS) | `SUM(debit) − SUM(credit)` on JEL, date-filtered |
| `5300` | Extra Expense | Operating expense (not COGS) | Same |

---

## Enforcement Mechanisms

1. **`accountingCanonicalGuard.ts`** — defines `CANONICAL_GL_TABLES = ['journal_entries', 'journal_entry_lines', 'accounts']` and `LEGACY_TABLE_BLOCKLIST`. Calling `assertGlTruthQueryTable` in any GL-reading function documents and enforces intent.

2. **`warnIfUsingStoredBalanceAsTruth`** — called in `AccountingContext` to warn when `accounts.balance` is read as if it were a live GL balance.

3. **`accountingReportsService.getAccountBalancesFromJournal`** — the single canonical function for computing live account balances from JE lines. Used by dashboard cash/bank and reconciliation center.

4. **`effectivePartyLedgerService.loadEffectivePartyLedger`** — party ledger is built from `journal_entry_lines` only, collapsing PF-14 payment mutation chains. Does not use `contacts.current_balance`.

5. **Roznamcha `SOURCE LOCK` comment** — explicitly documents that `roznamchaService` uses `payments` table, not journal lines, and that this is by design.
