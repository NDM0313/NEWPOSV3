# Home Remaining Tasks Handoff — After Official Day 15

## Current GitHub baseline
- Branch: main
- HEAD/origin: 4665334b
- Official Days 13–15: COMPLETE
- Day 13 commit: c15bb11e
- Day 14 commit: 24a01808
- Day 15 / R8 readiness commit: 4665334b

## Completed
- Official Day 12 deploy decision: no frontend deploy required
- Official Day 13: PASS
- Official Day 14: PASS
- Official Day 15: PASS
- R8 readiness pack created
- Tests/build passed through Day 15
- No DB migrations
- No uncontrolled repairs
- No Play Store release
- No Supplier Party Discount QA

## Still blocked / remaining
1. R8 legacy retirement
   - Status: BLOCKED
   - Required: Nadeem written approval phrase
   - Do not run automatically

2. Salesman mobile QA
   - Status: **PASS** (login 2026-07-09) — `SALESMAN_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`
   - Evidence: `reports/mobile-salesman-qa-readiness-after-day15-20260709/salesman-role-qa-pass.md`
   - Play Store: NOT RELEASED (separate approval)

3. Optional 1 PKR parity investigation
   - Status: optional
   - Read-only only
   - Separate from calendar pass/fail

4. Supplier Party Discount PKR 1 QA
   - Status: NOT APPROVED
   - Separate approval required

5. graphify-out
   - Local-only artifact
   - Do not commit unless explicitly approved

## Home start commands

```bash
cd NEWPOSV3
git fetch origin
git checkout main
git pull --ff-only origin main
git status --short
git log --oneline -20
```

## Next recommended home phase

* Verify repo at 4665334b or newer.
* Run Salesman mobile QA only if Pixel + password are available.
* Prepare R8 preflight only after Nadeem written approval.
* Do not run R8 until explicit approval.
