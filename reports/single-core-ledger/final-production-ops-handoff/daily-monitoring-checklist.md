# Daily monitoring checklist — Single Core Ledger

**Program mode:** Production ops  
**Command:** `npm run monitor:three-company-unified-ledger`

---

## Before run

- [ ] Per-company env vars set locally (not in repo):
  - `QA_BROWSER_EMAIL_CHINA` / `QA_BROWSER_PASSWORD_CHINA`
  - `QA_BROWSER_EMAIL_BRIDAL` / `QA_BROWSER_PASSWORD_BRIDAL`
  - `QA_BROWSER_EMAIL_COUTURE` / `QA_BROWSER_PASSWORD_COUTURE`
- [ ] Generic fallback **not** enabled (`ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK` unset)
- [ ] Playwright Chromium available (`npx playwright install chromium` if needed)
- [ ] Repo at `main`, no pending ERP runtime deploy required for monitoring

---

## Run

```powershell
cd "C:\Users\<you>\dev\Corusr\NEW POSV3"
npm run monitor:three-company-unified-ledger
```

**Correct script name:** `monitor:three-company-unified-ledger` (not `ledgejr` typo)

---

## PASS criteria

- [ ] Exit code `0`
- [ ] Console: `Three-company monitoring: PASS`
- [ ] Each profile shows `email-source=per-company password-source=per-company`
- [ ] din-china PASS
- [ ] din-bridal PASS
- [ ] din-couture PASS
- [ ] Other-company loaders: 0
- [ ] No material console/RPC errors
- [ ] Golden party closings match fixtures (see [`final-production-ops-handoff.md`](final-production-ops-handoff.md))

---

## After PASS

- [ ] Confirm `latest-three-company-monitoring.json` updated
- [ ] Archive JSON to local logs folder outside repo (optional): `%USERPROFILE%\erp-monitoring-logs`
- [ ] Do **not** commit passwords or session env dumps

---

## On FAIL

- [ ] Do **not** run migrations
- [ ] Do **not** change flags or GL
- [ ] Follow [`incident-quick-reference.md`](incident-quick-reference.md) and full [`monitoring-incident-response-runbook.md`](../operational-monitoring/monitoring-incident-response-runbook.md)
