# Office Remaining Tasks Handoff — After Home ADB Setup

## Current GitHub baseline

- Branch: main
- Latest known commit: aaa8e2e4
- Closeout commit present: 96890d0a
- Ledger V2 production deployed: yes, application code 3e9c8b19
- Official calendar stability through Day 15: COMPLETE / PASS
- R8 preflight pack: present
- R8 status: BLOCKED
- Play Store: NOT RELEASED

## Home Mac status

- ADB installed: yes
- ADB version: Android Debug Bridge 1.0.41 / platform-tools 37.0.0-14910828
- Pixel 6 Pro: not connected
- Salesman QA: ADB_INSTALLED_DEVICE_NOT_CONNECTED
- Salesman password: not requested
- Manager QA: N/A / waived
- graphify-out: local-only, do not commit

## Remaining office tasks

### 1. Pull latest GitHub state on office machine

```bash
cd NEWPOSV3
git fetch origin
git checkout main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git rev-parse origin/main
git log --oneline -20
```

Expected:

- HEAD = origin/main
- Latest commit should be this office handoff commit or newer
- No unsafe staged files

### 2. Connect Pixel 6 Pro for Salesman QA

Office operator steps:

1. Connect Pixel 6 Pro via USB
2. Enable Developer options
3. Enable USB debugging
4. Approve "Allow USB debugging" prompt on phone

Then run:

```bash
adb kill-server
adb start-server
adb devices
```

Expected:

- One device line with status `device`

Possible blockers:

- `adb: command not found` → install Android platform-tools
- `unauthorized` → approve USB debugging prompt on phone
- empty list → cable/device/USB mode issue

### 3. Run Salesman QA only after Pixel authorized

Only if `adb devices` shows authorized device.

Ask Salesman password shell-only:

```bash
read -rsp "SALESMAN_QA_PASSWORD: " SALESMAN_QA_PASSWORD; echo
export SALESMAN_QA_PASSWORD
test -n "$SALESMAN_QA_PASSWORD" && echo "Salesman password env present"
```

Rules:

- Never print password value
- Never save password in docs/logs/git
- Do not create Manager user
- Manager QA remains N/A / waived
- Play Store remains NOT RELEASED

Use existing runbooks:

- `reports/mobile-manager-salesman-device-qa-20260702/salesman-role-qa.md`
- `docs/mobile_phase3_device_qa_runbook.md`

Expected final Salesman QA statuses:

- `SALESMAN_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`
- `SALESMAN_QA_FAIL_PLAY_STORE_BLOCKED`
- `BLOCKED_SALESMAN_PASSWORD_PENDING`
- `ADB_UNAUTHORIZED`
- `BLOCKED_PIXEL_NOT_CONNECTED`

### 4. Update Salesman QA evidence

Update:

```text
reports/mobile-salesman-qa-readiness-after-day15-20260709/mobile-salesman-qa-status.md
```

Must include:

- adb version
- Pixel device status
- Salesman QA result
- password committed: no
- APK/AAB uploaded: no
- Play Store: NOT RELEASED
- Manager QA: N/A / waived

### 5. R8 approval track

R8 remains blocked unless Nadeem gives exact written phrase:

```text
NADEEM_APPROVES_R8_LEGACY_RETIREMENT
```

If phrase is not present:

- Do not run R8
- Do not retire legacy paths
- Do not change flags
- Do not delete old loaders

If phrase is present:

- First prepare R8 pre-execution report
- Verify rollback plan
- Verify backup/snapshot
- Verify exact runbook
- Stop for final operator go-ahead before execution

### 6. Still not approved

Do not run:

- DB migrations
- GL repairs
- Supplier Party Discount PKR 1 QA
- Play Store upload
- Manager user creation
- Created-by backfill
- Unified RPC field migration

## Safety reminder

Never stage:

- `.env`
- credentials
- passwords
- APK/AAB
- keystore
- graphify-out
- debug PNGs
- downloads
- Bill/REF work
- unrelated WIP
- migrations without approval
- repair scripts without approval

## Immediate office next step

Pull latest main, connect Pixel 6 Pro, confirm `adb devices` shows one authorized device, then run Salesman QA with password shell-only.
