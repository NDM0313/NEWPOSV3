# JE account guard — focused review-blocker evidence

- Verified: 2026-09-21
- Environment: GitHub Actions `ubuntu-latest` + isolated Docker `postgres:15`
- Verified code SHA: `d246e3805d1989b84dc7d8146a5a02ce0b6277ed`
- Passing run: https://github.com/NDM0313/NEWPOSV3/actions/runs/35595125995
- Production writes: **NONE**
- Production migration/repair: **NOT EXECUTED**
- Staging/JWT/UI E2E: **NOT EXECUTED / UNVERIFIED**
- Historical repair scope: **IBRAHIM only — 2 exact lines**
- ID LACE: **NOT_IMPLEMENTED**
- Other repair holds: **UNCHANGED**

## Review blocker 1 — privileged helper authorization

PASS on real PostgreSQL:

- Effective ACL inspection confirms authenticated can execute the intended public resolver/helper only; private resolve core, internal trigger resolver, repair internal helper, role helper/assert helper, and repair-ticket mutation are not client-executable.
- `SET ROLE authenticated` same-company public resolution succeeds.
- Direct authenticated call to `_journal_account_guard_resolve_public_core` for another company is rejected.
- Public resolver for another company is rejected.
- Unauthorized calls do not change journal line state.
- JWT/custom-GUC role spoofing does not elevate privileges.
- Privileged exact-line repair remains available to `service_role`.
- Marker: `HELPER_AUTH_REGRESSION_PASSED`
- Marker: `ACL_SET_ROLE_CHECKS_PASSED`

Authorization remains based on effective database role + caller company lookup, not a custom authorization GUC.

## Review blocker 2 — immutable/atomic backup package

The actual `repair-package/01_backup.sql` is exercised.

PASS:

- Fresh package creation is transaction-wrapped and serialized by transaction advisory lock.
- Exact Ibrahim lines are locked before snapshot.
- Forced fixture drift makes the actual backup fail with:
  `BACKUP_MANIFEST_COUNT 1 <> 2`
- That failed actual backup leaves no durable backup package:
  `ATOMIC_BACKUP_FAIL_PASSED`
- Clean actual backup succeeds with two Ibrahim lines:
  `BACKUP_OK`
- After actual apply creates post-apply evidence, rerunning the actual backup safely refuses overwrite:
  `BACKUP_EXISTS ... original backup/post_apply preserved`
- Fingerprint check confirms the original run id and post-apply evidence remain unchanged:
  `BACKUP_NONDESTRUCTIVE_REGRESSION_PASSED`

No backup evidence tables are dropped or overwritten by a rerun.

## Actual repair-script regression

The harness executes the repository scripts themselves rather than copied approximations:

1. Actual `01_backup.sql` forced validation failure — expected failure, atomic cleanup PASS.
2. Actual `01_backup.sql` normal backup — PASS.
3. Actual `02_apply.sql` — `APPLY_OK`, two Ibrahim lines moved.
4. Actual `02_apply.sql` repeated — `ALREADY_APPLIED`, safe no-op.
5. Actual `01_backup.sql` repeated after apply — `BACKUP_EXISTS`, original evidence preserved.
6. Drift injected into one applied line, then actual `03_rollback.sql` — expected `ROLLBACK_DRIFT`; transaction aborts without partial restore or evidence damage.
7. Fixture restored, actual `03_rollback.sql` — `ROLLBACK_OK`, exactly two lines restored.
8. Actual `03_rollback.sql` repeated — `ALREADY_ROLLED_BACK`, safe no-op.

Final isolated state confirms the two Ibrahim lines are back on legacy account `210026`.

## Delivery / integration limits

- This evidence proves PostgreSQL function ACL/security behavior and repair-package behavior in isolated PostgreSQL 15.
- It does **not** prove Supabase/PostgREST JWT behavior, staging UI behavior, or production integration.
- No production migration, production repair, deploy, merge, or production data mutation was performed.
- ID LACE remains **NOT_IMPLEMENTED**. DHL/KIRAN/SHAHMIM and other held repair scopes remain unchanged.
