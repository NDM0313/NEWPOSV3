# MacBook Pro — remaining tasks handoff

**Program:** OLD ERP Single Core Ledger (DIN CHINA · DIN BRIDAL · DIN COUTURE)  
**Production:** https://erp.dincouture.pk  
**Generated:** 2026-06-27  
**Latest commit (push from Windows):** `7a8ad562` — `docs(accounting): close monitoring password rotation`  
**Status:** Three-company baseline **COMPLETE** · password rotation **COMPLETE** · post-rotation monitoring **PASS**

---

## Kya complete ho chuka hai (Windows PC par)

| Item | Status |
|------|--------|
| Three-company unified loaders live | COMPLETE |
| Post-rotation monitoring (per-company credentials) | PASS @ 2026-06-27 |
| Password rotation closure docs | COMPLETE |
| Ops schedule pack + incident runbook | COMPLETE |
| `npm run test:unified-ledger` | 256/256 PASS |
| GitHub push | `main` @ `7a8ad562` |

**Evidence:** [`password-rotation-final-closure-report.md`](password-rotation-final-closure-report.md) · [`latest-three-company-monitoring.json`](latest-three-company-monitoring.json)

---

## MacBook par kya karna hai (actionable — is order mein)

### Task 1 — Repo sync

```bash
cd ~/dev/NEW\ POSV3   # apna clone path
git fetch origin
git checkout main
git pull origin main
git log -1 --oneline   # expect: 7a8ad562 docs(accounting): close monitoring password rotation
```

Repo URL: https://github.com/NDM0313/NEWPOSV3

---

### Task 2 — Dependencies + Playwright

```bash
npm install
npx playwright install chromium
```

Verify tests (optional but recommended):

```bash
npm run test:unified-ledger
# expect: 256 pass, 0 fail
```

---

### Task 3 — Per-company monitoring credentials (local only)

**Never commit passwords.** Use the **rotated** passwords from Windows setup (same three ERP users).

```bash
# ~/.zshrc ya ek local script — repo ke andar mat likho
export QA_BROWSER_EMAIL_CHINA="din@yahoo.com"
export QA_BROWSER_PASSWORD_CHINA="<rotated-password>"

export QA_BROWSER_EMAIL_BRIDAL="ndm313@yahoo.com"
export QA_BROWSER_PASSWORD_BRIDAL="<rotated-password>"

export QA_BROWSER_EMAIL_COUTURE="zhd@dincouture.pk"
export QA_BROWSER_PASSWORD_COUTURE="<rotated-password>"
```

**Rules:**

- Generic `QA_BROWSER_EMAIL` three-company runner ke liye **ignore** hota hai — har company ka apna email env use karo.
- `ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true` **mat** set karo (production hygiene).

---

### Task 4 — Manual monitoring verify (MacBook par pehli dafa)

```bash
cd ~/dev/NEW\ POSV3
npm run monitor:three-company-unified-ledger
```

**Expected:**

- Exit code `0`
- Console: `Three-company monitoring: PASS`
- Har profile: `email-source=per-company password-source=per-company`
- Evidence: `reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.json`

Agar FAIL ho → [`monitoring-incident-response-runbook.md`](monitoring-incident-response-runbook.md) — GL/flags **mat** touch karo.

---

### Task 5 — Local logs folder (repo ke bahar)

```bash
mkdir -p ~/erp-monitoring-logs
cp reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.json \
   ~/erp-monitoring-logs/monitoring-$(date +%Y-%m-%d-%H%M).json
```

---

### Task 6 — Daily schedule (macOS launchd)

Playwright ko **logged-in desktop session** chahiye. MacBook sleep par task miss ho sakta hai — ya dedicated monitoring Mac / “Prevent sleep during business hours” use karo.

**6a. Wrapper script (repo ke bahar, secrets ke bina skeleton)**

Create `~/erp-monitoring/run-monitoring.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Secrets: macOS Keychain se load karo ya protected local file (git mein mat daalo)
# export QA_BROWSER_PASSWORD_CHINA="$(security find-generic-password -s erp-qa-china -w)"
# export QA_BROWSER_PASSWORD_BRIDAL="$(security find-generic-password -s erp-qa-bridal -w)"
# export QA_BROWSER_PASSWORD_COUTURE="$(security find-generic-password -s erp-qa-couture -w)"

cd "$HOME/dev/NEW POSV3"
LOG_DIR="$HOME/erp-monitoring-logs"
mkdir -p "$LOG_DIR"
STAMP=$(date +%Y-%m-%d-%H%M)

npm run monitor:three-company-unified-ledger 2>&1 | tee "$LOG_DIR/run-$STAMP.log"
EXIT=$?

if [ $EXIT -eq 0 ]; then
  cp reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.json \
     "$LOG_DIR/monitoring-$STAMP.json"
fi

exit $EXIT
```

```bash
chmod +x ~/erp-monitoring/run-monitoring.sh
```

**6b. launchd plist (weekdays 09:30 local)**

