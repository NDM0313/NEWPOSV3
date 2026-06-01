# Public Schema Wipe Log

## Run metadata

| Field | Value |
|-------|-------|
| Date/time (UTC) | 2026-05-27 ~15:45 UTC |
| Operator | automated (Cursor agent) |
| Environment | VPS (`dincouture-vps`, container `supabase-db`) |
| Supabase project | same project reused — URL/keys unchanged |

## Pre-wipe checklist

- [x] Full DB backup taken — `/opt/erp/supabase/backups/supabase_full_pre_wipe_.sql.gz` (2.2 MB)
- [x] `deploy/wipe-public-schema-preview.sql` run and output saved

### Pre-wipe row estimates

**Total approximate rows before wipe:** 18,355  
**Tables to truncate:** 108 (all `public` tables except `schema_migrations`, `migration_history`)

Top tables by row count: `audit_logs` (11,081), `journal_entry_lines` (1,790), `activity_logs` (1,443), `journal_entries` (797), `sales` (182), `companies` (1), `users` (27).

Full preview output: [`docs/public_schema_wipe_pre.txt`](public_schema_wipe_pre.txt)

## Wipe execution

- [x] `deploy/wipe-public-schema-data.sql` executed successfully
- [x] Transaction committed (`COMMIT`)

**Notes:**
- `session_replication_role=replica` skipped (insufficient privilege on VPS postgres role); `TRUNCATE CASCADE` completed without it.
- First attempt rolled back on `migration_history` sequence ownership; script updated to exclude `migration_history` and drop `RESTART IDENTITY` from truncate loop.

**Result:** `WIPE COMPLETE: 107 public tables truncated (schema_migrations, migration_history preserved).`

Full execution output: [`docs/public_schema_wipe_exec.txt`](public_schema_wipe_exec.txt)

## Post-wipe verification

- [x] `deploy/wipe-public-schema-verify.sql` run — **PASSED**

**Verification summary:** 109 public tables checked; all empty except `schema_migrations` (475 rows preserved).

### Key preserved / empty counts

| table_name | row_count |
|------------|-----------|
| companies | 0 |
| users | 0 |
| branches | 0 |
| sales | 0 |
| purchases | 0 |
| contacts | 0 |
| products | 0 |
| accounts | 0 |
| journal_entries | 0 |
| schema_migrations | 475 (preserved) |
| migration_history | 0 |

Full verification output: [`docs/public_schema_wipe_verify.txt`](public_schema_wipe_verify.txt)

## Manual steps after DB wipe

Required for fresh registration with the **same email** on the **same Supabase project**:

- [ ] **Auth user deleted** — Supabase Dashboard → **Authentication → Users** → delete account  
  The wipe script does **not** remove `auth.users`. Without this step, signup with the same email fails ("User already registered") and login is broken because `public.users` is empty.

- [ ] **Storage buckets cleared** (optional) — Dashboard → **Storage** → empty product image / expense receipt buckets

- [ ] **Mobile devices reset** (optional) — Settings → full device reset on each Capacitor device

- [ ] **Fresh registration completed** — sign up with same email, complete company/branch onboarding

## Notes

- Sequences `schema_migrations_id_seq` and `rental_no_seq` restarted to 1; `migration_history_id_seq` skipped (ownership).
- `deploy/supabase-backup.sh` failed on VPS (Docker lacks `-T` flag); manual `pg_dump` backup used instead.

---

## Auth reminder

> **Delete the user in Supabase Authentication before re-registering.**  
> Public schema data is wiped; `auth.users` is a separate schema and is untouched by the wipe script.
