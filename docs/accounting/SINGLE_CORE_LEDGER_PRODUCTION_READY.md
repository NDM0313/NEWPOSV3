# Single Core Ledger — Production Ready Pack

**Status:** `PHASE 2.9A LIVE WAIVER CHECKS PASS WITH LIMITED WAIVERS` — DB gates clear; preview UI not on prod ERP  
**Branch:** `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` @ `fe1b9c15`  
**Last updated:** 2026-06-25  
**Master checklist:** use this file as the single entry point for post-apply status.

---

## Executive summary

| Gate | Status |
|------|--------|
| Fresh clone Gate A (`ledger_stage_20260625_prodcheck`) | **PASS** 3/3 |
| Tie-out (all companies) | **PASS** 9/9 |
| Baseline comparison | **APPROVE_MANIFEST** (0 delta) |
| Finance sign-off (82 rows) | **COMPLETE** — 82 approved, 0 rejected |
| Pre-remediation DB backup | **COMPLETE** |
| Production metadata apply | **EXECUTED** 2026-06-23T19:33:16Z — **82 rows** |
| Post-apply validation (fresh clone) | **PASS** — payment gaps 0, branch risk 0, Gate A 3/3, tie-out 9/9 |
| Production smoke test (1.7) | **PASS** 10/10 |
| `unified_ledger_engine` | **OFF** |
| Phase 1.5 prod migration pack | **READY** — guarded apply not executed in 1.7 |
| Phase 1.5 post-migration Gate A (1.8) | **PASS** 3/3 on `ledger_stage_20260625_prodcheck` |
| Phase 2 rollout plan | **READY** — plan on rollout branch |
| Phase 2.1 flags + banners | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_1_FLAGS_BANNERS_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_1_FLAGS_BANNERS_REPORT.md) |
| Phase 2.2 admin compare | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_2_ADMIN_COMPARE_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_2_ADMIN_COMPARE_REPORT.md) |
| Phase 2.3 Ledger V2 preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_3_LEDGER_V2_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_3_LEDGER_V2_PREVIEW_REPORT.md) |
| Phase 2.4 Account Statement preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_4_ACCOUNT_STATEMENT_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_4_ACCOUNT_STATEMENT_PREVIEW_REPORT.md) |
| Phase 2.5 Trial Balance preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_5_TRIAL_BALANCE_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_5_TRIAL_BALANCE_PREVIEW_REPORT.md) |
| Phase 2.6 Roznamcha preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_6_ROZNAMCHA_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_6_ROZNAMCHA_PREVIEW_REPORT.md) |
| Phase 2.7 Party Ledger preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_7_PARTY_LEDGER_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_7_PARTY_LEDGER_PREVIEW_REPORT.md) |
| Phase 2.8 Preview QA sign-off | **SIGNED OFF WITH WAIVERS** — see [`SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md`](SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md) |
| Phase 2.9 DIN CHINA pilot plan | **PLAN READY** — see [`SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md) |
| Phase 2.9A live waiver ops check | **PASS WITH LIMITED WAIVERS** — see [`pre-flag/live-waiver-checks.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/live-waiver-checks.md) |
| Phase 2.9A-2 browser waiver closure | **BLOCKED on prod** — preview UI not deployed; see [`browser-waiver-closure/`](../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/browser-waiver-closure/) |
| Phase 2 screen wiring | **COMPLETE** — all planned preview toggles shipped; engine enablement separate |

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

## Phase 1.7 — Smoke test + Phase 1.5 migration approval pack (complete)

