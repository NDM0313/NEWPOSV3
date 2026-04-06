# Legacy cleanup — GO / NO-GO proof pack

**Project:** NEW POSV3  
**Stabilized company UUID:** `db1302ec-a8d7-4cff-81ad-3c8d7cb55509`  
**Rules:** Additive only; no destructive deletes; no accounting architecture changes; preserve GL vs operational basis map.  
**Evidence standard:** Live codebase facts (this repo) + **you** run live DB SQL and paste results. No assumed PASS.

---

## Executive verdict (fill after all gates)

| Gate | Scope | Result |
|------|--------|--------|
| GATE 1 | Accounting truth (company above) | **PENDING** — run SQL + UI checks |
| GATE 2 | Code usage (scoped paths) | **See matrix** — repo scan dated 2026-04-06 |
| GATE 3 | DB dependencies | **PENDING** — run dependency SQL per table |
| GATE 4 | Fresh-company smoke | **PENDING** — run checklist + snapshot SQL |

**Overall GO for legacy table quarantine:** only if **GATE 3 + GATE 4** are acceptable per table, and **GATE 1** is PASS for the company (global), and **GATE 2** does not block that table.

**Per-table rule:** a failing gate **blocks only that table**, not the whole cleanup program.

---

## Candidate scope

Sources: `docs/accounting/CANONICAL_TABLE_CLASSIFICATION.md`, `docs/accounting/PHASE2B_LEGACY_INVENTORY.md`, legacy guard `src/app/services/accountingCanonicalGuard.ts`.

| Group | Tables / patterns |
|--------|-------------------|
| Legacy COA cluster | `chart_accounts`, `account_transactions` |
| Retired supplier subledger (non–worker) | `ledger_master`, `ledger_entries` |
| Possible duplicate payment table | `worker_payments` (if exists in DB) |
| Archive / backup | `backup_*` (incl. `backup_cr_*`, `backup_pf145_*` patterns) |
| Naming drift (not “unused legacy”) | `sale_items` vs `sales_items` |
| **Out of scope for quarantine** | `worker_ledger_entries` — **KEEP_LIVE** (operational; heavy app usage) |

---

## GATE 1 — Accounting truth gate

**Company:** `db1302ec-a8d7-4cff-81ad-3c8d7cb55509`  
**Branch:** match the UI slice under test (`NULL` = all branches, consistent with `sql/final_basis_stabilization_views.sql`).

### 1.1 Trial Balance difference = 0 (GL basis)

**Run:** `sql/final_accounting_stabilization_audit.sql` (edit `params` CTE: `company_id`, `branch_id`, `period_start`, `period_end`).

**Note:** The optional “unmapped” queries at the bottom of that file use placeholder `00000000-0000-0000-0000-000000000000` — replace with the same `company_id` as `params` before interpreting those lines.

| Check | PASS criterion |
|--------|----------------|
| `canonical_tb` → `TB_BALANCED` | Value = `PASS` |
| `canonical_tb` → `tb_difference` | Absolute value < `0.01` (same as audit logic) |

**Recorded result:** _______________

### 1.2 Balance Sheet balances (GL basis)

**App (live):** Reports → Balance Sheet → as-of = end of `period_end` used in 1.1; confirm **Assets = Liabilities + Equity** (UI shows equation or export).

**SQL (optional cross-check):** sum journal lines in the same date window as TB, map `accounts.type` to buckets, using the same signed balance convention as `accountingReportsService.getTrialBalance` (debit − credit per row; filter voided JEs). PASS if **|assets − (liabilities + equity)| < 0.01**.

**Recorded result:** _______________

### 1.3 Profit & Loss matches GL basis (same period)

**Run:** same `params` period as 1.1.

**PASS:** P&amp;L net income (from Financial reports for that period) equals, within **0.01**, the journal-derived net for revenue/expense accounts in that period (see `pnl_proxy` section in `sql/final_accounting_stabilization_audit.sql` for heuristic lines; or export P&amp;L from app and compare to SQL roll-up).

**Recorded result:** _______________

### 1.4 Financial GL view agrees with TB / P&amp;L / BS

**Run:** `SELECT public.get_financial_dashboard_metrics('db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid, :branch_id);`  
Compare headline totals to:

- TB totals from 1.1  
- BS/P&amp;L slices for the same branch and period policy  

**PASS:** No unexplained sign inversions; totals reconcile within **0.01** after known basis labels (operational vs GL footnotes unchanged).

**Recorded result:** _______________

### 1.5 Supplier AP running balance — liability convention (credit − debit)

**Implementation fact:** `public.get_supplier_ap_gl_ledger_for_contact` computes running balance with cumulative **`SUM(credit - debit)`** over ordered AP lines (see `migrations/20260407_get_supplier_ap_gl_ledger_for_contact.sql`, window over `ordered`).

