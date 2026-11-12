# Windows Task Scheduler — three-company monitoring guide

**Program:** OLD ERP Single Core Ledger  
**Generated:** 2026-06-14T00:00:00Z  
**Scope:** Local operator workstation — docs only; no passwords in repo

---

## Prerequisites

- Node.js and repo cloned at e.g. `C:\Users\<you>\dev\Corusr\NEW POSV3`
- Playwright browsers installed (`npx playwright install` if needed)
- SSH config `dincouture-vps` for read-only flag guard (optional but recommended)
- Per-company QA passwords rotated and stored in a **local secret store** (Windows Credential Manager, 1Password, etc.) — not in git

---

## 1. Set per-company env vars securely (manual test)

Open PowerShell **for your user session only** (do not save to a repo file):

```powershell
cd "C:\Users\<you>\dev\Corusr\NEW POSV3"

$env:QA_BROWSER_EMAIL_CHINA = "<din-china-monitoring-user>"
$env:QA_BROWSER_PASSWORD_CHINA = "<password>"
$env:QA_BROWSER_EMAIL_BRIDAL = "<din-bridal-monitoring-user>"
$env:QA_BROWSER_PASSWORD_BRIDAL = "<password>"
$env:QA_BROWSER_EMAIL_COUTURE = "<din-couture-monitoring-user>"
$env:QA_BROWSER_PASSWORD_COUTURE = "<password>"

npm run monitor:three-company-unified-ledger
```

Expected: exit code `0`, `Three-company monitoring: PASS`.

**Do not** paste real passwords into chat, screenshots, or markdown files.

---

## 2. Local logs folder (outside repo)

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\erp-monitoring-logs"
```

After a successful run, copy latest evidence:

```powershell
Copy-Item "reports\single-core-ledger\operational-monitoring\latest-three-company-monitoring.json" `
  "$env:USERPROFILE\erp-monitoring-logs\monitoring-$(Get-Date -Format 'yyyy-MM-dd-HHmm').json"
```

---

## 3. Wrapper script (no secrets in file)

Create **outside the repo** e.g. `C:\Users\<you>\erp-monitoring\run-monitoring.ps1`:

```powershell
# Load secrets from Windows Credential Manager or a protected local file OUTSIDE git
# Example pattern only — implement with your secret store:
# $env:QA_BROWSER_PASSWORD_CHINA = (Get-StoredCredential -Target 'erp-qa-china').Password

Set-Location "C:\Users\<you>\dev\Corusr\NEW POSV3"
$logDir = "$env:USERPROFILE\erp-monitoring-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

npm run monitor:three-company-unified-ledger 2>&1 | Tee-Object -FilePath "$logDir\run-$(Get-Date -Format 'yyyy-MM-dd-HHmm').log"
exit $LASTEXITCODE
```

**Never** write plaintext passwords into this script or commit it with secrets.

---

## 4. Create Windows Task Scheduler task

1. Open **Task Scheduler** → Create Task  
2. **General:** Run only when user is logged on (Playwright needs desktop session) OR use a dedicated monitoring VM  
3. **Triggers:** Daily, weekdays, e.g. 09:30 local  
4. **Actions:** Start a program  
   - Program: `powershell.exe`  
   - Arguments: `-NoProfile -ExecutionPolicy Bypass -File "C:\Users\<you>\erp-monitoring\run-monitoring.ps1"`  
5. **Conditions:** Uncheck "Start only if on AC power" if on laptop  
6. **Settings:** Stop task if runs longer than 2 hours  

Test: Right-click task → **Run** → check `erp-monitoring-logs` for output.

---

## 5. Disable the task

Task Scheduler → select task → **Disable** or **Delete**.

---

## 6. Password rotation

1. Rotate password in ERP/Supabase Auth for the monitoring user  
2. Update **local secret store only** (Credential Manager / env for next session)  
3. Run manual test (section 1)  
4. Re-enable scheduled task  

See [`password-rotation-closure.md`](password-rotation-closure.md).

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| din-bridal golden party timeout | Wrong email — generic `QA_BROWSER_EMAIL` in shell; use `QA_BROWSER_EMAIL_BRIDAL` |
| Missing credential error | Set `QA_BROWSER_PASSWORD_*` or `ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true` |
| SSH flag guard fail | VPN/SSH to `dincouture-vps` unavailable — network, not accounting |

---

## Policies

- No passwords in git  
- No auto-fix of production GL or flags  
- On FAIL → [`monitoring-incident-response-runbook.md`](monitoring-incident-response-runbook.md)
