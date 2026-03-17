# Accounting Freeze Document

**Phase:** Final Accounting Freeze + Acceptance Signoff  
**Date:** 2026-03-17  
**Project:** NEWPOSV3 / ERP Master  
**Primary target:** NEW BUSINESS (`c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee`)  
**Reference:** OLD BUSINESS (`eb71d817-b87e-4195-964b-7b5321b480f5`)

This document defines the **frozen** accounting data model and report sources. No new posting paths or report sources should be added without updating this freeze.

---

## 1. Canonical tables

| Table | Purpose | Used for posting? |
|-------|---------|--------------------|
| **accounts** | Chart of accounts (company-scoped). Code + name + type. | Yes — all JEs reference `accounts.id` via `journal_entry_lines.account_id`. |
| **journal_entries** | Header for each double-entry transaction. `entry_no`, `entry_date`, `reference_type`, `reference_id`, `branch_id`. | Yes — primary accounting record. |
| **journal_entry_lines** | Debit/credit lines per account. Links to `journal_entries.id` and `accounts.id`. | Yes — balances derived from sum of lines. |
| **payments** | Payment/receipt records (customer receipt, supplier payment, expense payment, manual receipt/payment). Links to JEs via `payment_id` where applicable. | Yes — Roznamcha/Day Book and ledger matching use this. |
| **ledger_master** | Sub-ledger header per entity (supplier, user). Used by `ledgerService` for supplier/user ledgers. | Yes — supplier ledger balance source. |
| **ledger_entries** | Sub-ledger lines (debit/credit per ledger_master). | Yes — supplier/user ledger detail. |
| **worker_ledger_entries** | Worker-wise ledger for studio (stage cost, payment). `reference_type` = 'studio_production_stage', etc. | Yes — studio worker payable and Studio Costs tab. |
| **document_sequences** | Per-company/branch document numbering (sale, purchase, payment, rental, etc.). | Yes — `entry_no` and document numbers. |

**Note:** `chart_accounts` exists in some migrations but is **not** the canonical COA; `accounts` is. Do not use `chart_accounts` for new posting.

---

## 2. Canonical report sources

| Report | Primary source | Notes |
|--------|----------------|--------|
| **Trial Balance** | `journal_entry_lines` joined to `journal_entries` + `accounts`, grouped by account, sum(debit - credit). | Company + optional branch + date filter. |
| **Balance Sheet** | Same as Trial Balance; accounts grouped by type (asset, liability, equity). Revenue/expense for P&L. | |
| **Dashboard** | RPC or services aggregating sales, receivables, payables, expenses from JEs/payments/sales/purchases. | Must use canonical tables. |
| **Sales Profit** | Sales (invoices) minus COGS; payments and JEs for cash/receivable. | Sale totals from `sales`; payments from `payments` / JEs. |
| **Studio Costs** | `studioCostsService`: JEs with `reference_type` in ('studio_production_stage', 'studio_production_stage_reversal', 'payment', 'manual'); worker breakdown from `worker_ledger_entries` + stages. | Summary cards now derived from worker breakdown (Issue 24 fix). |
| **Rental summaries** | `rentals` + `rental_payments`; JEs with `reference_type` = 'rental' for advance/delivery/return. | Customer ledger rental lines from synthetic merge (rentals + rental_payments). |
| **Supplier ledger** | `ledger_entries` + `ledger_master` (ledger_type = 'supplier'); payments with `reference_type` = 'purchase' / manual_payment. | |
| **Customer ledger** | `accountingService.getCustomerLedger`: JEs (sale, payment, rental) + synthetic rental/sale/payment merge. | Rental JEs excluded from journal path; rentals added as synthetic. |
| **Worker ledger** | `worker_ledger_entries` + studio JEs (worker_payment, studio_production_stage). | |

---

## 3. Canonical payment / reference types in active use

**journal_entries.reference_type (active):**

- `shipment` — customer shipping charge / courier expense (Dr AR or Dr Shipping Expense, Cr Shipping Income or Cr Courier Payable)
- `courier_payment` — pay courier (Dr Courier Payable 2031/2032…, Cr Cash/Bank)
- `sale` — sale finalized (Dr AR / Cash, Cr Revenue)
- `purchase` — purchase posted (Dr Inventory/Expense, Cr AP / Cash)
- `payment` — customer/supplier payment (linked to payments row where applicable)
- `rental` — rental advance, delivery, return
- `sale return` — sale return reversal (Dr Revenue, Cr AR/Cash)
- `purchase return` — purchase return reversal (Dr AP, Cr Inventory)
- `worker_payment` — worker payable payment (Dr Worker Payable, Cr Cash)
- `expense` — expense payment (Dr Expense, Cr Cash)
- `manual` — manual journal (Add Entry)
- `manual_receipt` — Add Entry V2 customer receipt
- `manual_payment` — Add Entry V2 supplier payment
- `studio_production_stage` / `studio_production_stage_reversal` — studio stage cost posting

**payments.reference_type (active):**

- `sale` — customer payment against sale
- `purchase` — supplier payment
- `expense` — expense payment
- `manual_receipt` / `manual_payment` — manual entry V2

---

## 4. Legacy / frozen objects not to use for new posting

- **chart_accounts** — Do not use for new posting; use `accounts` only.
- Any **account_transactions** or **chart_accounts**-based reports — Treat as legacy; reports must use `journal_entries` + `journal_entry_lines` + `accounts`.
- **Duplicate or deprecated RPCs** that write to non-canonical tables — Do not add new callers.

---

## 5. Business-scoped verification target

- **NEW BUSINESS** = primary. All verification and signoff criteria are evaluated for this company first. Expected: clean zero state where no transactions exist; correct behavior when flows are used.
- **OLD BUSINESS** = reference. Used to confirm historical data and that reports/TB/balance sheet still function; may have legacy data or one-off limitations documented in signoff.

---

*End of freeze document.*
