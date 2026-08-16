# VPS cron monitoring guide (documentation only)

**Program:** OLD ERP Single Core Ledger  
**Generated:** 2026-06-14T00:00:00Z  
**Status:** DOCS ONLY — **do not edit VPS cron in this run**

---

## When to use

Move scheduled monitoring to the VPS **only if**:

- A headless CI runner with Playwright is provisioned on or near the VPS
- Secrets can live in a protected env file **outside** the git repo
- Finance approves automated production browser QA from that host

Current recommended ops path: **operator workstation** + Windows Task Scheduler (see [`windows-task-scheduler-guide.md`](windows-task-scheduler-guide.md)).

---

## Recommended pattern (future)

```bash
# Example only — NOT applied in this run
# /root/erp-monitoring/env.sh — chmod 600, NOT in git
# source /root/erp-monitoring/env.sh
# cd /root/NEWPOSV3 && npm run monitor:three-company-unified-ledger
```

Cron entry (example — **do not deploy without approval**):

```cron
# 0 9 * * 1-5 root /root/erp-monitoring/run-monitoring.sh >> /var/log/erp-monitoring/cron.log 2>&1
```

---

## Secret management

| Do | Don't |
|----|-------|
| Store passwords in `/root/erp-monitoring/.env` with `chmod 600` | Store passwords in `NEWPOSV3` repo |
| Use Docker secrets or host secret manager | Commit `.env` to git |
| Rotate after exposure (see password-rotation-closure) | Log password values |

Required env vars (same as ops pack):

- `QA_BROWSER_PASSWORD_CHINA`
- `QA_BROWSER_PASSWORD_BRIDAL`
- `QA_BROWSER_PASSWORD_COUTURE`
- Optional `QA_BROWSER_EMAIL_*`

---

## Log paths (suggested)

| Path | Content |
|------|---------|
| `/var/log/erp-monitoring/cron.log` | Cron stdout/stderr |
| `/var/log/erp-monitoring/latest.json` | Copy of latest monitoring JSON |
| Repo `reports/.../latest-three-company-monitoring.json` | Only if run from git checkout and operator chooses to commit evidence |

Prefer **local log archive** over committing every scheduled run to git.

---

## Failure notification (suggestions)

- Email ops on non-zero exit (wrapper script `mail` or webhook)
- Slack/Teams webhook with link to log file — **no passwords in payload**
- Pager only for golden mismatch (P1) after human triage

---

## No production mutation policy

Scheduled monitoring is **read-only**:

- No `psql` flag mutations
- No migrations
- No R7/R8
- No new company enablement
- On FAIL → incident runbook; do not auto-fix GL

---

## SSH note

Read-only flag guard uses `ssh dincouture-vps` from operator machine today. VPS-hosted monitoring would run flag SQL via local `docker exec` instead — update wrapper accordingly.
