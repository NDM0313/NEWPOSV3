# ERP Customer Ledger — Verification

**Date:** 2026-03-13

## Test cases (post-fix)

Use these to confirm ledger behavior for all contact/transaction shapes.

### Case A — Customer with sale only

- **Setup:** Contact (customer or both) with at least one final sale; no payments.
- **Verify:**
  - Summary: opening balance (if fromDate), total debit = invoice total, total credit = 0, closing balance = total debit (or opening + debit).
  - Transaction table: one (or more) sale row(s); debit = sale total, credit = 0.
  - No payment rows.
- **Result:** _Pass / Fail (note any discrepancy)_

---

### Case B — Customer with sale + sale-linked payment

- **Setup:** Contact with at least one final sale and at least one payment with `reference_type = 'sale'`, `reference_id = sale.id`.
- **Verify:**
  - Summary: total debit = invoice total(s), total credit includes payment amount(s), closing balance = debit − credit (with opening if applicable).
  - Transaction table: sale row(s) (debit) and payment row(s) (credit).
  - Payments tab (if used): lists those payments with correct applied invoice.
- **Result:** _Pass / Fail_

---

### Case C — Customer with on-account payment only

- **Setup:** Contact with **no** sales, at least one payment with `reference_type = 'on_account'`, `contact_id = contact.id`.
- **Verify:**
  - Summary: total credit includes on-account amount(s); closing balance negative (credit balance) or zero if only on-account.
  - Transaction table: at least one row with document type “On-account Payment” or “Payment”, credit = amount.
  - Ledger no longer empty for this contact.
- **Result:** _Pass / Fail_

---

### Case D — Contact type = both with mixed records

- **Setup:** Contact with `type = 'both'`; has both sales (as customer) and optionally on-account payments.
- **Verify:**
  - Sales appear (debit).
  - Sale-linked payments appear (credit).
  - On-account payments appear (credit) with correct description/type.
  - Summary totals and running balance match transaction list.
- **Result:** _Pass / Fail_

---

### Case E — Customer with opening balance but no transactions in range

- **Setup:** Contact with sales and/or payments **before** the selected fromDate; no (or minimal) transactions in [fromDate, toDate].
- **Verify:**
  - Opening balance row shows non-zero value when fromDate is set.
  - Opening balance reflects prior sales minus prior payments (including **prior on-account** payments).
  - If only on-account before fromDate: opening shows as negative (credit balance).
- **Result:** _Pass / Fail_

---

## Aging (if applicable)

- For contacts with `due_amount` on sales: aging report / buckets should still load without error.
- No change was made to aging logic; confirm no regression.

---

## Debit / credit / balance

- Each row: either debit > 0 or credit > 0, not both.
- Running balance: starts from opening (when fromDate set), then increases by debit and decreases by credit in date order.
- Final running balance = closing balance and should match summary closing balance.

---

## Quick checklist

| Case | Summary cards | All transactions list | Debit / credit / balance | Aging |
|------|----------------|------------------------|---------------------------|-------|
| A – Sale only | ☐ | ☐ | ☐ | ☐ |
| B – Sale + payment | ☐ | ☐ | ☐ | ☐ |
| C – On-account only | ☐ | ☐ | ☐ | ☐ |
| D – Type both, mixed | ☐ | ☐ | ☐ | ☐ |
| E – Opening, no tx in range | ☐ | ☐ | ☐ | ☐ |

Fill in after running tests; note any failure and environment (e.g. branch, date range).
