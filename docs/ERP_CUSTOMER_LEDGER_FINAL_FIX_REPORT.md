# ERP Customer Ledger — Final Fix Report

**Date:** 2026-03-13

## Root cause

Customer ledger worked for some contacts and not others because **on-account payments** were never included in ledger data.

- **Sales** are loaded by `customer_id` (RPC and direct queries). Contact type `both` is valid; no filter on type.
- **Payments** were loaded only via `get_customer_ledger_payments(company_id, sale_ids, ...)`, which returns only rows where `reference_type = 'sale'` and `reference_id = ANY(sale_ids)`.
- **On-account payments** are stored with `reference_type = 'on_account'`, `reference_id` NULL, and `contact_id = customerId`. They were never queried, so:
  - Contacts with **only** on-account payments saw an empty or wrong ledger.
  - Contacts with both sale-linked and on-account payments were missing the on-account credits, so balances were wrong.

So the bug was **missing on-account payment fetch** using the same contact identity (`contact_id`), not contact type or company/branch.

## Exact files changed

| File | Change |
|------|--------|
| `src/app/services/accountingService.ts` | After RPC sale-linked payments, query `payments` for `company_id`, `contact_id = customerId`, `reference_type = 'on_account'` with date filter; merge into `customerPayments` (dedupe by id). |
| `src/app/services/customerLedgerApi.ts` | **getTransactions:** Fetch on-account payments for contact, merge into `payments`; add `prevOnAccountPmts` to opening/running balance when fromDate set; label on-account rows as “On-account Payment”. **getLedgerSummary:** Add `prevOnAccountTotal` (before fromDate) and `onAccountCreditInRange` (in range); include in opening balance and totalCredit. **getPayments:** Include on-account payments for contact with `appliedInvoices: []`; return combined list when no sales. |
| `src/app/services/customerLedgerTypes.ts` | Add `'On-account Payment'` to `Transaction.documentType` union. |

No migrations, no table drops, no renames. No changes to purchase double stock, on-account payment recording, ledger studio_orders fix, or shipping fix.

## Contact types affected

- **Previously failing:** Contacts that had **on-account payments** and no (or few) sales — e.g. prepayment-only customers, or contacts with mixed sale-linked and on-account payments. Type `customer` or `both` both affected.
- **Previously working:** Contacts with only sales and sale-linked payments; they had no on-account data to miss.
- **Now:** All valid customer/both contacts get sale-linked **and** on-account payments in ledger and summary.

## On-account payments

- **Before:** Not fetched; not in ledger, summary, or getPayments. Ledger could be empty or understated (missing credits).
- **After:** Fetched in accountingService and customerLedgerApi (getTransactions, getLedgerSummary, getPayments); included in total credit, opening balance (as credit before fromDate), and transaction list with document type “On-account Payment”.

## Summary and detail logic

- **Unified:** Both summary (getLedgerSummary) and detail (getTransactions) now use the same on-account logic: same filter (`contact_id`, `reference_type = 'on_account'`), same date range, and on-account included in opening balance and total credit. CustomerLedgerPage (production) uses accountingService only; its summary cards are derived from the same getCustomerLedger result, which now includes on-account.

## Verification results (test cases)

| Case | Description | Expected | Result (fill when run) |
|------|--------------|----------|------------------------|
| A | Customer with sale only | Sales in ledger; no payments | _Pass / Fail_ |
| B | Customer with sale + sale-linked payment | Sales and payments; balance correct | _Pass / Fail_ |
| C | Customer with on-account only | On-account payment(s) visible; ledger not empty | _Pass / Fail_ |
| D | Type = both, mixed records | Sales + sale-linked + on-account all show | _Pass / Fail_ |
| E | Opening balance, no tx in range | Opening includes prior on-account as credit | _Pass / Fail_ |

See `docs/ERP_CUSTOMER_LEDGER_VERIFICATION.md` for step-by-step checks.

## Rollback notes

1. **accountingService.ts:** Remove the block that queries `payments` for `reference_type = 'on_account'` and `contact_id = customerId` and merges into `customerPayments`.
2. **customerLedgerApi.ts:** In getTransactions remove on-account fetch/merge and `prevOnAccountPmts`; in getLedgerSummary remove `prevOnAccountTotal` and `onAccountCreditInRange` and their queries; in getPayments revert to sale-linked only and “return []” when no sales.
3. **customerLedgerTypes.ts:** Remove `'On-account Payment'` from the documentType union.

Re-run migrations is not required; no DB schema changes were made.

## Deliverables

- `docs/ERP_CUSTOMER_LEDGER_SOURCE_TRACE.md` — data source trace and summary vs detail.
- `docs/ERP_CUSTOMER_LEDGER_FAILING_CASES.md` — why some contacts failed (on-account missing, etc.).
- `docs/ERP_CUSTOMER_LEDGER_QUERY_UNIFICATION.md` — canonical filters, changes per file, rollback.
- `docs/ERP_CUSTOMER_LEDGER_VERIFICATION.md` — test cases A–E and checklist.
- `docs/ERP_CUSTOMER_LEDGER_FINAL_FIX_REPORT.md` — this report.
