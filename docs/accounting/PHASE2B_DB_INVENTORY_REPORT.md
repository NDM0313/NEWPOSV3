# Phase 2B — Batch 4 DB legacy inventory (read-only)

**Date:** 2026-04-04 (updated: **2026-04-05** live ingest finalize)  
**Mode:** Read-only catalog + dependency proof. **No** `DROP`, `DELETE`, `UPDATE`, `ALTER`, or destructive SQL was executed in this pass.  
**Batch 4 status:** **COMPLETE** — verified live findings recorded in [§8](#8-verified-live-db-findings-batch-4-closure) and [§9.4](#94-live-ingest-verified-2026-04-05).

**Destructive action approved:** **NO** (expected: **NO**)

---

## 1. Mandatory output summary

| Item | Result |
|------|--------|
| **Exact SQL queries used** | Section [2](#2-exact-read-only-sql-run-in-target-environment); same logic in `scripts/phase2b_batch4_readonly_inventory.mjs` |
| **Exact outputs** | **Recorded** — [§8](#8-verified-live-db-findings-batch-4-closure) (operator-verified live DB); historical agent failure: [§9.1](#91-cursor-agent-live-run-2026-04-04) |
| **Tables found / not found** | Tier 1–2: all seven exist — [§8.1](#81-table-existence-tier-12) |
| **Row counts** | [§8.2](#82-row-counts-tier-12) |
| **Dependency findings** | Live FKs, views, triggers, RLS — [§8.3](#83-foreign-keys-live)–[§8.7](#87-rls-policies-live); §2.9 scan — [§8.8](#88-functions--procedures-29-scan); repo-static context: [§3](#3-dependency-graph-repo-static--verify-live) |
| **`journal_entry_lines.account_id` → `chart_accounts.id` live?** | **NO** — live: **`journal_entry_lines.account_id` → `accounts.id`** ([§8.4](#84-critical-spine-fk-live)) |
| **§2.9 function name scan (full paste)** | **Not supplied** in ingest (placeholder only) — [§8.8](#88-functions--procedures-29-scan) |
| **Classification per table** | [§5](#5-classification-per-table) + [§10](#10-per-object-summary-live) |
| **Batch 4** | **COMPLETE** |
| **Destructive action approved?** | **NO** |

### 1.1 Environment note

- **Verified target (this ingest):** **One** live database; operator did **not** label it staging vs production. If a second environment must match, re-run §2 there and append under §9.2.
- **Agent run (2026-04-04):** Cursor host could not reach DB — historical only ([§9.1](#91-cursor-agent-live-run-2026-04-04)).

---

## 2. Exact read-only SQL (run in target environment)

All statements are **SELECT** / catalog queries only.

### 2.1 Table existence (Tier 1–3 candidates)

```sql
-- Explicit Tier 1–2 candidates
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'chart_accounts',
    'account_transactions',
    'accounting_audit_logs',
    'automation_rules',
    'accounting_settings',
    'ledger_master',
    'ledger_entries'
  )
ORDER BY table_name;

-- Tier 3 patterns (dynamic names)
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE 'backup_cr\_%' ESCAPE '\'
    OR table_name LIKE 'backup_pf145\_%' ESCAPE '\'
  )
ORDER BY table_name;
```

**Expected output shape:** rows per existing table; missing names imply **not present** in `public`.

---

### 2.2 Row counts — Tier 1–2 (run only if table exists)

Use a safe pattern: count only when `to_regclass` is non-null.

```sql
SELECT 'chart_accounts' AS t, COUNT(*)::bigint AS row_count FROM chart_accounts
UNION ALL
SELECT 'account_transactions', COUNT(*)::bigint FROM account_transactions
UNION ALL
SELECT 'accounting_audit_logs', COUNT(*)::bigint FROM accounting_audit_logs
UNION ALL
SELECT 'automation_rules', COUNT(*)::bigint FROM automation_rules
UNION ALL
SELECT 'accounting_settings', COUNT(*)::bigint FROM accounting_settings
UNION ALL
SELECT 'ledger_master', COUNT(*)::bigint FROM ledger_master
UNION ALL
SELECT 'ledger_entries', COUNT(*)::bigint FROM ledger_entries;
```

If any table is absent, run counts **per table** inside `DO` blocks with existence checks, or comment out missing relations.

---

### 2.3 Company-scoped samples (when `company_id` exists)

```sql
-- Adjust per table after confirming columns via information_schema.columns
SELECT company_id, COUNT(*) AS n
FROM ledger_master
GROUP BY company_id
ORDER BY n DESC
LIMIT 20;

SELECT company_id, COUNT(*) AS n
FROM ledger_entries
GROUP BY company_id
ORDER BY n DESC
LIMIT 20;
```

Tier 1 prototype tables in `supabase-extract/migrations/16_chart_of_accounts.sql` **do not** define `company_id` on `chart_accounts` / `account_transactions` (single-tenant style). If your live DB added `company_id`, add matching `GROUP BY` queries.

---

### 2.4 Foreign keys **referencing** legacy tables (children)

Who depends on `chart_accounts`, `ledger_master`, etc.?

```sql
SELECT
  tc.table_schema,
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_schema = 'public'
  AND ccu.table_name IN (
    'chart_accounts',
    'account_transactions',
    'ledger_master',
    'ledger_entries',
    'accounting_audit_logs',
    'automation_rules',
    'accounting_settings'
  )
ORDER BY ccu.table_name, tc.table_name;
```

---

### 2.5 Foreign keys **from** legacy tables (parents)

```sql
SELECT
  tc.table_name AS legacy_table,
  kcu.column_name AS column_name,
  ccu.table_name AS references_table,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'chart_accounts',
    'account_transactions',
    'ledger_master',
    'ledger_entries',
    'accounting_audit_logs',
    'automation_rules',
    'accounting_settings'
  )
ORDER BY tc.table_name;
```

---

### 2.6 Views referencing legacy tables (pg_depend / rule of thumb: pg_views check)

Quick filter on view definitions (may be heavy on large catalogs):

```sql
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND (
    definition ILIKE '%chart_accounts%'
    OR definition ILIKE '%account_transactions%'
    OR definition ILIKE '%ledger_master%'
    OR definition ILIKE '%ledger_entries%'
    OR definition ILIKE '%accounting_audit_logs%'
    OR definition ILIKE '%automation_rules%'
    OR definition ILIKE '%accounting_settings%'
  )
ORDER BY table_name;
```

---

### 2.7 Triggers on legacy tables

```sql
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'chart_accounts',
    'account_transactions',
    'accounting_audit_logs',
    'automation_rules',
    'accounting_settings',
    'ledger_master',
    'ledger_entries'
  )
ORDER BY event_object_table, trigger_name;
```

---

### 2.8 RLS policies on legacy tables

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'chart_accounts',
    'account_transactions',
    'accounting_audit_logs',
    'automation_rules',
    'accounting_settings',
    'ledger_master',
    'ledger_entries'
  )
ORDER BY tablename, policyname;
```

---

### 2.9 Functions / procedures — dependency scan (optional, broader)

List functions whose **stored definition** mentions legacy names (adjust list as needed):

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
       pg_get_functiondef(p.oid) ILIKE '%chart_accounts%'
    OR pg_get_functiondef(p.oid) ILIKE '%ledger_master%'
    OR pg_get_functiondef(p.oid) ILIKE '%ledger_entries%'
    OR pg_get_functiondef(p.oid) ILIKE '%account_transactions%'
  );
```

**Caution:** `pg_get_functiondef` can be expensive; run off-peak or scope to known function names from `pg_proc`.

---

## 3. Dependency graph (repo-static — verify live)

Sources: `supabase-extract/migrations/16_chart_of_accounts.sql`, `migrations/ledger_master_and_entries.sql`, `migrations/pf145_backup_tables_and_fingerprint.sql`, `scripts/company_reset_backup.sql`, selected RPC migrations.

### 3.1 Tier 1 — `chart_accounts` cluster (prototype DDL)

| Relationship | Evidence |
|--------------|----------|
| `chart_accounts` → self (`parent_account_id`) | `16_chart_of_accounts.sql` |
| `account_transactions.account_id` → `chart_accounts.id` | same |
| `accounting_audit_logs.account_id` → `chart_accounts` | same |
| `automation_rules.debit_account_id` / `credit_account_id` → `chart_accounts` | same |
| **`journal_entry_lines.account_id` → `chart_accounts.id`** | **same file** — **critical:** if live DB still has this FK, the **protected** table `journal_entry_lines` is **referentially tied** to **legacy** `chart_accounts`. Dropping `chart_accounts` without migrating the FK to `accounts` would be blocked or unsafe. **Must confirm** with §2.4 on the target DB. |
| Trigger `trigger_update_balance` on `account_transactions` | updates `chart_accounts.current_balance` (same file) |
| RLS | multiple `CREATE POLICY` on Tier 1 tables (same file) |

### 3.2 Tier 2 — `ledger_master` / `ledger_entries`

| Relationship | Evidence |
|--------------|----------|
| `ledger_entries.ledger_id` → `ledger_master.id` ON DELETE CASCADE | `migrations/ledger_master_and_entries.sql` |
| RLS | `migrations/enterprise_defaults_and_rls_isolation.sql`, `migrations/ledger_master_ledger_entries_rls_insert_update.sql`, permission migrations |

### 3.3 Tier 3 — backups

| Pattern | Evidence |
|---------|----------|
| `backup_pf145_journal_entries`, `backup_pf145_journal_entry_lines` | `migrations/pf145_backup_tables_and_fingerprint.sql` |
| `backup_cr_*` (many, including snapshots of `journal_entries`, `journal_entry_lines`, `ledger_*`, `payments`, …) | `scripts/company_reset_backup.sql` (runbook script; not executed in Batch 4) |

### 3.4 Protected RPCs (repo review — no legacy Tier 1–2 table reads found)

| RPC | Tables touched in migration body (representative) |
|-----|---------------------------------------------------|
| `get_customer_ledger_sales` | `sales` only | `migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql` |
| `get_financial_dashboard_metrics` | `sales`, `purchases`, `expenses`, `accounts`, … | `migrations/financial_dashboard_metrics_rpc.sql`, `20260370_*.sql` |
| `get_contact_balances_summary` | `worker_ledger_entries`, contacts, etc. | `migrations/get_contact_balances_summary_rpc.sql` (not `ledger_entries` for supplier subledger) |

**Note:** Live DB may differ if an older function definition remains; use §2.9 on the target.

---

## 4. Runtime safety cross-check (protected spine vs legacy)

| Question | Finding |
|----------|---------|
| Do Phase 2A RPCs **read** `chart_accounts` / `ledger_master` / `ledger_entries` in repo migrations reviewed? | **No** — bodies use `sales`, `accounts`, `worker_ledger_entries`, etc. |
| **Live:** Does `journal_entry_lines.account_id` reference `chart_accounts`? | **No** — **`accounts.id`** ([§8.4](#84-critical-spine-fk-live)). Spine is **not** FK-blocked by `chart_accounts` for journal lines. |
| **Live:** Other `chart_accounts` dependencies? | Yes — legacy Tier 1 tables and self-FK still reference `chart_accounts` ([§8.3](#83-foreign-keys-live)); triggers remain ([§8.6](#86-triggers-live)). |
| App settings key `accounting_settings` in `SettingsContext` | Refers to **settings service** key / JSON — **not** proven to read `public.accounting_settings` table (grep shows no `.from('accounting_settings')` in `src/`). |

---

## 5. Classification per table

Classifier key: **PROTECTED_LIVE** | **LEGACY_READONLY** | **ARCHIVE_ONLY** | **DROP_CANDIDATE_REVIEW**

| Table / pattern | Classification | Notes |
|-----------------|----------------|-------|
| `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries` | **PROTECTED_LIVE** | Per Phase 2B policy; **live:** `journal_entry_lines.account_id` → **`accounts.id`** (not `chart_accounts`). |
| `chart_accounts` | **LEGACY_READONLY** / **DROP_CANDIDATE_REVIEW** | No app reads; **live:** still parent for **legacy** FKs (`account_transactions`, `accounting_audit_logs`, `automation_rules`, self-parent). **Not** the spine `journal_entry_lines` parent. Tier 1 **not auto-approved** for DROP. |
| `account_transactions` | **LEGACY_READONLY** / **DROP_CANDIDATE_REVIEW** | **Live:** FK → `chart_accounts`; `trigger_update_balance` → `update_account_balance()`; RLS. |
| `accounting_audit_logs` | **LEGACY_READONLY** / **DROP_CANDIDATE_REVIEW** | **Live:** FK → `chart_accounts`; RLS. |
| `automation_rules` | **LEGACY_READONLY** / **DROP_CANDIDATE_REVIEW** | **Live:** FK → `chart_accounts` (debit/credit); `update_updated_at_column` trigger; RLS. |
| `accounting_settings` (table) | **LEGACY_READONLY** / **DROP_CANDIDATE_REVIEW** | Distinct from app settings key name. **Live:** RLS; 0 rows in verified target. |
| `ledger_master`, `ledger_entries` | **LEGACY_READONLY** / **DROP_CANDIDATE_REVIEW** | Supplier/user subledger; not Phase 2A RPC core. **Live:** 16 / 51 rows; FK `ledger_entries` → `ledger_master`; RLS. |
| `backup_cr_*`, `backup_pf145_*` | **ARCHIVE_ONLY** | Retention / governance; not live UX. |

---

## 6. Backup / rollback readiness (per candidate)

| Object | Backup sensitivity | Rollback concern | Archive vs drop |
|--------|--------------------|------------------|-----------------|
| Tier 1 cluster | **High** if any historical posting used it; audit logs | Restore from backup or FK migration plan | **DROP_CANDIDATE_REVIEW** only after FK + row proof |
| `ledger_*` | Historical supplier/user movement | Data loss for old reconciliation | **ARCHIVE_ONLY** bias; drop only with finance sign-off |
| `backup_*` | Low for **new** ops; high for **recovery** | Losing safety net for past incidents | **ARCHIVE_ONLY**; DROP = governance |

---

## 7. Final statement

| Item | Value |
|------|-------|
| **Batch 4** | **COMPLETE** (live inventory + critical FK resolved — [§8](#8-verified-live-db-findings-batch-4-closure)) |
| **Destructive action approved?** | **NO** |
| **Batch 5** | **Not approved** in this pass |

---

## 8. Verified live DB findings (Batch 4 closure)

**Source:** Operator-verified read-only query results ingested **2026-04-05**. **No** facts below were inferred by Cursor beyond this paste.

### 8.1 Table existence (Tier 1 / Tier 2)

| Table | Exists (live) |
|-------|----------------|
| `chart_accounts` | **YES** |
| `account_transactions` | **YES** |
| `accounting_audit_logs` | **YES** |
| `automation_rules` | **YES** |
| `accounting_settings` | **YES** |
| `ledger_master` | **YES** |
| `ledger_entries` | **YES** |

**Tier 3 (`backup_cr_%`, `backup_pf145_%`):** **Not reported** in this ingest — run §2.1 second query if needed.

### 8.2 Row counts (Tier 1 / Tier 2)

| Table | Row count (live) |
|-------|------------------|
| `chart_accounts` | 0 |
| `account_transactions` | 0 |
| `accounting_audit_logs` | 0 |
| `automation_rules` | 0 |
| `accounting_settings` | 0 |
| `ledger_master` | 16 |
| `ledger_entries` | 51 |

### 8.3 Foreign keys (live)

| Child column / table | Parent (live) |
|---------------------|----------------|
| `account_transactions.account_id` | `chart_accounts.id` |
| `accounting_audit_logs.account_id` | `chart_accounts.id` |
| `automation_rules.debit_account_id` | `chart_accounts.id` |
| `automation_rules.credit_account_id` | `chart_accounts.id` |
| `chart_accounts.parent_account_id` | `chart_accounts.id` |
| `ledger_entries.ledger_id` | `ledger_master.id` |

### 8.4 Critical spine FK (live)

| Check | Result |
|-------|--------|
| `journal_entry_lines.account_id` → `chart_accounts.id` | **Does not exist (live)** |
| `journal_entry_lines.account_id` → `accounts.id` | **Yes (live)** |

### 8.5 Views (live)

**No** `public` views referencing the scanned legacy names (`chart_accounts`, `account_transactions`, `ledger_master`, `ledger_entries`, `accounting_audit_logs`, `automation_rules`, `accounting_settings`).

### 8.6 Triggers (live)

| Table | Trigger | Timing | Action |
|-------|---------|--------|--------|
| `account_transactions` | `trigger_update_balance` | AFTER INSERT | `EXECUTE FUNCTION update_account_balance()` |
| `automation_rules` | `update_automation_rules_updated_at` | BEFORE UPDATE | `EXECUTE FUNCTION update_updated_at_column()` |
| `chart_accounts` | `update_chart_accounts_updated_at` | BEFORE UPDATE | `EXECUTE FUNCTION update_updated_at_column()` |

### 8.7 RLS policies (live)

Policies exist (operator summary) on: **`account_transactions`**, **`accounting_audit_logs`**, **`accounting_settings`**, **`automation_rules`**, **`chart_accounts`**, **`ledger_entries`**, **`ledger_master`**. Full `pg_policies` row dump was not pasted; re-run inventory §2.8 if verbatim `qual` / `with_check` text is required.

### 8.8 Functions / procedures (§2.9 scan)

**Full `pg_get_functiondef` / §2.9 result list:** **Not supplied** — operator message contained placeholder `[Paste exact output here]` only.

**From live trigger definitions (above), these function names are referenced:** `update_account_balance()`, `update_updated_at_column()`. Any additional routines touching legacy names require a pasted §2.9 output.

---

## 9. Live execution log

### 9.1 Cursor agent live run (2026-04-04)

| Step | Result |
|------|--------|
| SQL used | Identical to §2, executed via `node scripts/phase2b_batch4_readonly_inventory.mjs` (reads `process.env.DATABASE_URL` or `.env.local` `DATABASE_URL`) |
| Environment label | **Unlabeled** — only `.env.local` present in workspace; assumed **one** Supabase project |
| Connectivity | **FAILED** — `ENOTFOUND` on direct DB host; no rows returned |
| Outputs | **None** |

**Implication (historical):** Agent could not verify live FKs. **Superseded** by [§8](#8-verified-live-db-findings-batch-4-closure).

### 9.2 Operator output paste (staging / production)

Canonical findings are in **§8**. Optional: paste raw stdout below per environment for audit trail.

**Staging**

```text
(not separately labeled in this ingest)
```

**Production**

```text
(not separately labeled in this ingest)
```

### 9.3 Live output ingest (Cursor) — no paste received

**Historical record (2026-04-04):** First ingest attempt had no pasted results. **Superseded** by §9.4.

### 9.4 Live ingest verified (2026-04-05)

| Field | Value |
|-------|--------|
| **Source** | Operator-verified live DB results (chat ingest) |
| **Environment label** | **Not supplied** (single target assumed) |
| **Critical FK `journal_entry_lines.account_id` → `chart_accounts.id`** | **Absent live** |
| **`journal_entry_lines.account_id` target (live)** | **`accounts.id`** |
| **Batch 4 after ingest** | **COMPLETE** |

---

## 10. Per-object summary (live)

| Object | Exists? | Row count | Dependency risk (live) | Classification |
|--------|---------|-----------|-------------------------|------------------|
| `chart_accounts` | YES | 0 | FK parent for legacy cluster; triggers | LEGACY_READONLY / DROP_CANDIDATE_REVIEW |
| `account_transactions` | YES | 0 | FK → `chart_accounts`; trigger `update_account_balance`; RLS | LEGACY_READONLY / DROP_CANDIDATE_REVIEW |
| `accounting_audit_logs` | YES | 0 | FK → `chart_accounts`; RLS | LEGACY_READONLY / DROP_CANDIDATE_REVIEW |
| `automation_rules` | YES | 0 | FK → `chart_accounts` (×2); trigger; RLS | LEGACY_READONLY / DROP_CANDIDATE_REVIEW |
| `accounting_settings` | YES | 0 | RLS | LEGACY_READONLY / DROP_CANDIDATE_REVIEW |
| `ledger_master` | YES | 16 | RLS | LEGACY_READONLY / DROP_CANDIDATE_REVIEW |
| `ledger_entries` | YES | 51 | FK → `ledger_master`; RLS | LEGACY_READONLY / DROP_CANDIDATE_REVIEW |
| `backup_cr_*` / `backup_pf145_*` | not reported | — | — | ARCHIVE_ONLY (policy); confirm with §2.1 if needed |
| `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries` | YES (policy) | n/a Batch 4 | **Live:** `jel.account_id` → **`accounts`** — spine **not** blocked by `chart_accounts` FK | PROTECTED_LIVE |

---

## 11. References

- `docs/accounting/PHASE2B_LEGACY_INVENTORY.md`
- `docs/accounting/PHASE2B_DROP_CANDIDATES_REVIEW.md`
- `docs/accounting/PHASE2B_ROLLBACK_AND_SAFETY.md`
