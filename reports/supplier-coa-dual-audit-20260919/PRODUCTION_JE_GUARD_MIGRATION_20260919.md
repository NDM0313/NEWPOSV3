# Production JE account-guard migration evidence — 2026-09-19

**Verdict: `PRODUCTION_JE_GUARD_MIGRATION_VERIFIED_PASS`**

Owner approval phrase honored: `migrate production database now for journal posting account guard only`

**Approved SHA (required HEAD):** `2d670d2c04e67bafbbc7b0bf585ec252b53dbc9e`  
Verified local `git rev-parse HEAD` matched before DDL.

**Not done in this phase (explicit stop):**

- IBRAHIM `01_backup.sql` / `02_apply.sql` / `03_rollback.sql` — **not run**
- ID LACE — **NOT IMPLEMENTED**
- Branch merge — **not performed**
- No production Kong / Auth / PostgREST / Realtime / Storage / frontend restarts

---

## 1. Pre-migration hard gate

Target: live Supabase PostgreSQL database name **`postgres`** (`current_database() = postgres`).

| Check | Result |
|------|--------|
| Guard objects absent | PASS (`resolve`, `public_core`, remaps, events, trigger all `f`) |
| IBRAHIM lines JE-0137 / JE-0138 | PASS — line ids `677c74de-…` Dr 19000; `343c2586-…` Dr 99275; still on legacy `3f1440dd-…` / `210026`; non-void |
| JE headers | PASS — JE-0137 `9ff212f9-…` 2025-12-03; JE-0138 `db8436ec-…` 2026-01-21 |
| Target AP | PASS — `2c56a1d1-…` `AP-SUPZHD0026` active, contact `08592090-…` |
| `backup_coa_merge_20260916.merge_pairs` | PASS — IBRAHIM pair eligible (`SUP-ZHD-0026` / IBRAHIM BNRS) |
| `backup_coa_limited_ibrahim_v1` | PASS — ABSENT (no `BACKUP_EXISTS`) |
| Drift vs staging evidence | **None** — proceed |

Script: `deploy/staging-je-guard/prod-readonly-preflight.sql`

---

## 2. Migration applied

| Item | Value |
|------|--------|
| File | `migrations/20260919140000_journal_posting_account_guard_and_verified_remaps.sql` |
| SHA256 | `ec076d5538e6752edc7e147e92c1591ff6960dc8a67d64ef3029910866310b4c` |
| Database | `postgres` (only) |
| Runner | `docker exec … psql -U postgres -d postgres -v ON_ERROR_STOP=1` via `ssh dincouture-vps` |
| SQL edited during exec? | **No** |
| Repair-package SQL? | **No** |

### Sanitized migration output (summary)

- Transaction: `BEGIN` … `COMMIT` (atomic success; exit 0)
- Objects created: remaps / events / tickets tables; resolve + repair functions; line + company-reassignment triggers; RLS policies; ACL grants/revokes
- Expected first-time DROP NOTICE skips for policies/triggers/legacy helper (absent → create path)
- Seed NOTICE:

```
journal_account_verified_remaps AUTOMATIC_SCOPE seed: eligible=33 inserted=33 identical_skip=0
(HISTORICAL_REPAIR_SCOPE=IBRAHIM 2 lines separate package; ID LACE=NOT_IMPLEMENTED)
```

---

## 3. Immediate catalog / ACL verification

| Object / trigger | Present / enabled |
|------------------|-------------------|
| `journal_account_verified_remaps` | YES |
| `journal_account_guard_events` | YES |
| `_journal_account_repair_tickets` | YES |
| `resolve_journal_posting_account_id` | YES |
| `_journal_account_guard_resolve_public_core(uuid,uuid)` | YES |
| `repair_restore_journal_entry_line_account(...)` | YES |
| `trg_guard_journal_entry_line_account` | YES enabled |
| `trg_accounts_reject_company_reassign_with_lines` | YES enabled |
| `trg_journal_entries_reject_company_reassign` | YES enabled |

### ACL matrix

| Privilege | Result |
|-----------|--------|
| `authenticated` EXECUTE `resolve_journal_posting_account_id` | YES |
| `authenticated` EXECUTE `_journal_account_guard_resolve_public_core` | YES |
| `authenticated` EXECUTE `repair_restore_…` | NO |
| `authenticated` INSERT `_journal_account_repair_tickets` | NO |
| `anon` EXECUTE resolve / public_core / repair | NO |
| `service_role` EXECUTE public `repair_restore_…` | YES |
| `authenticated`/`anon`/`service_role` EXECUTE `_journal_account_guard_resolve_core` | NO |
| `authenticated`/`anon`/`service_role` EXECUTE `_journal_account_guard_resolve_internal` | NO |
| `authenticated`/`anon`/`service_role` EXECUTE `_repair_restore_…_internal` | NO |

### Automatic remaps

| Metric | Value |
|--------|--------|
| Company A remap rows | **33** |
| Source `backup_coa_merge_20260916.merge_pairs` | **33** |
| IBRAHIM `210026` → `AP-SUPZHD0026` | PRESENT — `from=3f1440dd-…` `to=2c56a1d1-…` contact `08592090-…` / `SUP-ZHD-0026` / **IBRAHIM BNRS** |

Script: `deploy/staging-je-guard/prod-post-migrate-verify.sql`

---

## 4. Non-mutating production Auth / PostgREST matrix

Path: production Kong loopback `http://127.0.0.1:8000` (same stack as `supabase.dincouture.pk`). Short-lived JWT minted with production `JWT_SECRET` for an existing company-A `public.users.auth_user_id` (no new users; no JE writes).

| Case | Result |
|------|--------|
| Same-company active resolve | PASS HTTP 200 → cash account id |
| Cross-company resolve | PASS HTTP 403 `JOURNAL_ACCOUNT_FORBIDDEN` |
| Direct `public_core` cross-company | PASS HTTP 403 `JOURNAL_ACCOUNT_FORBIDDEN` |
| Authenticated `repair_restore_…` | PASS HTTP 403 permission denied |
| GUC / role spoof → repair | PASS `insufficient_privilege` |

Marker: `AUTH_MATRIX_OK`  
Script: `deploy/staging-je-guard/run-prod-auth-matrix.sh`

---

## 5. Production health / regression

| Check | Result |
|------|--------|
| `supabase-kong` | Up (healthy) |
| `supabase-auth` | Up (healthy) |
| `supabase-rest` | Up |
| `supabase-db` | Up (healthy) |
| Kong REST / Auth settings | HTTP 200 |
| `https://erp.dincouture.pk/` | HTTP 200 |
| `https://supabase.dincouture.pk/rest/v1/` | HTTP 200 |
| `accounts` / `journal_entries` SELECT | HTTP 200 |
| Recent REST logs matching `JOURNAL_ACCOUNT`/`FATAL`/`panic` (30m) | **0** |

Marker: `HEALTH_OK`  
No artificial money transactions created. Services not restarted.

---

## 6. Historical scope confirmations

| Confirmation | Status |
|--------------|--------|
| IBRAHIM JE-0137 / JE-0138 line `account_id` still legacy `210026` | **NOT MODIFIED** |
| Amounts 19000 / 99275 unchanged | YES |
| `backup_coa_limited_ibrahim_v1` created by this phase? | **NO** (still ABSENT) |
| ID LACE | **NOT IMPLEMENTED** |

---

## Stop line

Even with **PASS**, this phase stops here.

Next owner phrase required for historical repair (separate approval):

`run IBRAHIM Class B backup/apply repair on production after migration verification`
