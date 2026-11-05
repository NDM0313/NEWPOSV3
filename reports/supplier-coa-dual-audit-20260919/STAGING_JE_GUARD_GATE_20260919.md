# Staging JE account-guard validation gate — 2026-09-19

**Verdict: `READY_FOR_PRODUCTION_MIGRATION_APPROVAL`**

Gate commit baseline (required): `bd3ef2e0be966312725f4593fb8de8247dc79358` on `feat/party-je-guards-attributed-ledger`.

Hard stops honored:

- Live DB name `postgres` was never migrated/altered/tested for writes.
- No traffic to `https://supabase.dincouture.pk` / `erp.dincouture.pk` for gate HTTP.
- Cursor `user-supabase` MCP was not used for writes.
- Production `supabase-auth` / `supabase-rest` / `supabase-kong` / Realtime / Storage / live DB services were not restarted or modified.
- IBRAHIM `01_backup` / `02_apply` / `03_rollback` were **not** run as this gate’s pass condition.
- ID LACE remains **NOT IMPLEMENTED**.

---

## ISOLATED_DOCKER

Pointer only (not re-run; HEAD unchanged for guard migration):

- [`verification/EVIDENCE.md`](./verification/EVIDENCE.md) — isolated Postgres harness; cases + seed paths + ACL + repair fixtures PASS.

---

## STAGING_REAL_AUTH_UI

### Clone identity

| Check | Result |
|------|--------|
| Clone DB | `ledger_stage_20260919_prodcheck` |
| Size (post-migrate) | 244 MB |
| `current_database() = clone` | PASS |
| `current_database() <> 'postgres'` | PASS |
| Guard objects pre-migrate | ABSENT (proven during Phase 1) |
| Guard objects post-migrate | PRESENT (`resolve_journal_posting_account_id` = true after migrate) |
| Source | `pg_dump` from live `postgres` via `scripts/single-core-ledger/create-vps-ledger-clone.sh` (reuse; no live DROP/ALTER) |

### Temporary HTTP stack

| Item | Value |
|------|-------|
| Compose project | `je-guard-stage` (not `/root/supabase/docker`) |
| Auth bind | `127.0.0.1:18081` → GoTrue |
| REST bind | `127.0.0.1:18080` → PostgREST |
| DB URI target | **only** `ledger_stage_20260919_prodcheck` |
| JWT secret | staging-only (VPS `/root/je-guard-stage/.jwt_secret`, not git) |
| Production keys reused for signing? | **No** |
| Base URL assertion | `http://127.0.0.1:1808x` — **does not** match `*.dincouture.pk` |
| Feasibility | PASS (attached to `supabase_default` network; no prod compose changes) |
| Lifecycle | Containers **torn down** after evidence; clone DB **kept** |

Templates (no secrets): [`deploy/staging-je-guard/`](../../deploy/staging-je-guard/).

### Staging identities

| User | Company |
|------|---------|
| Company A (DIN / IBRAHIM company) | `e08a04af-22a8-4869-9b4d-da31fce13158` |
| Company B | `597a5292-…` (discovered on clone) |

- Real GoTrue password grant on staging Auth → JWT with `sub` linked via `public.users.auth_user_id`.
- `get_user_company_id()` resolved Company A under JWT (JWT matrix).

### Migration on clone only

- Applied: `migrations/20260919140000_journal_posting_account_guard_and_verified_remaps.sql` → `ledger_stage_20260919_prodcheck` only.
- Marker: `MIGRATE_ACL_OK`.
- Remap seed: 33 verified remaps from clone `backup_coa_merge_20260916.merge_pairs` (present on this clone).
- ACL (`has_function_privilege`):
  - `authenticated`: `resolve_journal_posting_account_id` YES; `_journal_account_guard_resolve_public_core` YES
  - `authenticated`/`anon`: core/internal/repair_internal/tickets INSERT NO
  - `service_role`: `repair_restore_journal_entry_line_account` YES; repair internal NO
- Trigger `trg_guard_journal_entry_line_account` present on clone.

### JWT / PostgREST matrix (`JWT_MATRIX_OK`)

| Case | Result |
|------|--------|
| A JWT → resolve(company A, active) | PASS |
| A JWT → resolve(company B, …) | PASS fail `403` / insufficient_privilege |
| A JWT → direct `public_core`(company B, …) | PASS fail `403` |
| A JWT → `repair_restore_…` | PASS fail `403` |
| GUC / JWT-text spoof | PASS (no repair elevation) |
| Staging `service_role` → repair on disposable fixture (rolled back) | PASS |

Tokens sanitized; not recorded.

### JE posting smoke (`POSTING_SMOKE_OK`)

Via staging PostgREST + user JWT (same insert path as app JE lines):

| Case | Result |
|------|--------|
| Valid same-company balanced JE (cash + AP leaf) | PASS |
| Valid supplier/AP leaf | PASS (same fixture) |
| Wrong-company `account_id` | PASS → `JOURNAL_ACCOUNT_WRONG_COMPANY` |
| Inactive without verified map | PASS → `JOURNAL_ACCOUNT_RETIRED` |
| Inactive + verified map → expected `AP-*` + guard event `journal_entry_line_id` | PASS |

Payment-path RPC `record_payment_with_accounting`: **skipped** (not required once five JE-line cases PASS; avoid extra money-path surface on clone).

---

## PRODUCTION_READ_ONLY

Executed: `psql -d postgres` SELECT / catalog only (SSH `dincouture-vps` → `supabase-db`). Script: [`deploy/staging-je-guard/prod-readonly-preflight.sql`](../../deploy/staging-je-guard/prod-readonly-preflight.sql).

| Check | Result |
|------|--------|
| `current_database() = postgres` | PASS |
| Guard resolve / public_core / remaps / events / trigger | **ALL ABSENT** (expected pre-prod-migrate) |
| IBRAHIM lines on legacy `210026` | PASS — `677c74de-…` JE-0137 Dr 19000; `343c2586-…` JE-0138 Dr 99275; non-void |
| Legacy account | `3f1440dd-…` code `210026` inactive, company DIN |
| Target AP | `2c56a1d1-…` code `AP-SUPZHD0026` active, linked contact `08592090-…` **IBRAHIM BNRS** / `SUP-ZHD-0026` |
| JE headers | JE-0137 / JE-0138 match manifest JE ids |
| `backup_coa_merge_20260916.merge_pairs` | PRESENT; IBRAHIM pair eligible |
| `backup_coa_limited_ibrahim_v1` meta/manifest/pre/post | **ABSENT** — no `BACKUP_EXISTS_REVIEW_REQUIRED` |
| ID LACE | `ID_LACE_NOT_IMPLEMENTED` (legacy + AP accounts exist; no repair applied) |

Production HTTP services remained healthy throughout; staging containers removed after gate.

---

## Risks / notes

1. Clone was restored with `--no-acl`; CONNECT/USAGE grants and GoTrue-as-`postgres` on clone were staging-only workarounds — **not** proposed for production.
2. Staging JWT secret briefly appeared in an early debug trace on VPS and was rotated before identity/JWT matrix; production secrets were not used for signing.
3. Gate disposable JE headers/lines remain on the **clone** only (audit trail); they are not production data.
4. This verdict does **not** authorize production migration or IBRAHIM repair.

---

## Next owner approval phrases (separate)

1. `migrate production database now for journal posting account guard only`
2. `run IBRAHIM Class B backup/apply repair on production after migration verification`

Do not conflate (1) and (2). Do not run repair until migration verification on production confirms objects/ACLs/triggers.