| Step | What | Status |
|------|------|--------|
| 1.7.1 | Production smoke test report | **PASS** 10/10 — [`SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md`](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) |
| 1.7.2 | Phase 1.5 production migration plan | [`SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md) |
| 1.7.3 | Production Phase 1.5 guards + apply script | `production-phase-15-env-guard.mjs`, `apply-phase-15-production-docker-exec.sh` |
| 1.7.4 | Post-metadata pre-migration backup | `/root/NEWPOSV3/backups/supabase_db_20260623_194317.dump` |
| 1.7.5 | Guarded Phase 1.5 apply on `postgres` | **NOT EXECUTED** — await operator approval |
| 1.7.6 | Post-migration Gate A + tie-out on prod/clone | **PASS** @ 1.8 — `ledger_stage_20260625_prodcheck` |

**Pre-flight note (2026-06-23):** Live `postgres` already has all 4 Phase 1.5 files in `schema_migrations` and **5/5** unified RPCs. Guarded apply is idempotent (`[SKIP]`).

**Branch:** `feature/single-core-ledger-phase-1-7-prod-migration-plan`

### Phase 1.8 — Formal post-migration revalidation (complete)

| Step | What | Status |
|------|------|--------|
| 1.8.1 | Production read-only verify | **PASS** — 4/4 migrations, 5/5 RPCs, engine OFF |
| 1.8.2 | Fresh clone from live `postgres` | `ledger_stage_20260625_prodcheck` |
| 1.8.3 | Read-only inventory | Payment gaps **0**, branch risk **0** |
| 1.8.4 | Gate A strict diagnostics | **PASS** 3/3 |
| 1.8.5 | Tie-out (pilot + all-company) | **PASS** 9/9 |
| 1.8.6 | MR JALIL balance | **PKR 216,300.00** |
| 1.8.7 | Production DB mutation | **None** |

See: [`SINGLE_CORE_LEDGER_PHASE_1_8_POST_MIGRATION_VALIDATION_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_1_8_POST_MIGRATION_VALIDATION_REPORT.md)

**Branch:** `feature/single-core-ledger-phase-1-8-post-migration-validation`

### Phase 2 — Screen wiring + controlled rollout (plan ready)

| Step | What | Status |
|------|------|--------|
| 2.0.1 | Rollout plan document | [`SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md) |
| 2.0.2 | Screen inventory + wiring order | Defined — 15 screens, PRs 2.1–2.10 |
| 2.0.3 | Feature flag + pilot design | Documented — engine OFF by default |
| 2.1+ | Preview wiring implementation | **BLOCKED** until plan approved |

**Branch:** `feature/single-core-ledger-phase-2-rollout-plan`

---

## What is blocked (next phases)

| Action | Status |
|--------|--------|
| Phase 1.5 migrations on `postgres` | **Present** (4/4) — validated @ 1.8 |
| `unified_ledger_engine` ON | **Blocked** |
| Phase 2 UI wiring | **Blocked** — plan ready; implementation awaits approval |
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

1. ~~Phase 2 preview wiring (2.1–2.7)~~ **Done** — all six preview surfaces shipped  
2. ~~Phase 2.8 full preview QA pack~~ **Done** — 112/112 tests, build PASS; live UI waivers documented  
3. ~~Phase 2.9 pilot enablement plan~~ **Done** — Ledger V2 / DIN CHINA staged flag plan + rollback runbook  
4. ~~Phase 2.9A ops check (read-only)~~ **Done** — flags OFF + MR JALIL 216,300 RPC PASS  
5. ~~Phase 2.9A-2 browser check~~ **Done** — prod ERP lacks preview UI; deploy required before live session  
6. **Ops:** Deploy preview-capable build (staging/ERP) — **no flags** — then authenticated browser waiver session  
7. **Ops:** Approve Stage 1 then Stage 2 flag SQL — **separate ticket**; no auto-enable  
8. Do **not** enable flags, merge to `main`, or deploy unified-default without ops approval  

**Final status:** `PHASE 2.9A LIVE WAIVER CHECKS PASS WITH LIMITED WAIVERS — review before Stage 1`

## Related documents

| Document | Purpose |
|----------|---------|
| [Production remediation approval plan](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md) | Full approval + backup + apply procedure |
| [Finance sign-off pack](SINGLE_CORE_LEDGER_FINANCE_SIGNOFF_PACK.md) | Finance-readable scope and checklist |
| [Fresh clone validation (1.6.2)](SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md) | Prodcheck evidence |
| [Phase 1.6.1 branch manual](SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md) | 6 manual branch JEs |
| [Smoke test report (1.7)](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) | Production smoke 10/10 |
| [Phase 1.5 production migration plan](SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md) | Migration approval pack |
| [Phase 1.8 post-migration validation](SINGLE_CORE_LEDGER_PHASE_1_8_POST_MIGRATION_VALIDATION_REPORT.md) | Gate A + tie-out PASS |
| [Phase 2 rollout plan](SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md) | Screen wiring + controlled engine rollout |
| [Phase 2.8 preview QA sign-off](SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md) | Cross-screen QA + parity evidence |
| [Phase 2.9 pilot enablement plan](SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md) | DIN CHINA Ledger V2 staged flags + rollback |
