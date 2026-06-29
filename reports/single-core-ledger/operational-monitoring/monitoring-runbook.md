# Three-company unified ledger — operational monitoring runbook

**Program:** OLD ERP Single Core Ledger  
**Production:** https://erp.dincouture.pk  
**Last updated:** 2026-06-29  
**Commit reconciliation:** `0a818da2` baseline · `50547061` monitoring automation · `9586e611` credential hardening · password rotation COMPLETE · post-rotation monitoring PASS @ 2026-06-29 (office PC)

---

## Ops schedule pack (closure)

| Doc | Purpose |
|-----|---------|
| [`scheduled-monitoring-ops-pack.md`](scheduled-monitoring-ops-pack.md) | Daily/weekly frequency, PASS criteria, escalation |
| [`windows-task-scheduler-guide.md`](windows-task-scheduler-guide.md) | Local Windows scheduling |
| [`vps-cron-monitoring-guide.md`](vps-cron-monitoring-guide.md) | Future VPS cron (docs only) |
| [`monitoring-incident-response-runbook.md`](monitoring-incident-response-runbook.md) | Incident decision tree |
| [`password-rotation-closure.md`](password-rotation-closure.md) | **PASSWORD_ROTATION_COMPLETE** |
| [`password-rotation-final-closure-manifest.json`](password-rotation-final-closure-manifest.json) | Final closure manifest |
| [`three-company-monitoring-2026-06-29T07-42-30-177Z.json`](three-company-monitoring-2026-06-29T07-42-30-177Z.json) | Office PC post-rotation evidence |
| [`ops-schedule-closure-report.md`](ops-schedule-closure-report.md) | Closure manifest |

---

## Purpose

Periodic read-only verification that DIN CHINA, DIN BRIDAL, and DIN COUTURE unified loaders remain live and golden report totals match finance-approved fixtures.

---

## Credential policy (hardened)

**Preferred:** per-company env vars (never commit, never log password values):

| Profile | Email env | Password env |
|---------|-----------|--------------|
| din-china | `QA_BROWSER_EMAIL_CHINA` | `QA_BROWSER_PASSWORD_CHINA` |
| din-bridal | `QA_BROWSER_EMAIL_BRIDAL` | `QA_BROWSER_PASSWORD_BRIDAL` |
| din-couture | `QA_BROWSER_EMAIL_COUTURE` | `QA_BROWSER_PASSWORD_COUTURE` |

**Rules:**

- Do **not** store credentials in the repo or paste passwords into reports.
- **Do not** use generic `QA_BROWSER_EMAIL` for `npm run monitor:three-company-unified-ledger` — it is ignored; built-in default emails apply per profile unless per-company email vars are set.
- Generic `QA_BROWSER_PASSWORD` is **not** reused across all three profiles unless you explicitly set `ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true`.
- If per-company password vars are missing and generic fallback is not allowed, the runner **stops** with a clear missing-credential message.
- Per-company env vars **always win** over generic vars when set.
- Golden party selection timeout → likely **wrong credential binding** (user belongs to another company), not an accounting regression.

---

## Recommended PowerShell setup (all three profiles)

```powershell
$env:QA_BROWSER_EMAIL_CHINA = "<din-china-user>"
$env:QA_BROWSER_PASSWORD_CHINA = "<password>"
$env:QA_BROWSER_EMAIL_BRIDAL = "<din-bridal-user>"
$env:QA_BROWSER_PASSWORD_BRIDAL = "<password>"
$env:QA_BROWSER_EMAIL_COUTURE = "<din-couture-user>"
$env:QA_BROWSER_PASSWORD_COUTURE = "<password>"

npm run monitor:three-company-unified-ledger
```

Built-in default emails (if per-company email not set): `din@yahoo.com` · `ndm313@yahoo.com` · `zhd@dincouture.pk`

---

## Temporary shared password (explicit opt-in only)

```powershell
$env:QA_BROWSER_PASSWORD = "<password>"
$env:ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK = "true"
npm run monitor:three-company-unified-ledger
```

---

## Run one profile manually

```powershell
$env:MONITORING_PROFILE = "din-bridal"
$env:QA_BROWSER_EMAIL_BRIDAL = "<din-bridal-user>"
$env:QA_BROWSER_PASSWORD_BRIDAL = "<password>"
node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs
```

Single-profile runs may use generic `QA_BROWSER_EMAIL` / `QA_BROWSER_PASSWORD` when `MONITORING_PROFILE` is set explicitly.

Exit code `0` = PASS; non-zero = investigate (do not auto-fix production).

---

## Output

Timestamped reports:

- `reports/single-core-ledger/operational-monitoring/three-company-monitoring-<timestamp>.md`
- `reports/single-core-ledger/operational-monitoring/three-company-monitoring-<timestamp>.json`

Latest symlinks:

- `latest-three-company-monitoring.md`
- `latest-three-company-monitoring.json`

---

## Expected golden values

### DIN CHINA (`din-china`)

| Check | PKR |
|-------|-----|
| MR JALIL closing (LV2 / AS / Party Ledger) | 216,300 |
| Trial Balance debit = credit | 407,957,271.02 |
| Roznamcha In / Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 |

### DIN BRIDAL (`din-bridal`)

| Check | PKR |
|-------|-----|
| MR REHAN ALI closing | 530,000 |
| Trial Balance debit = credit | 21,919,575 |
| Roznamcha In / Out / Closing | 1,836,350 / 917,780 / 918,570 |

### DIN COUTURE (`din-couture`)

| Check | PKR |
|-------|-----|
| DHARIA closing | 4,488,088 |
| Trial Balance debit = credit | 49,747,104 |
| Roznamcha In / Out / Closing | 85,000 / 34,500 / 50,500 |

---

## Read-only flag verification

```powershell
Get-Content scripts/single-core-ledger/three-company-loader-guard-pipe.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A"
```

Expect only DIN CHINA, DIN BRIDAL, DIN COUTURE with 5 loaders each.

---

## Failure actions

1. **Do not auto-fix** flags, GL, or balances  
2. **Do not run migrations**  
3. Check credential binding before assuming accounting regression  
4. Capture monitoring JSON/MD and open investigation  
5. L1 rollback SQL only with finance + ops incident approval

---

## Policies

| Policy | Rule |
|--------|------|
| Credentials | Env only; never in git |
| Auto-fix | Forbidden |
| Migrations | Forbidden in monitoring runs |
| R7 / R8 | Forbidden without approval |
| Next company | Forbidden without finance sign-off |
