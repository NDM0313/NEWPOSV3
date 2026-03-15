# Roznamcha Policy Lock (Final)

This document defines the **locked** policy for what appears in Roznamcha (daily cash/payment book) and how it maps to the database. Do not change reporting behavior without updating this document and the code that implements it.

---

## 1. What Roznamcha Is

Roznamcha is the **payments-only** view of money movement: cash in/out, bank in/out, wallet in/out. It is **not** a full journal. It answers: “What money came in or went out today?”

---

## 2. Roznamcha SHOULD Include

All of the following represent **real money movement** and must appear in Roznamcha (via a row in the `payments` table):

| Type | reference_type (payments) | Description |
|------|---------------------------|-------------|
| Cash receipts | sale, payment, manual_receipt, etc. | Money received into Cash |
| Cash payments | purchase, expense, worker_payment, manual_payment, etc. | Money paid out from Cash |
| Bank receipts | (same, with payment_account = Bank) | Money received into Bank |
| Bank payments | (same) | Money paid out from Bank |
| Wallet receipts/payments | (same) | Mobile wallet in/out |
| Supplier payments | purchase, on_account | Payments to suppliers (document-linked or on-account) |
| Worker payments | worker_payment | Payments to workers |
| Expense payments | expense, extra_expense | Shop/office expense paid from Cash/Bank |
| Manual payment/receipt entries | manual_receipt, manual_payment | Manual entries where one side is a payment account (Cash/Bank/Wallet) |
| Sale receipts / on-account customer receipts | sale, payment (customer), on_account (customer) | Customer payments and on-account receipts |
| Rental payments | rental | Rental-related money in/out |
| Studio payments | studio_order | Studio order payments |

**Rule:** If a business event moves money into or out of a **payment account** (Cash, Bank, Mobile Wallet), there must be exactly one `payments` row and that row is shown in Roznamcha.

---

## 3. Roznamcha MUST NOT Include

The following must **not** appear in Roznamcha (no `payments` row; journal only):

| Type | Reason |
|------|--------|
| Pure journal adjustments | No payment account involved; both sides are non-payment (e.g. Dr AR, Cr Revenue) |
| Accrual-only / non-cash entries | Reclassifications, provisions, adjustments with no cash movement |
| Account-to-account transfers (non-payment) | e.g. Dr Expense A, Cr Expense B with no Cash/Bank/Wallet |
| Manual journal-only entries | Manual entry where **both** debit and credit are non–payment accounts |

**Rule:** If **no** side of the entry touches a payment account, there is no `payments` row and the entry does **not** appear in Roznamcha.

---

## 4. Mapping to Database

### 4.1 Source of truth: `payments` table

- Roznamcha **reads only from `payments`** (filtered by company, branch, date range).
- Each row in `payments` represents one money-movement event and appears as one line in Roznamcha.
- Columns used: `payment_date`, `amount`, `payment_type` (received/paid), `payment_method`, `reference_type`, `reference_number`, `payment_account_id`, etc.

### 4.2 Journal entries

- Every payment that creates money movement should have a **linked** journal entry (`journal_entries.payment_id` = that payment’s id).
- The journal entry records the double-entry (e.g. Dr AP, Cr Cash). Roznamcha does **not** read from `journal_entries` for its list; it reads from `payments`.
- Manual **payment/receipt** entries: one `payments` row + one journal entry with `payment_id` set.  
- Manual **journal-only** entries: one journal entry only; no `payments` row.

### 4.3 Manual entry classification

- **Payment/receipt (show in Roznamcha):** One side of the entry is a payment account (Cash/Bank/Mobile Wallet, by code 1000/1010/1020 or name/type).  
  → Create one `payments` row (`manual_receipt` or `manual_payment`) and one journal entry with `payment_id` set.
- **Journal-only (do not show in Roznamcha):** Both sides are non–payment accounts.  
  → Create one journal entry only; no `payments` row.

---

## 5. Implementation

- **Service:** `roznamchaService.ts` — `getRoznamcha()` (or equivalent) fetches from `payments` only (company, branch, date range). No filter by `reference_type` that would exclude valid payment types.
- **Labels:** `getTypeLabel(reference_type)` maps each `reference_type` to a display label (e.g. worker_payment → "Worker Payment", manual_receipt → "Manual Receipt", on_account → "On-Account Supplier Payment").
- **Day Book** continues to read from `journal_entries` + `journal_entry_lines` (all entries). Roznamcha and Day Book are different: Day Book = full journal; Roznamcha = payments only.

---

## 6. Change control

- Any change to what appears in Roznamcha (e.g. adding or removing a `reference_type`, or changing the rule for manual entries) must:
  1. Update this document.
  2. Update `roznamchaService` (and any report that aggregates “payment” data).
  3. Be tested against the company-scoped audit SQLs in `docs/audit/` (e.g. manual_entry_roznamcha_gap.sql, manual_entry_payment_account_classification.sql).

Document version: Phase 4 lock.  
Company scope: all; branch/date filters applied at query time.
