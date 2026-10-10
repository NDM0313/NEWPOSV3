# Full three-company monitoring — Office resume 2026-06-30 (retry)

**Command:** `npm run monitor:three-company-unified-ledger`  
**Generated:** 2026-06-30 (retry after credentials added)

---

## Result

**PASS** (exit code 0)

| Profile | Result | Checks |
|---------|--------|--------|
| din-china | **PASS** | 19/19 |
| din-bridal | **PASS** | 18/19 (Admin Compare waived) |
| din-couture | **PASS** | 18/19 (Admin Compare waived) |

| Guard | Result |
|-------|--------|
| Other-company loaders | **0** |
| migrations_run | **false** |
| gl_mutations | **false** |
| Flag guard | **PASS** — DIN CHINA / BRIDAL / COUTURE only (6 loaders each) |

**Evidence:** `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-30T06-58-58-962Z.json`

---

## Credential note

Passwords were loaded from `erp-mobile-app/.env` into the PowerShell session before running. Monitoring scripts do **not** auto-load `.env` files — use session env vars or root `.env.local` with `KEY=value` format for future runs.

**Do not commit passwords to git.**
