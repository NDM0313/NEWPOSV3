# ERP Customer Ledger — Query Unification

**Date:** 2026-03-13

## Goal

Make customer ledger logic consistent so that every valid customer/both contact gets:

- Opening balance (including on-account payments before fromDate)
- Sales / receivables
- Sale-linked payments
- **On-account payments**
- Sale returns / return payments
- Rentals (where applicable)

Using one canonical contact filter and the same treatment for summary and detail.

## Changes made

### 1. Canonical contact filter

- **Sales:** `company_id` + `customer_id` (contact id) — unchanged. RPC `get_customer_ledger_sales` and direct `sales` queries use this. Contact type is not filtered; type `both` is valid as customer.
- **Sale-linked payments:** `company_id` + `reference_type = 'sale'` + `reference_id` in sale IDs — unchanged.
- **On-account payments:** `company_id` + `contact_id = customerId` + `reference_type = 'on_account'`. This is the new canonical path for “payments for this customer not tied to a sale.”

### 2. accountingService.getCustomerLedger

- After loading sale-linked payments via RPC `get_customer_ledger_payments(sale_ids)`:
  - Query `payments` where `company_id`, `contact_id = customerId`, `reference_type = 'on_account'`.
  - Apply same date filter (startDate/endDate) as the rest of the ledger.
  - Merge into `customerPayments` (no duplicates by payment id).
- Downstream logic (journal filter, synthetic/merge) already uses `customerPayments` and `paymentIds`/`paymentDetailsMap`, so on-account payments now appear as credit entries and in merge/synthetic.

**Files changed:** `src/app/services/accountingService.ts`

### 3. customerLedgerApi.getTransactions

- Sale-linked payments: still from RPC when `saleIds.length > 0`; fallback direct query when RPC fails but sales exist.
- **On-account:** Direct query `payments` where `company_id`, `contact_id = cId`, `reference_type = 'on_account'`, date filter; append to `payments` (dedupe by id).
- When there are **no sales** (`saleIds.length === 0`), only on-account payments are fetched (no RPC call with empty array).
- Running balance: when `fromDate` is set, opening balance now subtracts **on-account payments before fromDate** (`prevOnAccountPmts`).
- Transaction list: on-account rows use `documentType: 'On-account Payment'` and description “On-account payment via …”.

**Files changed:** `src/app/services/customerLedgerApi.ts`, `src/app/services/customerLedgerTypes.ts` (added `'On-account Payment'` to documentType union).

### 4. customerLedgerApi.getLedgerSummary

- **Opening balance:** Before fromDate, subtract on-account payment total (`prevOnAccountTotal`) from the opening balance (they are credit to customer).
- **Total credit in range:** Add `onAccountCreditInRange` (sum of on-account payments in [fromDate, toDate]) to `totalCredit`.
- So summary and transaction list both include the same on-account amounts.

**Files changed:** `src/app/services/customerLedgerApi.ts`

### 5. customerLedgerApi.getPayments

- Returns both sale-linked and on-account payments.
- Sale-linked: same as before (payments with `reference_type = 'sale'`, `reference_id` in customer’s sale ids).
- On-account: query `payments` where `company_id`, `contact_id = customerId`, `reference_type = 'on_account'`, date filter; append to result with `appliedInvoices: []`.
- Combined list sorted by date descending.

**Files changed:** `src/app/services/customerLedgerApi.ts`

### 6. No studio_orders / no dropped tables

- No references to `studio_orders` or any dropped table. Studio logic uses `sales` and `studio_productions` / `studio_production_stages` only.

### 7. Sort order

- Ledger entries and transactions remain sorted by date (and time where needed). On-account payments use `payment_date` and are merged into the same sort.

## Summary vs detail logic

- **CustomerLedgerPage (production):** Single source `accountingService.getCustomerLedger()`; summary cards are derived from the same entries. On-account is now part of that single source.
- **CustomerLedgerPageOriginal / LedgerHub:** Summary from `getLedgerSummary`, detail from `getTransactions` (and tabs). Both now include on-account in opening balance, total credit, and transaction list, so summary and detail stay aligned.

## Contact type = both

- Sales RPC and direct queries filter by `customer_id` only, not by contact type. Contacts with type `both` used as `customer_id` on sales are included. On-account uses `contact_id`, so type `both` is also included for on-account payments. No change required for “both” beyond including on-account.

## Rollback

- **accountingService.ts:** Remove the block that queries `payments` for `reference_type = 'on_account'` and `contact_id = customerId` and merges into `customerPayments`.
- **customerLedgerApi.ts:**  
  - getTransactions: remove on-account query and merge; remove `prevOnAccountPmts` from running balance; revert payment fallback to the previous “empty reference_id” when no sales.  
  - getLedgerSummary: remove `prevOnAccountTotal` and `onAccountCreditInRange` and their queries; revert `totalCredit` and `openingBalance` to previous formulas.  
  - getPayments: revert to only sale-linked payments (and “return []” when no sales).
- **customerLedgerTypes.ts:** Remove `'On-account Payment'` from the documentType union.
