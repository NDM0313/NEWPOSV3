# LIMITED_RLS_QA.md

Generated: 2026-07-17 (operational gates)

**Overall:** `NOT_RUN_CREDENTIAL_GATED`

## Why

1. Env vars `QA_BROWSER_EMAIL_LIMITED` / `QA_BROWSER_PASSWORD_LIMITED` are **MISSING**.
2. Read-only production inventory shows active roles **`admin` and `salesman` only** — no active limited/easy/`user` role accounts found.
3. No user was created (explicitly forbidden without approval).

| Scenario | Status |
|----------|--------|
| login | **NOT_RUN_CREDENTIAL_GATED** |
| easy_subset | **NOT_RUN_CREDENTIAL_GATED** |
| full_accounting_restricted | **NOT_RUN_CREDENTIAL_GATED** |
| direct_bypass | **NOT_RUN_CREDENTIAL_GATED** |
| cross_company | **NOT_RUN_CREDENTIAL_GATED** |
| denial_visible | **NOT_RUN_CREDENTIAL_GATED** |
| denial_not_zero | **NOT_RUN_CREDENTIAL_GATED** |
