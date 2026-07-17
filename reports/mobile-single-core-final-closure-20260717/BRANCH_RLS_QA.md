# BRANCH_RLS_QA.md

Generated: 2026-07-17 (operational gates)

**Overall:** `NOT_RUN_CREDENTIAL_GATED`

## Why

1. Env vars `QA_BROWSER_EMAIL_BRANCH` / `QA_BROWSER_PASSWORD_BRANCH` are **MISSING**.
2. Read-only inventory: all active salesmen have **0** `user_branches` rows; only admins have branch rows (1 each). No approved non-admin branch-restricted QA credential available.
3. No user/permission changes performed.

| Scenario | Status |
|----------|--------|
| own_branch_ok | **NOT_RUN_CREDENTIAL_GATED** |
| other_branch_denied | **NOT_RUN_CREDENTIAL_GATED** |
| company_wide_null_denied | **NOT_RUN_CREDENTIAL_GATED** |
| branch_switch_no_stale | **NOT_RUN_CREDENTIAL_GATED** |
| logout_clears | **NOT_RUN_CREDENTIAL_GATED** |
