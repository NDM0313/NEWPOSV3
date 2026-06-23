# Single Core Ledger — Production Ready Pack

**Status:** `PRODUCTION METADATA APPLY COMPLETE` — post-apply Gate A **PASS**; validate before Phase 1.5 prod migrations  
**Branch:** `feature/single-core-ledger-phase-1-6-2-production-approval`  
**Last updated:** 2026-06-23T19:33:37Z  
**Master checklist:** use this file as the single entry point for post-apply status.

---

## Executive summary

| Gate | Status |
|------|--------|
| Fresh clone Gate A (`ledger_stage_20260623_prodcheck`) | **PASS** 3/3 |
| Tie-out (all companies) | **PASS** 9/9 |
| Baseline comparison | **APPROVE_MANIFEST** (0 delta) |
| Finance sign-off (82 rows) | **COMPLETE** — 82 approved, 0 rejected |
| Pre-remediation DB backup | **COMPLETE** |
| Production metadata apply | **EXECUTED** 2026-06-23T19:33:16Z — **82 rows** |
| Post-apply validation (fresh clone) | **PASS** — payment gaps 0, branch risk 0, Gate A 3/3, tie-out 9/9 |
| `unified_ledger_engine` | **OFF** |
| Phase 1.5 prod migrations | **NOT APPLIED** (separate approval) |
| Phase 2 screen wiring | **NOT STARTED** (separate approval) |

---

## Phase timeline (step by step)

### Phase 1.5 — Clone validation (complete)

| Step | What | Evidence |
|------|------|----------|
| 1.5.1 | Apply Phase 1.5 migrations on clone | `scripts/single-core-ledger/apply-phase-15-docker-exec.sh` |
| 1.5.2 | Unified diagnostics + tie-out on clone | [`SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md) |

### Phase 1.6 — Clone remediation (complete)

| Step | What | Rows |
|------|------|-----:|
| 1.6.1 | Payment `contact_id` backfill on clone | 74 |
| 1.6.2 | Branch auto `branch_id` on clone | 2 |
| 1.6.3 | Inventory + dry-run reports | `reports/single-core-ledger/remediation-*` |

See: [`SINGLE_CORE_LEDGER_PHASE_1_6_REMEDIATION_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_1_6_REMEDIATION_PLAN.md)

### Phase 1.6.1 — Manual branch resolution (complete)

| Step | What | Rows |
|------|------|-----:|
| 1.6.1.1 | Operator branch decisions (6 JEs) | 6 |
| 1.6.1.2 | Gate A after manual apply | **PASS** |

See: [`SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md`](SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md)

### Phase 1.6.2 — Fresh clone + approval pack (complete)

| Step | What | Status |
|------|------|--------|
| 1.6.2.1 | Fresh prodcheck clone from live `postgres` | `ledger_stage_20260623_prodcheck` |
| 1.6.2.2 | Re-run 1.5 + 1.6 + 1.6.1 on fresh clone | Gate A **PASS** |
| 1.6.2.3 | Baseline comparison vs original snapshot | **APPROVE_MANIFEST** |
| 1.6.2.4 | Production approval manifest export | 82 rows |
| 1.6.2.5 | Apply stub + guards (no prod execution) | Scripts only |