Create `~/Library/LaunchAgents/pk.dincouture.erp-monitoring.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>pk.dincouture.erp-monitoring</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>$HOME/erp-monitoring/run-monitoring.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Weekday</key><integer>1</integer>
      <key>Hour</key><integer>9</integer>
      <key>Minute</key><integer>30</integer>
    </dict>
    <dict>
      <key>Weekday</key><integer>2</integer>
      <key>Hour</key><integer>9</integer>
      <key>Minute</key><integer>30</integer>
    </dict>
    <dict>
      <key>Weekday</key><integer>3</integer>
      <key>Hour</key><integer>9</integer>
      <key>Minute</key><integer>30</integer>
    </dict>
    <dict>
      <key>Weekday</key><integer>4</integer>
      <key>Hour</key><integer>9</integer>
      <key>Minute</key><integer>30</integer>
    </dict>
    <dict>
      <key>Weekday</key><integer>5</integer>
      <key>Hour</key><integer>9</integer>
      <key>Minute</key><integer>30</integer>
    </dict>
  </array>
  <key>StandardOutPath</key>
  <string>/tmp/erp-monitoring.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/erp-monitoring.stderr.log</string>
</dict>
</plist>
```

Load / test:

```bash
launchctl load ~/Library/LaunchAgents/pk.dincouture.erp-monitoring.plist
launchctl start pk.dincouture.erp-monitoring
# Disable: launchctl unload ~/Library/LaunchAgents/pk.dincouture.erp-monitoring.plist
```

Windows equivalent: [`windows-task-scheduler-guide.md`](windows-task-scheduler-guide.md)

---

### Task 7 — SSH flag guard (optional)

Agar read-only loader guard SSH use karta ho:

```bash
# ~/.ssh/config mein host dincouture-vps configured hona chahiye
ssh dincouture-vps "docker ps"
```

VPS rule: **always** `ssh dincouture-vps` — raw IP mat use karo.

---

## MacBook completion checklist

Copy-paste and tick when done:

```
[ ] git pull main @ 7a8ad562+
[ ] npm install + playwright chromium
[ ] Per-company QA_BROWSER_PASSWORD_* set (local only, not in git)
[ ] npm run monitor:three-company-unified-ledger → PASS
[ ] ~/erp-monitoring-logs created + first JSON archived
[ ] ~/erp-monitoring/run-monitoring.sh created (secrets via Keychain)
[ ] launchd plist loaded + manual test run PASS
[ ] Incident runbook bookmarked
```

---

## Blocked — MacBook par mat karo (separate approval chahiye)

| Item | Status | Why blocked |
|------|--------|-------------|
| R7 roznamcha_payment RPC | DESIGN ONLY | Migration + finance approval |
| R8 legacy engine retirement | BLOCKED | Stability period not met |
| Next company rollout | BLOCKED | Finance sign-off |
| BS / P&L / Cash Flow unified loaders | OPTIONAL FUTURE | Per-screen design + golden capture |
| Mobile unified parity | DEFERRED | Phase 2.mobile |
| Migrations / flag SQL / GL fixes | **NEVER** without approved runbook | Money + stock risk |

---

## Golden values (monitoring PASS criteria)

| Company | Golden party | Closing | Trial Balance |
|---------|--------------|---------|---------------|
| DIN CHINA | MR JALIL | PKR 216,300 | PKR 407,957,271.02 |
| DIN BRIDAL | MR REHAN ALI | PKR 530,000 | PKR 21,919,575 |
| DIN COUTURE | DHARIA | PKR 4,488,088 | PKR 49,747,104 |

Full detail: [`monitoring-runbook.md`](monitoring-runbook.md)

---

## Key doc index

| Doc | Purpose |
|-----|---------|
| [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Live program entry |
| [`scheduled-monitoring-ops-pack.md`](scheduled-monitoring-ops-pack.md) | Frequency + PASS criteria |
| [`monitoring-incident-response-runbook.md`](monitoring-incident-response-runbook.md) | FAIL par kya karna hai |
| [`master-remaining-roadmap.md`](../master-roadmap-after-din-china-closure/master-remaining-roadmap.md) | Long-term program phases |

---

## Agent prompt (MacBook par Cursor mein paste karo)

```text
Single Core Ledger — MacBook operational handoff.

Context:
- main @ 7a8ad562 — password rotation COMPLETE, post-rotation monitoring PASS
- Read: reports/single-core-ledger/operational-monitoring/macbook-pro-remaining-tasks-handoff.md

Task: Complete MacBook tasks 1–7 only (repo sync, deps, credentials, manual PASS, logs, launchd schedule).
Hard constraints: no migrations, no flag SQL, no GL mutation, no R7/R8, no next company, no passwords in git.
Return: checklist status, monitoring evidence path, launchd test result.
```

---

## After MacBook setup

Ongoing ops = daily `npm run monitor:three-company-unified-ledger` with per-company credentials. Program expansion (R7/R8/next company) **blocked** until finance gives separate written approval.
