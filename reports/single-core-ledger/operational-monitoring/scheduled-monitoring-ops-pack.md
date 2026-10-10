# Scheduled monitoring ops pack — three-company unified ledger

**Program:** OLD ERP Single Core Ledger (not FX app)  
**Production:** https://erp.dincouture.pk  
**Generated:** 2026-06-14T00:00:00Z  
**Latest main at pack creation:** `9586e611`

---

## Purpose

Schedule-safe, read-only production monitoring for DIN CHINA, DIN BRIDAL, and DIN COUTURE unified loaders. No GL mutations, no migrations, no flag changes.

---

## Recommended frequency

| Schedule | Scope | Notes |
|----------|-------|-------|
| **Daily (business hours)** | `npm run monitor:three-company-unified-ledger` | Primary ops gate — run once per business day after market open |
| **Weekly (deep)** | Same command + archive timestamped JSON to local logs | Optional; retain 4 weekly snapshots for audit trail |
| **On-demand** | After any loader incident, credential rotation, or finance-requested verify | Mandatory before closing incident |

---

## Command

```powershell
npm run monitor:three-company-unified-ledger
```

---

## Required environment variables

| Variable | Profile | Notes |
|----------|---------|-------|
| `QA_BROWSER_PASSWORD_CHINA` | din-china | Required unless generic fallback (see below) |
| `QA_BROWSER_PASSWORD_BRIDAL` | din-bridal | Required unless generic fallback |
| `QA_BROWSER_PASSWORD_COUTURE` | din-couture | Required unless generic fallback |

### Optional email overrides

| Variable | Default if unset |
|----------|------------------|
| `QA_BROWSER_EMAIL_CHINA` | `din@yahoo.com` |
| `QA_BROWSER_EMAIL_BRIDAL` | `ndm313@yahoo.com` |
| `QA_BROWSER_EMAIL_COUTURE` | `zhd@dincouture.pk` |

### Warnings

- **Generic `QA_BROWSER_EMAIL` is ignored** for the three-company runner — it cannot silently bind the wrong company.
- **Generic `QA_BROWSER_PASSWORD`** is **not** reused across profiles unless `ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true` is set explicitly.
- **Never commit** passwords or store them in repo files.

---

## Evidence output paths

| Artifact | Path |
|----------|------|
| Timestamped JSON | `reports/single-core-ledger/operational-monitoring/three-company-monitoring-<timestamp>.json` |
| Timestamped MD | `reports/single-core-ledger/operational-monitoring/three-company-monitoring-<timestamp>.md` |
| Latest JSON | `reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.json` |
| Latest MD | `reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.md` |

For scheduled runs on an operator workstation, also copy JSON to a **local logs folder** outside the repo (see Windows guide).

---

## Expected PASS criteria

| Check | Expected |
|-------|----------|
| din-china Phase 2.16 | PASS |
| din-bridal Phase 2.16 | PASS |
| din-couture Phase 2.16 | PASS |
| Per-company flags | 12/12 ON each |
| Per-company loaders | 5/5 ON each |
| Other-company loaders | 0 |
| Cross-company leakage | false |
| Golden party closings | Match finance fixtures (see monitoring-runbook.md) |
| Material console/RPC errors | none (waivers documented per profile) |

Exit code **0** = overall PASS.

---

## Failure escalation

| Severity | Condition | Action |
|----------|-----------|--------|
| P1 | Golden value mismatch on any live loader screen | Stop — open [`monitoring-incident-response-runbook.md`](monitoring-incident-response-runbook.md); finance notify |
| P2 | Credential-binding / golden party timeout | Rotate or fix per-company login; rerun — not accounting auto-fix |
| P3 | Loader flag missing (read-only guard FAIL) | Ops + finance approval before any flag SQL |
| P4 | Build/test failure in CI only | Engineering — do not touch production flags |

**Never:** auto-fix GL, run migrations, apply R7/R8, enable another company without approval.

---

## Related guides

- [`monitoring-runbook.md`](monitoring-runbook.md) — golden values and credential policy  
- [`windows-task-scheduler-guide.md`](windows-task-scheduler-guide.md) — local scheduling  
- [`vps-cron-monitoring-guide.md`](vps-cron-monitoring-guide.md) — future VPS cron (docs only)  
- [`password-rotation-closure.md`](password-rotation-closure.md) — QA password hygiene  
- [`monitoring-incident-response-runbook.md`](monitoring-incident-response-runbook.md) — incident tree
