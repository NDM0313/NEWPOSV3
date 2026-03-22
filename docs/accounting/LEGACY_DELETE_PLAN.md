# Legacy delete plan — accounting objects

**Rule:** No DROP until **zero dependency** in app code and a verified backup.

---

## chart_accounts

| Item | Detail |
|------|--------|
| **Why duplicate** | Superseded by `accounts` (company-scoped COA) |
| **Dependencies** | `account_transactions`, possible old scripts; `supabase-extract` migrations |
| **Blocker** | FK from `account_transactions`; confirm empty in prod |
| **Migration** | N/A if unused |
| **Safe sequence** | (1) Verify no app reads (2) Archive dump (3) Drop FK child first (4) Drop `chart_accounts` |

---

## account_transactions

| Item | Detail |
|------|--------|
| **Why duplicate** | Parallel to `journal_entry_lines` on old schema |
| **Dependencies** | `chart_accounts` |
| **Blocker** | Same as above |
| **Safe sequence** | After `chart_accounts` child removed |

---

## backup_cr_* / backup_pf145_* (pattern)

| Item | Detail |
|------|--------|
| **Why** | Migration safety snapshots |
| **Dependencies** | None in app (must stay **read-blocked**) |
| **Blocker** | Ops may want retention |
| **Safe sequence** | S3/archive → drop after retention policy |

---

## ledger_master / ledger_entries (optional long-term)

| Item | Detail |
|------|--------|
| **Why duplicate** | UI subledger; GL is `journal_*` |
| **Dependencies** | Supplier payment sync, commission, reports |
| **Blocker** | Replace reads with journal-based party views OR keep as **labeled** operational only |
| **Safe sequence** | Not delete_candidate until UI migrated |

---

## Duplicate sale_items vs sales_items

| Item | Detail |
|------|--------|
| **Why** | Schema evolution |
| **Dependencies** | Code reads both |
| **Blocker** | Unify application reads to one table + backfill |
| **Safe sequence** | Data merge doc → single table → drop other |

---

## workers.current_balance / contacts.current_balance (column drop — extreme)

| Item | Detail |
|------|--------|
| **Why** | Violates single GL truth if trusted |
| **Dependencies** | Many reads; studio updates |
| **Blocker** | Large refactor; prefer **NULL + computed** or triggers from journals only |
| **Safe sequence** | **Not recommended short-term** — policy is “ignore as truth”, not drop |

---

*Review quarterly after reconciliation variance trends to zero.*
