# Single Core Ledger — Phase 1.5 Production Migration Plan

**Status:** `APPROVAL PACK READY` — smoke test **PASS**; guarded apply script ready; **await operator approval for apply/re-validate**  
**Branch:** `feature/single-core-ledger-phase-1-7-prod-migration-plan`  
**Last updated:** 2026-06-23T19:43:00Z  
**Prerequisite:** [`SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md`](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) — **ALL PASS** 10/10

---

## 1. Scope

Apply **Phase 1.5 unified-ledger RPC + diagnostics + indexes** to live `postgres` on VPS.

| In scope | Out of scope |
|----------|----------------|
| 4 named migration files (below) | `DROP TABLE` / money-table `ALTER` |
| `CREATE OR REPLACE FUNCTION` RPCs | `unified_ledger_engine` enablement |
| `CREATE INDEX IF NOT EXISTS` | Phase 2 UI screen wiring |
| Idempotent `schema_migrations` tracking | Merge / deploy |

**Data safety:** Migrations use `CREATE OR REPLACE` and `CREATE INDEX IF NOT EXISTS` only — no business-row `UPDATE`/`DELETE`.

---

## 2. Migration allowlist (canonical order)

| # | File | SHA256 (file body) | Delivers |
|---|------|-------------------|----------|
| 1 | `migrations/20260620140000_get_unified_party_ledger_shadow.sql` | `f222f2080294c60169af74edc40881d97b36e64642ff0dca9ca3b6ceddace1df` | `get_unified_party_ledger`, `get_unified_account_ledger` |
| 2 | `migrations/20260621120000_single_core_ledger_systemwide_diagnostics.sql` | `030cc6d96d7122a0326159016d6d5f39bba84cc985259ca7421f4d2108c394d9` | `get_single_core_ledger_systemwide_diagnostics` |
| 3 | `migrations/20260621150000_unified_ledger_phase_15_rpcs.sql` | `fa6a29416498d52324191a0caa570670d39a933b9fa50b9a39407c3cd2d6250f` | Hardened party/account/cash/trial-balance RPCs |
| 4 | `migrations/20260621151000_unified_ledger_phase_15_indexes.sql` | `2ebd63ec802a273aef90d699cbb361b1cf6ceb89259f31d026321e2f08f27bf9` | Performance indexes on JE/JEL/payments/accounts |

**Bundle manifest SHA256** (ordered JSON `{ migrations: [{file, sha256}, ...] }`):  
`1d2af87d4670614baeacaf4b6cd710a783bd1c894d0234f0e13b3480d5632dc8`

**Excluded from bundle:** `migrations/20260621120000_drop_duplicate_party_gl_balances_overload.sql` — requires separate review (`DROP FUNCTION`).

---

## 3. Pre-flight production state (2026-06-23)

Read-only check on live `postgres` before this pack was finalized:

| Check | Result |
|-------|--------|
| `schema_migrations` — 4 Phase 1.5 files | **All 4 present** |
| RPC verify (5 functions) | **5/5** exist |
| `unified_ledger_engine` (DIN CHINA) | **absent** (OFF) |

**Interpretation:** Phase 1.5 objects appear **already applied** on production (likely prior VPS apply). The guarded production script is **idempotent** — re-run skips applied files. **Post-migration Gate A + tie-out on a fresh post-metadata clone** is still required before engine enablement or Phase 2.

---

## 4. Backup record (post-metadata, pre-migration)

| Field | Value |
|-------|-------|
| `PHASE_15_PRODUCTION_BACKUP_ID` | `/root/NEWPOSV3/backups/supabase_db_20260623_194317.dump` |
| Created (UTC) | 2026-06-23T19:43:17Z |
| Size | ~11 MB |
| Verified | `pg_restore --list` OK (**3497** TOC entries) |
| Host | `dincouture-vps` / container `supabase-db` |
| Retention | 7 days (script default) |

