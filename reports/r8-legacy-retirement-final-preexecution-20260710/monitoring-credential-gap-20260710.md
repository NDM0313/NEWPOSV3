# Monitoring credential gap — 2026-07-10

**Scope:** Fresh `npm run monitor:three-company-unified-ledger` on home Mac

## Result

| Check | Status |
|-------|--------|
| `QA_BROWSER_PASSWORD_CHINA` | UNSET (shell + `.env.local`) |
| `QA_BROWSER_PASSWORD_BRIDAL` | UNSET |
| `QA_BROWSER_PASSWORD_COUTURE` | UNSET |
| `QA_BROWSER_PASSWORD` | UNSET |
| `ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK` | UNSET |

**Full browser monitoring:** **NOT RUN** (credential validation failed)

## Partial validation completed (no passwords)

| Check | Status |
|-------|--------|
| Read-only loader guard (SSH SQL) | **PASS** |
| Production flag snapshot | **CAPTURED** — [`production-flag-snapshot-20260710.md`](./production-flag-snapshot-20260710.md) |
| Archived monitoring (2026-07-08) | **PASS** overall |

## Operator action before R8 execution day

Set per-company env (values **not** stored in repo):

```bash
export QA_BROWSER_PASSWORD_CHINA='...'
export QA_BROWSER_PASSWORD_BRIDAL='...'
export QA_BROWSER_PASSWORD_COUTURE='...'
npm run monitor:three-company-unified-ledger
```

Or on office machine where passwords were previously supplied (see `reports/single-core-engine-calendar-stability-official-*/password-env-status.md`).

**Passwords must never be printed, committed, or saved in reports.**
