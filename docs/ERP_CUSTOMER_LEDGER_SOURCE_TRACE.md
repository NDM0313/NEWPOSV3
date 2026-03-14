# ERP Customer Ledger — Data Source Trace

**Date:** 2026-03-13

## End-to-end flow

### 1. Entry points

| Entry point | Data source used | Notes |
|-------------|------------------|--------|
| **CustomerLedgerPage** (Contacts → View Ledger) | `accountingService.getCustomerLedger()` only | Single source: journal + RPC sales/payments + synthetic merge. |
| **LedgerHub** / **CustomerLedgerPageOriginal** | `customerLedgerAPI.getCustomers()`, then `getLedgerSummary()`, `getTransactions()`, `getInvoices()`, `getPayments()`, `getAgingReport()` | Multiple API calls; summary and transactions can diverge from main ledger. |
| **CustomerLedgerTestPage** | Same as LedgerHub: customerLedgerAPI for list/summary/transactions/invoices/payments/aging | Test page. |

### 2. accountingService.getCustomerLedger (main production ledger)

**Used by:** CustomerLedgerPage (the one opened from Contacts).

**Sources (in order):**

1. **AR accounts**  
   - `accounts` where `company_id` and `code` in (2000, 1100) or name ilike '%Accounts Receivable%'.

2. **Journal entry lines**  
   - `journal_entry_lines` joined to `journal_entries`, filtered by `account_id` in AR account IDs, ordered by `created_at`.

3. **Sales (RPC)**  
   - `get_customer_ledger_sales(p_company_id, p_customer_id, p_from_date, p_to_date)`  
   - Returns sales where `company_id`, `customer_id` match and `status = 'final'` (if migration applied).  
   - **Contact type:** Not filtered by contact type; any row with `customer_id = p_customer_id` is included (so type `both` works as customer).

4. **Payments (RPC)**  
   - `get_customer_ledger_payments(p_company_id, p_sale_ids, p_from_date, p_to_date)`  
   - Returns only payments where `reference_type = 'sale'` and `reference_id = ANY(p_sale_ids)`.  
   - **Gap:** Payments with `reference_type = 'on_account'` and `contact_id = customerId` are **not** returned (they are not linked to a sale ID).

5. **Rentals (RPC)**  
   - `get_customer_ledger_rentals(p_company_id, p_customer_id, null, null)`  
   - Rental charges and payments added via synthetic entries.

6. **Opening balance**  
   - From journal: sum of (debit − credit) for AR lines before `startDate`.  
   - When using synthetic-only path: derived from previous sales/returns/rentals before fromDate (no on-account in that calc).

7. **Synthetic / merge**  
   - If no journal entries: ledger built from RPC sales + RPC payments + rentals.  
   - If journal exists: journal entries plus any sales/payments/rentals not already in journal are merged.  
   - **On-account payments:** Not in RPC result, so never appear in synthetic or merge.

### 3. customerLedgerApi

**getCustomers(companyId)**  
- `contacts` where `company_id` and `type` in `['customer', 'both']`.  
- Outstanding balance from `sales.due_amount` (final, due_amount > 0) and `rentals.due_amount`.  
- Does **not** include on-account payments (prepayment/credit).

**getLedgerSummary(customerId, companyId, fromDate?, toDate?)**  
- **Sales:** RPC `get_customer_ledger_sales` (fallback: direct `sales` query).  
- **Payments:** Not called directly; summary uses `invoices.reduce(..., paid_amount)` from sales.  
- **Opening balance:** From previous sales (RPC) before fromDate, minus previous paid, minus returns, plus rentals; **on-account payments** not included.  
- **Returns in range:** `sale_returns` + return payments.  
- **Rentals:** RPC `get_customer_ledger_rentals`.  
- **Gap:** On-account payments are not fetched or included in total credit / closing balance.

**getTransactions(customerId, companyId, fromDate?, toDate?)**  
- **Sales:** RPC `get_customer_ledger_sales`.  
- **Payments:** RPC `get_customer_ledger_payments(p_sale_ids)` only — i.e. sale-linked only.  
- **Sale returns / return payments:** Direct queries.  
- **Rentals / rental payments:** RPC + direct.  
- **Gap:** On-account payments for the contact are never fetched, so they do not appear as credit transactions.

**getInvoices / getPayments**  
- Invoices: direct `sales` by `customer_id`, `status = 'final'`.  
- Payments: only payments with `reference_type = 'sale'` and `reference_id` in customer’s sale IDs.  
- **Gap:** On-account payments (different `reference_type` and no `reference_id`) are excluded.

### 4. Summary vs transaction table — same or different?

| Context | Summary | Transaction table | Same logic? |
|--------|---------|-------------------|-------------|
| **CustomerLedgerPage** | Derived from **same** `accountingService.getCustomerLedger()` result (totals from `filteredEntries`). | Same entries. | Yes. |
| **CustomerLedgerPageOriginal / LedgerHub** | `customerLedgerAPI.getLedgerSummary()` (sales RPC + invoice paid_amount + returns + rentals; no on-account). | `customerLedgerAPI.getTransactions()` (sales RPC + payments RPC + returns + rentals; no on-account). | Partially: both use same sales/returns/rentals, but summary does not use the same “payments” set as transactions (summary uses `paid_amount` on sales; transactions use RPC payments). On-account missing in both. |

**Conclusion:**  
- Main production page (CustomerLedgerPage): single source, summary and table aligned; but **on-account payments are missing** from the only source (getCustomerLedger).  
- Legacy/test pages: summary and transactions both miss on-account; logic differs (summary from sales.paid_amount, transactions from RPC payments).

## Data sources summary

| Item | Source | On-account included? |
|------|--------|----------------------|
| Opening balance | Journal (AR lines before fromDate) or synthetic prev sales − paid − returns + rentals | No |
| Sales / invoices | RPC `get_customer_ledger_sales` (or direct sales) | N/A |
| Sale-linked payments | RPC `get_customer_ledger_payments(sale_ids)` | No (only sale-linked) |
| On-account payments | — | **No** (not queried anywhere) |
| Sale returns | Direct `sale_returns` + return payments | Yes |
| Rentals | RPC `get_customer_ledger_rentals` + `rental_payments` | Yes |

## Root cause for “some contacts work, some don’t”

- **Contacts that work:** Have at least one **sale**; sale-linked payments are returned by RPC; ledger shows sales + those payments.  
- **Contacts that don’t:**  
  - Have **only on-account payments** (no sales) → `p_sale_ids` is empty → RPC returns no payments → ledger shows no transactions or wrong balance.  
  - Or have sales in a branch that is filtered out in journal path while synthetic path still uses RPC (so sales show) but payments are still only sale-linked; if most of their activity is on-account, ledger looks wrong.

Unifying ledger logic requires including **on-account payments** (same contact filter: `contact_id = customerId`, `reference_type = 'on_account'`) in both accountingService and customerLedgerAPI, and using one canonical contact filter (customer_id for sales, contact_id for on-account).
