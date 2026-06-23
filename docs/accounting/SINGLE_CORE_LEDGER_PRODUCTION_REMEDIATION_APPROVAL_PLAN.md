# Single Core Ledger — Production Remediation Approval Plan

**Status:** PROPOSAL ONLY — awaiting finance sign-off; **fresh clone validated** @ 2026-06-23  
**Prerequisite:** Fresh clone Gate A on `ledger_stage_20260623_prodcheck` — **PASSED**  
**Branch:** `feature/single-core-ledger-phase-1-6-2-production-approval`

See also: [`SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md)

---

## 1. Scope

Apply **metadata-only** repairs validated on **fresh** production snapshot:

| Repair | Table | Column | Fresh clone validated | Prod estimate |
|--------|-------|--------|----------------------|---------------|
| Payment contact backfill | `payments` | `contact_id` | **74** | **74** |
| Branch attribution (auto) | `journal_entries` | `branch_id` | **2** | **2** |
| Branch manual assignment | `journal_entries` | `branch_id` | **6** | **6** |
| **Total** | | | **82** | **82** |

**Out of scope:** AR/AP reclass, opening balance, void/reverse, GL lines, `unified_ledger_engine`, Phase 2 UI, Phase 1.5 prod migrations.

---

## 2. Production approval manifest

| Artifact | Value |
|----------|-------|
| JSON | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json` |
| CSV | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.csv` |
| SHA256 | `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd` |
| Dry-run SHA256 | `2533569453ace47b42e9da4004e9279b780930ad07d0c6af88631893d58e16d4` |
| Branch manifest SHA256 | `d06a4928bcf3c36d4c1b7394f183ff53cd9173105b97327cac3fc3d9173ebb55` |
| Fresh-clone comparison | `reports/single-core-ledger/fresh-clone-comparison-2026-06-23T18-13-49-433Z.json` |
| Comparison recommendation | **APPROVE_MANIFEST** (74 payment / 8 branch / 0 delta) |

Finance must sign CSV `finance_approval` column before production apply.

---

## 3. Backup plan (required before prod apply)

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7"
```

| Step | Action |
|------|--------|
| 1 | Run backup script |
| 2 | Verify dump exists: `/root/NEWPOSV3/backups/supabase_db_YYYYMMDD_HHMMSS.dump` |
| 3 | Optional: `pg_restore --list` on dump file |
| 4 | Record path as `PRODUCTION_BACKUP_ID` |
| 5 | **Abort prod apply if backup fails** |

---

## 4. Production metadata apply (future — not executed in Phase 1.6.2)

Script: [`scripts/ledger-remediation/apply-production-remediation.mjs`](scripts/ledger-remediation/apply-production-remediation.mjs)

```bash
export PRODUCTION_REMEDIATION_TARGET=1
export PRODUCTION_REMEDIATION_APPROVED=1
export PRODUCTION_BACKUP_ID=/root/NEWPOSV3/backups/supabase_db_YYYYMMDD_HHMMSS.dump
export DATABASE_URL="postgresql://postgres:***@172.19.0.15:5432/postgres"

node scripts/ledger-remediation/apply-production-remediation.mjs \
  --approval-manifest reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json \
  --expected-count 82
```

Guards: see [`production-remediation-env-guard.mjs`](scripts/ledger-remediation/production-remediation-env-guard.mjs)

---

## 5. Rollback

**Option A — Full restore:** Restore `postgres` from pre-apply backup dump.

**Option B — Selective reverse:** From `production-remediation-apply-before-*.json`:

```sql
UPDATE payments SET contact_id = NULL WHERE id IN (...);
UPDATE journal_entries SET branch_id = NULL WHERE id IN (...);
```

---

## 6. Post-production validation (after future prod apply)

1. Read-only inventory on production (no unified RPC required for payment/branch counts)
2. Smoke test ERP login + DIN CHINA ledger
3. Fresh clone from post-prod postgres → full Gate A
4. Confirm `unified_ledger_engine` still OFF
5. **Do not** start Phase 1.5 migrations or Phase 2 until post-prod validation passes

---

## 7. Phase boundaries

| Phase | Requires separate approval |
|-------|---------------------------|
| Production metadata (this plan) | Finance + backup + manifest SHA256 |
| Phase 1.5 migrations on `postgres` | **Yes** — after prod metadata validated |
| Phase 2 screen wiring | **Yes** — after Phase 1.5 prod + prod Gate A |
| `unified_ledger_engine` ON | **Yes** — explicit per-company rollout |

---

## 8. Explicit confirmations

- [x] Fresh clone Gate A passed (`ledger_stage_20260623_prodcheck`)
- [x] Pre-apply counts match baseline (74 payment / 8 branch)
- [ ] Finance sign-off on production approval CSV
- [ ] DB backup completed and `PRODUCTION_BACKUP_ID` recorded
- [ ] Production metadata apply executed (future phase)
- [ ] `unified_ledger_engine` remains **OFF**
- [ ] Phase 1.5 prod migrations **not applied**
- [ ] Phase 2 **not started**

---

## 9. Approval record

| Field | Value |
|-------|-------|
| Approved by | _pending_ |
| Fresh clone validation | 2026-06-23T18:10:32Z |
| Manifest SHA256 | `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd` |
| Backup ID | _pending_ |
| Production apply executed | _no_ |
