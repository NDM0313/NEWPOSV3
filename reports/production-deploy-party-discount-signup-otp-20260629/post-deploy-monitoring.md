# Post-deploy monitoring

**Generated:** 2026-06-29

---

## `npm run monitor:three-company-unified-ledger`

**BLOCKED** — missing per-company credentials on Home MacBook:

- `QA_BROWSER_PASSWORD_CHINA`
- `QA_BROWSER_PASSWORD_BRIDAL`
- `QA_BROWSER_PASSWORD_COUTURE`

---

## Read-only loader guard (VPS SQL)

Executed `three-company-loader-guard-pipe.sql` via SSH:

| Company | Loaders on |
|---------|------------|
| DIN BRIDAL | 6 |
| DIN CHINA | 6 |
| DIN COUTURE | 6 |

| Check | Result |
|-------|--------|
| Other-company loaders | **0** |
| migrations_run | **false** (no migrations in deploy) |
| gl_mutations | **false** (no GL changes in deploy) |

---

## Result

**PARTIAL** — loader guard **PASS**; full three-company browser monitoring **BLOCKED_CREDENTIALS**.