See: [`SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md)

### Finance sign-off pack (complete)

| Step | What | Status |
|------|------|--------|
| F.1 | Finance review CSV created | [`finance-signoff-production-remediation-2026-06-23.csv`](../reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv) |
| F.2 | Finance pack document | [`SINGLE_CORE_LEDGER_FINANCE_SIGNOFF_PACK.md`](SINGLE_CORE_LEDGER_FINANCE_SIGNOFF_PACK.md) |
| F.3 | All 82 rows marked `APPROVED` | 2026-06-23 (operator bulk approval) |
| F.4 | Rejected rows | **0** |

### Pre-apply backup (complete)

| Step | What | Value |
|------|------|-------|
| B.1 | VPS `pg_dump` (read-only) | 2026-06-23T19:24:08Z |
| B.2 | `PRODUCTION_BACKUP_ID` | `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` |
| B.3 | Verified | `pg_restore --list` OK (3489 TOC entries) |

See: [`SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md`](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md) § Backup record

### Production metadata apply (complete)

| Step | What | Result |
|------|------|--------|
| P.1 | Guarded apply on live `postgres` | **82 rows** updated |
| P.2 | Payment `contact_id` | **74** |
| P.3 | Branch `branch_id` (auto + manual) | **8** (2 + 6) |
| P.4 | GL amounts / journal lines | **Unchanged** |
| P.5 | Skipped rows | **0** |

| Artifact | Path |
|----------|------|
| Audit JSON | `reports/single-core-ledger/production-remediation-apply-audit-2026-06-23T19-33-16-625Z.json` |
| Before JSON | `reports/single-core-ledger/production-remediation-apply-before-2026-06-23T19-33-16-625Z.json` |
| After JSON | `reports/single-core-ledger/production-remediation-apply-after-2026-06-23T19-33-16-625Z.json` |
| Pre-apply backup | `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` |
| Apply timestamp (UTC) | `2026-06-23T19:33:16.625Z` |

### Post-apply validation (complete)

| Check | Result |
|-------|--------|
| Fresh clone from post-apply `postgres` | `ledger_stage_20260623_prodcheck` (recreated) |
| Payment contact gaps | **0** |
| Branch attribution risk | **0** |
| Gate A strict diagnostics | **PASS** 3/3 |
| Tie-out | **PASS** 9/9 |
| Post-apply inventory | `remediation-inventory-2026-06-23T19-33-37-224Z.json` |
| Post-apply diagnostics | `diagnostics-2026-06-23T19-33-37-532Z.json` |

---

## Production remediation manifest

| Field | Value |
|-------|-------|
| JSON | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json` |
| CSV | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.csv` |
| Finance CSV | `reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv` |
| Manifest SHA256 | `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd` |
| Payment contact backfill | **74** |
| Branch auto | **2** |
| Branch manual | **6** |
| **Total metadata rows** | **82** |
| Finance approved | **82** |
| Finance rejected | **0** |

**Metadata columns only:** `payments.contact_id`, `journal_entries.branch_id` — no GL amounts, no void/reverse.

---

## What is blocked (next phases)

| Action | Status |
|--------|--------|
| Phase 1.5 migrations on `postgres` | **Separate approval required** |
| `unified_ledger_engine` ON | **Blocked** |
| Phase 2 UI wiring | **Blocked** |
| Merge PR / deploy | **Ops decision** |

---

## Rollback

Full restore from:

`/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump`

Or selective reverse using `production-remediation-apply-before-*.json` from apply script output.

---

## Approval record

| Field | Value |
|-------|-------|
| Finance approved by | Operations (bulk approve all 82 rows) |
| Finance approval date | 2026-06-23 |
| Approved rows | **82** |
| Rejected rows | **0** |
| Manifest SHA256 | `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd` |
| Backup ID | `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` |
| Production apply executed | **Yes** — 2026-06-23T19:33:16.625Z |
| Applied rows | **82** (74 payment + 8 branch) |
| `unified_ledger_engine` | **OFF** |

---

## Next recommended step

1. Smoke test ERP login + DIN CHINA ledger on production  
2. Obtain **separate approval** for Phase 1.5 production migrations on `postgres`  
3. Do **not** enable `unified_ledger_engine` or start Phase 2 until Phase 1.5 prod + prod Gate A pass  

**Final status:** `PRODUCTION METADATA APPLY COMPLETE — validate before Phase 1.5 prod migrations`

## Related documents

| Document | Purpose |
|----------|---------|
| [Production remediation approval plan](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md) | Full approval + backup + apply procedure |
| [Finance sign-off pack](SINGLE_CORE_LEDGER_FINANCE_SIGNOFF_PACK.md) | Finance-readable scope and checklist |
| [Fresh clone validation (1.6.2)](SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md) | Prodcheck evidence |
| [Phase 1.6.1 branch manual](SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md) | 6 manual branch JEs |
| [Migration master plan](SINGLE_CORE_LEDGER_MIGRATION_MASTER_EXECUTION_PLAN_v3.md) | Full program context |
