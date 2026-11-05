# Phase 2.8 Preview QA — Evidence Pack

**Branch:** `feature/single-core-ledger-phase-2-8-preview-qa-signoff`  
**Base commit:** `020a2e5d` (Phase 2.7 Party Ledger preview)

This folder holds automated QA artifacts for the Phase 2.8 sign-off pack. Live UI screenshots and browser HAR captures are optional; add them under this directory before pilot enablement if ops requires visual evidence.

| Artifact | Description |
|----------|-------------|
| `test-unified-ledger-output.txt` | Full stdout from `npm run test:unified-ledger` (112/112 PASS) |
| `build-output.txt` | Full stdout from `npm run build` (PASS) |
| `automated-qa-summary.json` | Timestamped automated gate summary |
| `role-matrix-unit-verification.json` | Access gate unit test matrix |
| `kill-switch-unit-verification.json` | Kill switch behavior from unit tests |
| `golden-mr-jalil-parity.json` | Golden fixture constants + unit-test parity proof |
| `export-safety-code-inspection.json` | Static analysis — exports use legacy data only |
| `git-pre-qa-checks.json` | Branch SHA, migrations diff, scope confirmation |

**Not in scope for this pack:** enabling `unified_ledger_engine`, pilot flags, migrations, or VPS deploy.
