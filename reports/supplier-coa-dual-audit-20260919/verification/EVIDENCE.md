# JE account guard â€” isolated Postgres evidence

- Generated: 2026-09-21T12:31:31Z
- Production writes: none
- Runner: Docker postgres:15 (PowerShell harness)
- Base commit focus: helper self-auth + non-destructive backup

## minimal_schema
- minimal_schema: OK

NOTICE:  journal_account_verified_remaps: backup merge_pairs ABSENT — seed skipped (0 rows). AUTOMATIC remap scope empty until backup present or manual verified inserts.
COMMIT
## cases
NOTICE:  PASS: retired without remap rejected
NOTICE:  PASS: insert remapped + event with line_id
NOTICE:  PASS: non-key update preserved account
NOTICE:  PASS: explicit same active account_id update ok
NOTICE:  PASS: wrong-company rejected
NOTICE:  PASS: journal_entry_id reassignment revalidated
NOTICE:  PASS: conflicting second insert unique-blocked
NOTICE:  PASS: remap identity mismatch rejected
NOTICE:  PASS: legacy→worker role remap rejected
NOTICE:  PASS: GUC spoof did not grant inactive restore (account=2c56a1d1-e31d-433f-85af-ce3fd4729312)
NOTICE:  PASS: privileged repair_restore inactive path
NOTICE:  PASS: account company reassign blocked
NOTICE:  PASS: JE company reassign blocked
NOTICE:  PASS: legitimate supplier/worker/courier posting + balance triggers
NOTICE:  PASS: resolver after trigger in same txn
NOTICE:  ALL_ISOLATED_CHECKS_PASSED
- cases: OK

## seed_paths
NOTICE:  SEED_STATE: backup_source_rows=0 (missing-backup migrate left automatic seed empty)
NOTICE:  table "merge_pairs" does not exist, skipping
NOTICE:  PASS: seed identity mismatch detected (AP link wrong)
NOTICE:  PASS: conflicting seed would fail reviewably (existing=cccccccc-cccc-cccc-cccc-ccccccccccc1 backup wants=2c56a1d1-e31d-433f-85af-ce3fd4729312)
NOTICE:  PASS: backup-present seed path restored correct AUTOMATIC map
NOTICE:  PASS: repeat migration seed identical_skip
NOTICE:  PASS: backup-present seed re-run eligible=1 inserted=0 identical_skip=1
NOTICE:  SEED_PATH_CHECKS_PASSED
- seed_paths: OK

## acl_set_role
NOTICE:  PASS: catalog ACLs (resolve+public_core auth yes; internals no; service_role repair yes)
NOTICE:  PASS: SET ROLE authenticated cross-company resolve forbidden
NOTICE:  PASS: SET ROLE authenticated unauthorized restore rejected
NOTICE:  PASS: JWT/GUC spoof as authenticated did not change current_user=authenticated
NOTICE:  PASS: SET ROLE service_role repair_restore ok
NOTICE:  ACL_SET_ROLE_CHECKS_PASSED
- acl_set_role: OK

## helper_auth
NOTICE:  PASS: helper ACLs — public_core granted; core/internal/repair_internal/assert/tickets not client-executable
NOTICE:  PASS: same-company resolve + direct public_core
NOTICE:  PASS: direct public_core cross-company forbidden
NOTICE:  PASS: resolve cross-company forbidden
NOTICE:  PASS: unauthorized helper calls changed no state
NOTICE:  HELPER_AUTH_REGRESSION_PASSED
- helper_auth: OK

## atomic_backup_prepare
NOTICE:  ATOMIC_BACKUP_PREPARED: actual backup must fail validation
- atomic_backup_prepare: OK

## repair_01_backup_forced_validation_fail
ERROR:  BACKUP_MANIFEST_COUNT 1 <> 2 — lines drifted or wrong company/account/entry_no (transaction will roll back; no evidence left)
- repair_01_backup_forced_validation_fail: EXPECTED_FAILURE_OK (BACKUP_MANIFEST_COUNT)

