# Canonical table classification — accounting-relevant objects

**A** = canonical_live **B** = operational_support **C** = legacy_archive **D** = delete_candidate_later  

---

## A — canonical_live (financial truth & COA)

| Table | Role |
|-------|------|
| `accounts` | Live chart of accounts; FK target for `journal_entry_lines.account_id`. Row `balance`/`current_balance` = **cache only**. |
| `journal_entries` | GL header |
| `journal_entry_lines` | GL lines — **only** source for posted amounts |
| `payments` | Roznamcha / cash trail; links to JE via `payment_id` |
| `companies`, `branches` | Scope |

---

## B — operational_support (documents & subledgers; not GL)

| Table | Role |
|-------|------|
| `sales`, `sales_items` / `sale_items` | Invoice open amounts, revenue docs |
| `purchases` | AP open amounts |
| `rentals` | Rental dues |
| `contacts` | Party master; **stored balances = cache only** |
| `workers` | Worker master; **`current_balance` = cache** |
| `worker_ledger_entries` | Studio / worker **operational** bill & pay tracking |
| `ledger_master` | Supplier/user **UI** ledger header |
| `ledger_entries` | Supplier/user **UI** ledger lines (not journal) |
| `erp_document_sequences`, numbering tables | Document numbers |

---

## C — legacy_archive (must not drive live GL UI)

| Table | Notes |
|-------|-------|
| `chart_accounts` | Legacy COA shape; app posts to `accounts` |
| `account_transactions` | Hung off `chart_accounts`; unused in app paths |
| `backup_cr_*`, `backup_pf145_*` | Backup snapshots from migrations — **read-block** in app |
| `worker_payments` | If present as duplicate of `payments` — treat as legacy |

---

## D — delete_candidate_later (zero app dependency first)

| Object | Why | Blocker |
|--------|-----|---------|
| `chart_accounts` | Duplicate COA | Confirm no ETL/reports; FKs from `account_transactions` |
| `account_transactions` | Legacy ledger | FK to chart_accounts |
| Duplicate `sale_items` vs `sales_items` | Naming drift | Code uses both; unify reads first |
| Old backup tables post-reconciliation | Space | Policy + archival |

---

## RPC / views

| Object | Class | Notes |
|--------|-------|-------|
| `get_contact_balances_summary` | **B** (operational) | Open-doc + openings |
| `get_contact_party_gl_balances` | **A** (GL slice) | Journal-derived party balances |
| `getTrialBalance` (client-side) | **A** | As implemented in `accountingReportsService` |
| `v_reconciliation_ar_ap_line_audit` | Reconciliation | Read-only |
| `count_unmapped_ar_ap_journal_entries` | Reconciliation | Read-only |

---

*Classifications are decisive: if a table is not `journal_*`, it is not the GL engine.*
