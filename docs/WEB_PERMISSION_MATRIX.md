# Web ERP — Permission Matrix & RLS Audit Guide

_Last updated: 2026-04-23 (Round 5 Comprehensive Fix)_

This document captures the access-control model used by the ERP web + mobile
clients, the Supabase roles involved, and the cleanup playbook for finding and
removing duplicate / overlapping RLS rules.

The accompanying SQL audit helper lives at
[scripts/sql/web_access_audit.sql](../scripts/sql/web_access_audit.sql) — run
it on the VPS first; the output drives the cleanup migration.

---

## 1. Actor model

| Role              | Source                               | Notes                                                                 |
|-------------------|--------------------------------------|----------------------------------------------------------------------|
| `anon`            | Supabase default                     | Reserved for unauthenticated probes (health, Supabase-internal).      |
| `authenticated`   | Supabase default                     | Any logged-in user (web or mobile). Scoped by `auth.uid()`.           |
| `service_role`    | Supabase default (bypass RLS)        | Server-side batch jobs and migrations only.                           |
| `app_admin`       | `public.users.role = 'admin'`        | Company-level super-user; can see all branches in the company.        |
| `app_manager`     | `public.users.role = 'manager'`      | Branch manager; limited to assigned branches.                         |
| `app_staff`       | `public.users.role = 'staff'`        | Cashier / data-entry; limited to daily operational tables.            |
| `app_worker`      | `public.users.role = 'worker'`       | Studio / rental labor accounts; read-only of own stages.              |

The four `app_*` roles are *virtual* — they are encoded in `public.users.role`
and consumed by policy expressions like

```sql
(SELECT role FROM public.users WHERE auth_user_id = auth.uid())
```

so our RLS policies can gate writes on role as well as company.

---

## 2. Module-by-module permission matrix

Legend: `R` = read, `W` = write (insert/update), `D` = delete, `X` = none.
Columns: **Admin**, **Manager**, **Staff**, **Worker**.

| Module                    | Admin | Manager | Staff | Worker |
|---------------------------|:-----:|:-------:|:-----:|:------:|
| Dashboard & metrics       |  R    |   R     |  R    |  R†    |
| Sales — create / post     |  W    |   W     |  W    |  X     |
| Sales — cancel / void     |  W    |   W     |  X    |  X     |
| Sales — edit header       |  W    |   W     |  W    |  X     |
| Sales — edit line items   |  W    |   W‡    |  X    |  X     |
| Sale returns              |  W    |   W     |  W    |  X     |
| Purchase — create / post  |  W    |   W     |  W    |  X     |
| Purchase — cancel         |  W    |   W     |  X    |  X     |
| Products / catalogue      |  W    |   W     |  R    |  X     |
| Variations master library |  W    |   W     |  X    |  X     |
| Inventory adjustments     |  W    |   W     |  W    |  X     |
| Studio productions        |  W    |   W     |  W    |  R§    |
| Studio — mark completed   |  W    |   W     |  W    |  W¶    |
| Rentals                   |  W    |   W     |  W    |  X     |
| Accounts — posting        |  W    |   W     |  X    |  X     |
| Accounts — transfers      |  W    |   W     |  X    |  X     |
| Worker payments           |  W    |   W     |  X    |  X     |
| Chart of accounts (edit)  |  W    |   X     |  X    |  X     |
| Reports                   |  R    |   R     |  R    |  X     |
| Settings / branches       |  W    |   X     |  X    |  X     |
| User & role mgmt          |  W    |   X     |  X    |  X     |

Footnotes:

- † Worker dashboard restricted to stages assigned to that worker.
- ‡ Managers can edit line items only while the sale is not yet fully paid.
- § Worker can read any stage where `assigned_worker_id = workers.id for auth.uid()`.
- ¶ Worker may complete their own stage but cannot reopen it.

---

## 3. Canonical RLS patterns in use

We use **three** canonical RLS idioms across the schema. Any policy that does
not match one of these patterns is a candidate for cleanup.

### 3.1 Company scope (most tables)

```sql
CREATE POLICY tablename_select_policy ON public.tablename
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid())
  );
```

Applies to: `products`, `product_variations`, `sales`, `purchases`,
`journal_entries`, `accounts`, `contacts`, `stock_movements`, etc.

### 3.2 Company scope + role gate (privileged writes)

```sql
CREATE POLICY tablename_insert_admin_manager ON public.tablename
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid())
    AND (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin','manager')
  );
```

Applies to: `chart_of_accounts_templates`, `variation_attributes`, branch /
user management tables.

### 3.3 Worker-own scope (studio / rental)

```sql
CREATE POLICY studio_production_stages_worker_self
  ON public.studio_production_stages
  FOR SELECT TO authenticated
  USING (
    assigned_worker_id = (
      SELECT id FROM public.workers w
      JOIN public.users u ON u.id = w.user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );
```

Applies to: `studio_production_stages`, `rental_items` (when assigned).

---

## 4. Cleanup playbook

After running `web_access_audit.sql`, investigate each finding and create a
cleanup migration that:

1. **Drops duplicate policies** flagged by section 3 of the audit output.
   Prefer the most restrictive version; keep one policy per (table, command,
   role) tuple.
2. **Drops orphan grants** from section 4 (grants to roles no longer in use).
3. **Enables RLS** on any table listed in section 6 but missing policies —
   either add the canonical company-scope policy or disable RLS if the table
   is genuinely global (e.g. reference data).
4. **Converts `SECURITY DEFINER` functions** that only need to read caller
   context back to `SECURITY INVOKER` unless they specifically need to
   bypass RLS.

Naming convention for the cleanup migration:

```
migrations/20260600_web_access_cleanup.sql
```

Start it with `BEGIN;` and end with `COMMIT;` so it's fully transactional;
include the audit output as a comment header for auditability.

---

## 5. Verification

Post-cleanup, rerun `web_access_audit.sql` and confirm:

- Section 3 shows **zero rows** (no duplicates).
- Section 6 shows **zero rows** (every RLS-enabled table has ≥1 policy).
- Section 4 contains only expected service-level grantees.

Smoke-test against both clients:

- Log in as `admin@…` → full CRUD across sales / purchases / accounts.
- Log in as `staff@…` → can create sales but cannot cancel / edit line items.
- Log in as a `worker@…` → sees only their studio stages.

If any of these regresses, restore the offending policy and re-run the audit.
