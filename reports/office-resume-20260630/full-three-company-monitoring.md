# Full three-company monitoring — Office resume 2026-06-30

**Command:** `npm run monitor:three-company-unified-ledger`  
**Generated:** 2026-06-30

---

## Result

**BLOCKED_MISSING_QA_BROWSER_PASSWORDS** (exit code 1)

Credential validation failed before any profile run:

| Env var | Status |
|---------|--------|
| `QA_BROWSER_PASSWORD_CHINA` | **MISSING** |
| `QA_BROWSER_PASSWORD_BRIDAL` | **MISSING** |
| `QA_BROWSER_PASSWORD_COUTURE` | **MISSING** |

`ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK` was not set.

---

## Expected (when credentials available)

| Check | Expected |
|-------|----------|
| din-china | PASS |
| din-bridal | PASS |
| din-couture | PASS |
| other-company loaders | 0 |
| migrations_run | false |
| gl_mutations | false |

---

## Context

A prior office session on **2026-06-29** achieved **PASS** with per-company credentials (see `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-29T16-11-13-569Z.json`). The current agent shell does not inherit those session env vars.

---

## Remediation

In PowerShell (do not save passwords to repo):

```powershell
$env:QA_BROWSER_PASSWORD_CHINA = "<password>"
$env:QA_BROWSER_PASSWORD_BRIDAL = "<password>"
$env:QA_BROWSER_PASSWORD_COUTURE = "<password>"
npm run monitor:three-company-unified-ledger
```

See [`windows-task-scheduler-guide.md`](../single-core-ledger/operational-monitoring/windows-task-scheduler-guide.md).

**No passwords printed. No invented monitoring results.**
