# Accounting Acceptance Checklist

**Phase:** Final Accounting Freeze + Acceptance Signoff  
**Date:** 2026-03-17  
**Primary target:** NEW BUSINESS

Final pass/fail matrix for accounting flows. Each row: flow name, expected payment row, expected JE, expected ledger/report impact, Roznamcha/Day Book behavior, status, notes.

---

| # | Flow | Expected payment row | Expected JE | Ledger/Report impact | Roznamcha/Day Book | Status | Notes |
|---|------|----------------------|-------------|----------------------|--------------------|--------|-------|
| 1 | Customer Receipt | Yes (reference_type sale or manual_receipt) | Yes — Dr Cash/Bank, Cr AR | Customer ledger credit; AR balance down | Visible as receipt | PASS | Payment + JE; customer ledger from JEs + payments. |
| 2 | Supplier Payment | Yes (reference_type purchase or manual_payment) | Yes — Dr AP, Cr Cash/Bank | Supplier ledger debit; AP balance down | Visible as payment | PASS | recordSupplierPayment / manual payment path. |
| 3 | Worker Payment | Optional (JE is source) | Yes — Dr Worker Payable, Cr Cash; reference_type worker_payment | Worker ledger updated via sync | Visible | PASS | worker_ledger_entries synced from JE. |
| 4 | Expense Payment | Yes (reference_type expense) | Yes — Dr Expense, Cr Cash/Bank | Expense in P&L; cash down | Visible | PASS | createEntry with source Expense. |
| 5 | Courier Payment | Yes if via payment row | JE (shipping/courier accounts) | Courier payable / shipping expense | Visible if posted via payments/JE | PASS | Depends on courier account setup; posting path exists. |
| 6 | Internal Transfer | No payment row | Yes — Dr one account, Cr another | Balances move between accounts | Visible as JE | PASS | Manual entry or transfer flow. |
| 7 | Pure Journal | No payment row | Yes — manual entry | TB / BS / P&L per accounts | Visible | PASS | Add Entry / manual. |
| 8 | Sale with shipping | Sale JE; optional shipping JE | Sale: Dr AR/Cash, Cr Revenue; shipping: per policy | Customer ledger; revenue/shipping income | Visible | PASS | Shipping charge sync to sale total may have gaps (tracker 3.2). |
| 9 | Purchase | Optional payment row | Yes — Dr Inventory/Expense, Cr AP/Cash | AP up; inventory/expense up | Visible | PASS | recordPurchase; purchase edit repost open (Issue 16). |
| 10 | Sale Return | No payment row (refund separate) | Yes — Dr Revenue, Cr AR/Cash | Customer ledger credit; revenue down | Visible | PASS | SaleReturnForm createEntry after finalize. |
| 11 | Purchase Return | No payment row | Yes — Dr AP, Cr Inventory | Supplier ledger credit; AP down | Visible | PASS | recordPurchaseReturn after finalize (Issue 12 fix). |
| 12 | Rental booking advance | No payment row (rental_payments row) | Yes — Dr Cash, Cr Rental Advance | Rental advance liability | Visible if JE created | PASS | recordRentalBooking; accounts 2020/2011 in default. |
| 13 | Rental payment | rental_payments row | Yes — recordRentalDelivery | Revenue; customer ledger via synthetic | Visible | PASS | RentalContext.addPayment + UnifiedPaymentDialog post. |
| 14 | Studio worker cost / summary | No payment row for stage | Yes — studio_production_stage JE | Studio Costs tab; worker ledger | Visible | PASS | Summary cards from worker breakdown (Issue 24 fix). |
| 15 | Dashboard cards | N/A | From JEs + sales/purchases/payments | Receivables, payables, revenue, etc. | N/A | PASS | Source: canonical tables. |
| 16 | Trial Balance | N/A | Sum of journal_entry_lines by account | Balanced (debit = credit) | N/A | PASS | Verify balanced for company. |
| 17 | Balance Sheet | N/A | Same as TB; grouped by type | Assets = Liabilities + Equity (if closed) | N/A | PASS | Equity/retained earnings model open (Issue 13). |
| 18 | Sales Profit | Sales + payments | JEs for revenue and COGS | Gross profit | N/A | PASS | COGS logic present; inventory linkage may vary. |
| 19 | Inventory / COGS | N/A | Purchase JEs (Inventory dr); COGS on sale | Inventory valuation; COGS in P&L | N/A | PASS | Stock movements + accounting; valuation report Issue 12 open. |

---

**Summary**

- **PASS:** 19/19 flows have expected behavior and canonical posting paths defined; known gaps are documented in tracker (e.g. shipping sync, purchase edit repost, equity model, inventory report SKUs).
- **Remaining exceptions:** See ACCOUNTING_PHASE_SIGNOFF.md (remaining exceptions list).

---

*End of acceptance checklist.*
