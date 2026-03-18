# Accounting Report Source Lock

**Purpose:** Define canonical and supporting sources for each accounting report. No report should read from legacy or conflicting tables without explicit justification.

**Company context:** `company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'` (reference; reports are company-scoped).

---

## 1. Journal (Journal Entries)

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | `journal_entries`, `journal_entry_lines` | Live double-entry journal. All posting flows write here. |
| **Supporting** | `accounts` | Account names, codes, type for lines. |
| **Do not use** | `ledger_entries`, `account_transactions`, `chart_accounts` | Different schemas; not the live journal. |

---

## 2. Day Book

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | Same as Journal: `journal_entries` + `journal_entry_lines` | Day Book is a view/filter of the journal (e.g. by date, branch). |
| **Supporting** | `accounts` | For line display. |
| **Do not use** | Any other table for “day book” rows. | |

---

## 3. Roznamcha

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | `payments` | Cash/bank in and out only. |
| **Supporting** | `accounts` (for payment_account_id name) | Display only. |
| **Do not use** | `journal_entries` alone for Roznamcha rows. | Journal-only entries (no payment row) do not appear in Roznamcha. |

**Why Roznamcha may miss some entries:** Roznamcha is **payments-only**. Manual journal entries, accruals, or any posting that does not create a row in `payments` will not appear. To show “all cash/bank movement,” either (1) keep Roznamcha as payments-only and document it, or (2) extend the report to also include journal lines for Cash/Bank accounts with a clear “source: journal” label.

---

## 4. Worker Ledger

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | `worker_ledger_entries` | Jobs and payments per worker. |
| **Supporting** | `workers` (current_balance), `studio_production_stages` | Stage cost, status. |
| **Do not use** | `worker_payments` (if present) for new logic. | Legacy candidate; mark and do not use for new posting. |

---

## 5. Studio Costs

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | `journal_entries` (reference_type = studio / worker_payment), `journal_entry_lines`, `worker_ledger_entries`, `studio_production_stages` | Studio cost = journal lines for studio refs + worker ledger. |
| **Supporting** | `studio_productions`, `sales` | For context. |
| **Do not use** | Only one of journal or worker_ledger in isolation. | “Payment side” is worker_payment journal lines and/or worker_ledger_entries (accounting_payment); include both for full picture. |

---

## 6. Courier Payables

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | `journal_entries` (reference_type = shipment / courier_payment), `journal_entry_lines`, `accounts` (2030 control, 2031+ per courier) | |
| **Supporting** | `sale_shipments`, `get_or_create_courier_payable_account` | |
| **Do not use** | Views (`courier_ledger`, `courier_summary`, `shipment_ledger`) as sole source of truth without confirming they read from the canonical tables above. | |

---

## 7. Receivables

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | `sales` (due_amount, paid_amount), `payments` (reference_type = sale / on_account), customer ledger RPCs if in use | |
| **Supporting** | `contacts` | |
| **Do not use** | Conflicting definitions of “receivable” from other schemas. | |

---

## 8. Payables

| Role | Source | Notes |
|------|--------|-------|
| **Canonical** | Purchases: `purchases` (due_amount), `payments` (reference_type = purchase). Worker: `worker_ledger_entries`. Courier: `accounts` (203x). | |
| **Supporting** | As needed per type. | |
| **Do not use** | `ledger_master` / `ledger_entries` for customer or worker payables. | Those are for supplier/user ledger UI only. |

---

## Summary

- **Journal / Day Book** → `journal_entries` + `journal_entry_lines` + `accounts`.
- **Roznamcha** → `payments` only (journal-only entries excluded by design unless report is extended).
- **Worker Ledger** → `worker_ledger_entries`.
- **Studio Costs** → journal (studio + worker_payment) + worker_ledger_entries + studio_production_stages.
- **Courier Payables** → journal + journal_entry_lines + accounts (2030/203x).
- **Receivables / Payables** → as in table above; avoid mixing with ledger_master/ledger_entries for customer/worker.
