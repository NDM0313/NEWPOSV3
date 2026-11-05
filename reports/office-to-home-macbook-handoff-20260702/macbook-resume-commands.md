# MacBook resume commands

Replace `/path/to/your/old-erp-repo` with your local clone path (e.g. `~/dev/NEW POSV3` or `~/dev/NEWPOSV3`).

```bash
# 1) Go to repo
cd /path/to/your/old-erp-repo

# 2) Check current local state
git status --short
git branch --show-current

# 3) Pull latest office work
git fetch origin
git checkout main
git pull --ff-only origin main

# 4) Verify latest handoff / temp manager evidence exists
git log --oneline -20
git rev-parse HEAD
git rev-parse origin/main

# 5) Install deps only if needed
npm install

# 6) Calendar Day 3 only when local date is 2026-07-03+
date

# 7) Run real calendar monitoring (ONLY if date >= 2026-07-03)
npm run monitor:three-company-unified-ledger

# 8) Run tests
npm run test:unified-ledger
npm run test:unit

# 9) For mobile device checks, after connecting Pixel
adb kill-server
adb start-server
adb devices
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell pm list packages | grep dincouture || true
adb shell dumpsys package com.dincouture.erp | grep -E "versionName|versionCode|firstInstallTime|lastUpdateTime" || true
```

## Read first on MacBook

- `docs/accounting/OFFICE_TO_HOME_MACBOOK_HANDOFF_2026-07-02.md`
- `reports/office-to-home-macbook-handoff-20260702/macbook-resume-prompt.md`