**Command used:**

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7"
```

**Prior backup (pre-metadata):** `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` — retain until post-migration validation passes.

**Abort rule:** Do not run guarded apply if backup fails verification.

---

## 5. Guards and apply script

| Artifact | Path |
|----------|------|
| Env guard | [`scripts/single-core-ledger/production-phase-15-env-guard.mjs`](../../scripts/single-core-ledger/production-phase-15-env-guard.mjs) |
| Production apply | [`scripts/single-core-ledger/apply-phase-15-production-docker-exec.sh`](../../scripts/single-core-ledger/apply-phase-15-production-docker-exec.sh) |
| Clone apply (reference) | [`scripts/single-core-ledger/apply-phase-15-docker-exec.sh`](../../scripts/single-core-ledger/apply-phase-15-docker-exec.sh) |
| RPC verify | [`scripts/single-core-ledger/verify-phase-15-rpcs.sql`](../../scripts/single-core-ledger/verify-phase-15-rpcs.sql) |

### Required environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `PHASE_15_PRODUCTION_TARGET` | `1` | Confirms live postgres target |
| `PHASE_15_PRODUCTION_APPROVED` | `1` | Operator approval |
| `PHASE_15_PRODUCTION_BACKUP_ID` | path | Verified dump path on VPS |
| `TARGET_DB` | `postgres` | Production database name |
| `DATABASE_URL` | connection string | Must point at `postgres` DB |

**Rejected flags:** `UNIFIED_LEDGER_VPS_CLONE=1`, `UNIFIED_LEDGER_STAGING=1`

### Future apply command (operator only — not executed in Phase 1.7 pack)

```bash
export PHASE_15_PRODUCTION_TARGET=1
export PHASE_15_PRODUCTION_APPROVED=1
export PHASE_15_PRODUCTION_BACKUP_ID=/root/NEWPOSV3/backups/supabase_db_20260623_194317.dump
export TARGET_DB=postgres

ssh dincouture-vps "cd /root/NEWPOSV3 && bash scripts/single-core-ledger/apply-phase-15-production-docker-exec.sh"
```

Password: read from `/root/supabase/docker/.env` on VPS only — **never log**.

---

## 6. Post-migration validation (after apply / re-validate)

| Layer | Check | Target |
|-------|-------|--------|
| A | `verify-phase-15-rpcs.sql` on `postgres` | **5/5** functions |
| A | `get_single_core_ledger_systemwide_diagnostics()` | `strict_pass_count = 3`, payment gaps **0**, branch risk **0** |
| A | `unified_ledger_engine` | **OFF** / absent |
| B | Fresh clone from post-migration `postgres` | `RECREATE=1 CLONE_DB=ledger_stage_YYYYMMDD_prodcheck bash create-vps-ledger-clone.sh` |
| B | Gate A + tie-out on clone | **PASS** 3/3 + **PASS** 9/9 |

Docs to update after validation: [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](SINGLE_CORE_LEDGER_PRODUCTION_READY.md), diagnostic/tie-out reports under `reports/single-core-ledger/`.

---

## 7. Rollback

**Preferred:** Drop Phase 1.5 objects only (functions + indexes) — exact SQL to be generated from migration files before any destructive rollback.

**Last resort:** Full restore from `PHASE_15_PRODUCTION_BACKUP_ID`.

Metadata remediation rollback remains separate (`production-remediation-apply-before-*.json`).

---

## 8. Feature flag boundary

| Rule | Detail |
|------|--------|
| After Phase 1.5 | `unified_ledger_engine` **remains OFF** |
| Code default | `UNIFIED_LEDGER_ENGINE_DEFAULT = false` |
| UI | Legacy ledger paths until Phase 2 approval |

---

## 9. Approval record

| Field | Value |
|-------|-------|
| Smoke test | **PASS** 10/10 — [`SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md`](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) |
| Post-metadata backup | `/root/NEWPOSV3/backups/supabase_db_20260623_194317.dump` |
| Production apply executed (Phase 1.7) | **No** — pack only |
| Operator approval for apply | **Pending** |
| Finance approval for apply | **Pending** |

### Sign-off (apply authorization)

| Role | Approve Phase 1.5 apply? | Name | Date |
|------|---------------------------|------|------|
| Operator | ☐ | | |
| Finance | ☐ | | |

---

## Related documents

| Document | Purpose |
|----------|---------|
| [Production ready pack](SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Master status |
| [Smoke test report](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) | Pre-migration gate |
| [Remediation approval plan](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md) | Prior metadata apply |