## atomic_backup_verify_restore
NOTICE:  ATOMIC_BACKUP_FAIL_PASSED: actual 01_backup.sql failed with no durable package
- atomic_backup_verify_restore: OK

## repair_preamble
NOTICE:  PASS: missing backup apply aborted
NOTICE:  REPAIR_SCRIPT_PREAMBLE_OK
- repair_preamble: OK

## repair_01_backup
NOTICE:  BACKUP_OK: durable schema backup_coa_limited_ibrahim_v1 run_id=ibrahim_v1_20260921123143 with 2 IBRAHIM lines (ID LACE=NOT_IMPLEMENTED)
- repair_01_backup: OK

## repair_02_apply
NOTICE:  table "post_apply_lines" does not exist, skipping
NOTICE:  APPLY_OK: moved 2 IBRAHIM lines; legacy_net_before_move_context=118275.00 ap_before=0 ap_after=118275.00
- repair_02_apply: OK

## repair_02_apply_repeat
NOTICE:  ALREADY_APPLIED: IBRAHIM 2 lines already on AP — safe no-op stop
- repair_02_apply_repeat: OK

## backup_prerun
NOTICE:  PRE_RERUN_BACKUP: run_id=ibrahim_v1_20260921123143 post_apply=2
- backup_prerun: OK

## repair_01_backup_rerun
NOTICE:  BACKUP_EXISTS: schema backup_coa_limited_ibrahim_v1 already has evidence — refuse overwrite (original backup/post_apply preserved). Safe no-op stop.
- repair_01_backup_rerun: OK

## backup_nondestructive
NOTICE:  PASS: backup rerun preserved run_id=ibrahim_v1_20260921123143 post_apply=2 created_at=2026-09-21 12:31:43.450912+00
NOTICE:  PASS: validation/exists path would refuse before destructive mutation
NOTICE:  BACKUP_NONDESTRUCTIVE_REGRESSION_PASSED
- backup_nondestructive: OK

## repair_post
NOTICE:  PASS: actual apply moved 2 IBRAHIM lines and repeat apply was exercised by harness
NOTICE:  REPAIR_POST_APPLY_VERIFIED
- repair_post: OK

## rollback_drift_prepare
NOTICE:  ROLLBACK_DRIFT_PREPARED
- rollback_drift_prepare: OK

## repair_03_rollback_drift
ERROR:  ROLLBACK_DRIFT: line 677c74de-b677-4a6f-877f-b13e0ac66aaa edited after apply — abort (will not move blindly)
- repair_03_rollback_drift: EXPECTED_FAILURE_OK (ROLLBACK_DRIFT)

## rollback_drift_verify_restore
NOTICE:  ROLLBACK_DRIFT_ACTUAL_SCRIPT_PASSED: actual 03_rollback.sql rejected drift atomically
- rollback_drift_verify_restore: OK

## repair_03_rollback
NOTICE:  ROLLBACK_OK: restored 2 IBRAHIM lines via repair_restore
- repair_03_rollback: OK

## repair_03_rollback_repeat
NOTICE:  ALREADY_ROLLED_BACK: safe no-op stop
- repair_03_rollback_repeat: OK

## Scope notes
- AUTOMATIC remap scope: journal_account_verified_remaps
- HISTORICAL repair scope: IBRAHIM 2 lines (backup_coa_limited_ibrahim_v1)
- ID LACE: NOT_IMPLEMENTED
- Staging JWT/PostgREST: PASS (2026-09-21 loopback stack; see PRODUCTION_READINESS_DECISION_20260921.md)
- Staging application/UI E2E: UNVERIFIED
- Production migrate/repair: already present on live postgres (this phase: read-only only; no new production mutations)
  code  | count 
--------+-------
 210026 |     2
(1 row)