**PASS:** For a known supplier with AP activity, call the RPC; confirm `running_balance` moves in the liability direction consistent with **credits increasing supplier balance** (and debits reducing).

**Recorded result:** _______________

### GATE 1 summary

| Sub-check | PASS / FAIL |
|-----------|-------------|
| TB balanced | |
| BS equation | |
| P&amp;L vs GL period | |
| Dashboard / financial metrics vs TB | |
| AP running balance convention | |

---

## GATE 2 — Code usage gate (live codebase audit)

**Included paths:** `src/` (web app + services calling Supabase), `erp-mobile-app/src/` (mobile), `supabase/functions/` (edge). There is no separate `backend/` package in this repo — server logic is Supabase RPC/SQL + Edge Functions.  
**Excluded per instructions:** `docs/`, old migrations, backup files, `sql/review_only/`, and other review-only artifacts.

**Method:** ripgrep for `.from('table')` and legacy names in guard strings.

### GATE 2 — Results (PASS = unused for runtime CRUD; FAIL = used)

| Table | Used? | Evidence (exact files) |
|--------|--------|-------------------------|
| `chart_accounts` | **Unused** (guard / comment only) | `src/app/services/accountingCanonicalGuard.ts` (blocklist); `src/app/components/accounting/AddChartAccountDrawer.tsx` (comment: not legacy table) |
| `account_transactions` | **Unused** (guard only) | `src/app/services/accountingCanonicalGuard.ts` |
| `ledger_master` | **Unused** | No `.from('ledger_master')` in scoped paths; guard uses split string constants `NON_GL_LEDGER_TABLES` in `accountingCanonicalGuard.ts` |
| `ledger_entries` | **Unused** | No `.from('ledger_entries')` in scoped paths (distinct from `worker_ledger_entries`) |
| `worker_payments` | **Unused** | No matches in `src/`, `erp-mobile-app/src/`, `supabase/functions/` |
| `backup_*` | **Unused** as GL truth | Guard only: `accountingCanonicalGuard.ts` (prefix / `backup_cr` / `backup_pf145`); `backupExport.ts` uses string `backup_` for **filename**, not table reads |
| `sale_items` | **Used** (fallback reads) | `src/app/services/accountingReportsService.ts`; `src/app/services/saleService.ts`; `src/app/services/saleReturnService.ts`; `src/app/services/studioProductionService.ts`; `src/app/utils/backupExport.ts` |
| `sales_items` | **Used** (canonical) | Same files as `sale_items` — dual path |
| `worker_ledger_entries` | **Used** (KEEP_LIVE) | Many `src/app/services/*`, `erp-mobile-app/src/api/accounts.ts`, etc. — **not a legacy delete candidate** |

**GATE 2 per legacy candidate:**

| Table | GATE 2 |
|--------|--------|
| `chart_accounts` | **PASS** (no runtime `.from`) |
| `account_transactions` | **PASS** |
| `ledger_master` | **PASS** |
| `ledger_entries` | **PASS** |
| `worker_payments` | **PASS** (if table exists) |
| `sale_items` | **FAIL** — **BLOCKED_CODE_USAGE** for removal/quarantine of line-item legacy |
| `sales_items` | **FAIL** for “unused” — **KEEP_LIVE** |

---

## GATE 3 — Database dependency gate

**You must run this on the live Supabase DB.** Repo cannot enumerate production `pg_depend`, RLS, or triggers without a connection.

### 3.1 Foreign keys referencing candidate tables

```sql
-- Replace :table_name with each candidate, e.g. chart_accounts
SELECT
  tc.table_schema,
  tc.table_name AS dependent_table,
  kcu.column_name,
  ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = :table_name;
```

**block cleanup = yes** if any unexpected dependent object must keep FK.

### 3.2 Views referencing table

```sql
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%' || :table_name || '%';
```

(Also search `pg_views` / `pg_depend` if your IDE supports it — `view_definition` can truncate.)

### 3.3 Functions / RPCs (search prosrc)

```sql
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%' || :table_name || '%';
```

### 3.4 Triggers

```sql
SELECT tgname, relname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND pg_get_triggerdef(t.oid) ILIKE '%' || :table_name || '%';
```

### 3.5 RLS policies (if used)

```sql
SELECT polname, tablename
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual::text ILIKE '%' || :table_name || '%'
    OR with_check::text ILIKE '%' || :table_name || '%');
```

### GATE 3 log template

| table_name | dependency type | object name | block cleanup (yes/no) | notes |
|------------|-----------------|-------------|-------------------------|--------|
| *(fill)* | | | | |

---

## GATE 4 — Fresh-company smoke gate

**Goal:** After creating a **new** company (or isolated test tenant), run one minimal cycle of live flows. **Candidate legacy tables** must show **zero new rows** and **zero updates** (and ideally zero inserts via triggers).

### 4.1 Snapshot SQL (before smoke)

Replace `:new_company_id` with the new company UUID.

