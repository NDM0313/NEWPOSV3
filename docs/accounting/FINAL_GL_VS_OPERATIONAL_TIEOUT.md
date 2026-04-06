# Final GL vs operational tie-out

This document fixes naming: **two legitimate “truths”** exist and must not be compared without stating the basis.

## Canonical GL (journal)

- **Source:** `journal_entries` + `journal_entry_lines` + `accounts`, filtered by date range and branch, excluding void entries.
- **Reports:** Trial Balance, Profit & Loss, Balance Sheet, Account Ledger — implemented in `accountingReportsService` (web).
- **Control accounts:** e.g. AR **1100**, AP **2000**, Inventory **1200**, Worker Payable **2010** — net position from posted journals in range.

When TB is balanced and P&L/BS are internally consistent, **do not “fix” GL** without audit SQL proving a bug.

## Operational (documents + party RPC)

- **Contacts / dashboard AR & AP (operational):** `get_contact_balances_summary(company_id, branch_id)` — per-contact receivables/payables from sales/purchases/worker ledger rules (see migration defining the function).
- **Sales “Total Due”:** Final-status sales only; effective due = `(total + studio charges) − paid` on the Sales page — **not** the same query as Contacts.
- **Purchases “Amount Due”:** Supplier PO document balances — compare to **supplier-only** operational payables vs AP **2000**, not mixed worker payables.
- **Party GL (signed):** `get_contact_party_gl_balances` — per-contact GL on 1100 / 2000 / 2010 / 1180 for reconciliation strips.

## Residuals (expected)

- **AR/AP control vs party sum:** Differences can come from unmapped control lines, manual journals, opening entries, legacy `reference_type` buckets — trace with `get_control_unmapped_party_gl_buckets(company_id, branch_id, '1100'|'2000'|'2010')`.
- **Worker:** Operational worker payables from `get_contact_balances_summary` and unpaid `worker_ledger_entries` are **not** the same basis as full GL **2010** net for all payroll/studio postings — label separately (see worker report).

## Audit pack

Run `sql/final_accounting_stabilization_audit.sql` in Supabase SQL Editor (set `company_id`, `branch_id`, and journal `period_start` / `period_end`).