**Tables with `company_id` (typical):** `ledger_master`, `ledger_entries`, and any tenant-scoped legacy table in your live DB.

```sql
SELECT 'ledger_master' AS t, count(*)::bigint AS n, max(updated_at) AS last_upd
FROM public.ledger_master WHERE company_id = :new_company_id
UNION ALL
SELECT 'ledger_entries', count(*)::bigint, max(updated_at)
FROM public.ledger_entries WHERE company_id = :new_company_id;
```

**Legacy COA cluster:** older DDL (`supabase-extract/migrations/16_chart_of_accounts.sql`) defines `chart_accounts` / `account_transactions` **without** `company_id`. If your production schema still matches that, use **global** fingerprints (full-table `count(*)` and `max(updated_at)`) for the smoke window — PASS only if those values are **unchanged** while testing a new company (stronger than per-company filter).

```sql
-- Only if chart_accounts has no company_id — run once before / after smoke
SELECT 'chart_accounts' AS t, count(*)::bigint AS n, max(updated_at) AS last_upd FROM public.chart_accounts
UNION ALL
SELECT 'account_transactions', count(*)::bigint, max(updated_at) FROM public.account_transactions;
```

(Add `worker_payments` only if the table exists; add `WHERE company_id = :new_company_id` only if the column exists.)

### 4.2 Smoke checklist (manual)

1. **Final sale** — post invoice through canonical path.  
2. **Customer payment** — allocate to AR.  
3. **Final purchase** — supplier bill.  
4. **Supplier payment** — AP.  
5. **Expense** — GL expense entry or expense doc per product.  
6. **Worker payment** — `payments` + journal + `worker_ledger_entries` path.  
7. **Studio cost** — if your tenant uses studio: production / stage completion that posts costs.  
8. **Rental** — if enabled: rental invoice + receipt.

### 4.3 Snapshot SQL (after smoke)

Re-run 4.1. **PASS** for a legacy candidate: `n` unchanged and `last_upd` unchanged (or still null).

### 4.4 LIVE tables sanity

Confirm no errors in app; TB still balances for the **new** company if you posted enough volume to matter.

**Recorded result:** _______________

---

## Final table classification (strict)

| Status | Meaning |
|--------|---------|
| **KEEP_LIVE** | Required for product; do not quarantine. |
| **BLOCKED_DEPENDENCY** | GATE 3 shows FK/view/trigger/RPC dependency → no quarantine. |
| **BLOCKED_CODE_USAGE** | GATE 2 shows runtime use → no quarantine. |
| **QUARANTINE_READY** | All four gates PASS for that table; additive rename/archive only. |
| **DELETE_READY_LATER** | Only if: verified backup exists; GATE 2 unused; GATE 3 none blocking; GATE 4 zero writes; **and** explicit sign-off. |

### Classification matrix (repo + logic; DB columns TBD)

| table_name | GATE 1 | GATE 2 | GATE 3 | GATE 4 | Status |
|------------|--------|--------|--------|--------|--------|
| `worker_ledger_entries` | n/a for legacy | FAIL (used) | — | — | **KEEP_LIVE** |
| `sales_items` | n/a | FAIL (used) | — | — | **KEEP_LIVE** |
| `sale_items` | n/a | FAIL (used) | — | — | **BLOCKED_CODE_USAGE** |
| `chart_accounts` | pending | PASS | **pending** | **pending** | **TBD** |
| `account_transactions` | pending | PASS | **pending** | **pending** | **TBD** |
| `ledger_master` | pending | PASS | **pending** | **pending** | **TBD** |
| `ledger_entries` | pending | PASS | **pending** | **pending** | **TBD** |
| `worker_payments` | pending | PASS | **pending** | **pending** | **TBD** |
| `backup_*` | pending | PASS (not UI) | **pending** | **pending** | **KEEP_LIVE** or archive policy — not DELETE_READY without backup policy |

**Recommendation:** Treat **QUARANTINE_READY** only after **GATE 3 + GATE 4** green for that object. Do **not** mark **DELETE_READY_LATER** until an explicit backup artifact exists and dependencies are empty.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Candidate row sheet | `docs/accounting/LEGACY_TABLE_CANDIDATES.csv` |
| Review-only quarantine SQL (do not execute blindly) | `sql/review_only/legacy_quarantine_plan.sql` |
| TB / audit pack | `sql/final_accounting_stabilization_audit.sql` |
| Basis views (company-scoped) | `sql/final_basis_stabilization_views.sql` |

---

## Final decision (sign-off block)

**Date:** _______________

**Preparer:** _______________

**Verdict:** We **approve / do not approve** additive quarantine for tables marked **QUARANTINE_READY** in `LEGACY_TABLE_CANDIDATES.csv` after DB evidence is attached.

**Attached:** paste GATE 1 query output, GATE 3 dependency grids, GATE 4 before/after snapshots.
