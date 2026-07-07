# Official Calendar Stability — Days 7–12 Summary

**Window start:** 2026-07-01  
**Summary date:** 2026-07-07  
**Classification:** All six days **CALENDAR_STABILITY_DAY_PASS** (official counted)

## Executive summary

| Metric | Value |
|--------|--------|
| Official days in this band | **6** (Day 7 → Day 12) |
| Three-company monitoring | **6/6 PASS** (final artifact each day) |
| R8 legacy retirement | **BLOCKED** — window in progress |
| DB migrations from calendar runs | **none** |
| GL mutations from calendar runs | **none** (operator JE-0310 void Day 7 separate) |
| Migrations / repairs auto-run | **none** |

## Day-by-day ledger

| Day | Commit | Run (PKT) | Monitoring artifact | Admin Compare | Fixture refresh | Tests (unified · unit) | Notes |
|-----|--------|-----------|---------------------|---------------|-----------------|------------------------|-------|
| **7** | `6e179412` | 12:36 → 12:50 | `…07-36-24-457Z` | 9/9 strict PASS | CHINA + BRIDAL Option A | 334 · 164 | JE-0310 void; date gate removed forward |
| **8** | `81a10500` | 12:52 → 13:06 | `…07-52-21-211Z` | 9/9 strict PASS | none | 334 · 167 | Clean same-session run |
| **9** | `3e05c473` | 13:18 → 13:30 | `…08-18-09-034Z` | 9/9 strict PASS | none | 334 · 173 | Retry 1 after CHINA UI flake |
| **10** | `e6673ff3` | 15:29 → 15:40 | `…10-29-51-582Z` | **1 PKR materiality waiver** | CHINA + BRIDAL | 334 · 175 | Harness hardening; live GL drift |
| **11** | `711d2307` | 19:04 → 19:17 | `…14-04-35-150Z` | 1 PKR waiver | CHINA only | 334 · 176 | Post-clearance TB; VPS deploy `e922416c` |
| **12** | *(this commit)* | 19:46 → 19:58 | `…14-46-27-601Z` | **9/9 strict PASS** | CHINA + BRIDAL | 334 · 176 | Negative roznamcha closing; admin compare clean |

Evidence folders: `reports/single-core-engine-calendar-stability-official-20260707/` through `…20260712/`.

## DIN CHINA golden trajectory (TB PKR)

| Day | Trial Balance | Roznamcha (In / Out / Closing) |
|-----|---------------|--------------------------------|
| 7 | 393,034,072.02 | 84,199,230 / 58,525,317 / 25,673,913 |
| 8–9 | *(unchanged)* | *(unchanged)* |
| 10 | 413,093,712.02 | 110,009,812 / 73,753,626 / 36,256,186 |
| 11 | 349,757,752.77 | 109,088,121 / 74,675,317 / 34,412,804 |
| 12 | 332,721,352.77 | 59,762,230 / 60,225,317 / **−463,087** |

MR JALIL closing **216,299** unchanged all days. TB debit = credit every run.

## DIN BRIDAL roznamcha (PKR)

| Day | Cash In | Cash Out | Closing |
|-----|---------|----------|---------|
| 7–9 | 2,850,850 | 1,794,607 | 1,056,243 |
| 10–11 | 2,968,850 | 1,794,607 | 1,174,243 |
| 12 | 2,850,850 | 1,794,607 | 1,056,243 |

MR REHAN ALI **530,000** · TB **26,330,077** unchanged.

## DIN COUTURE

All days **PASS** — no fixture refresh required in this band.

## Not counted (retained as audit only)

- 2026-07-05 accelerated Day 6/7 samples
- 2026-07-06 date-gate bypass sample (`DATE_GATE_BYPASSED_SAMPLE_FAIL_NOT_CALENDAR_COUNTED`)

## Harness / policy notes

1. **Date gate removed** (Day 7) — consecutive official days may run same session.
2. **Admin Compare materiality waiver** (≤1 PKR) — monitoring-only; documented Day 10–11 when hybrid old engine showed 216,300 vs unified 216,299.
3. **Day 12** — strict **9/9 PASS** restored (`maxAbsDiff=0`).
4. **Negative roznamcha closing** — Day 12 China cash out > cash in; harness updated for negative parse.

## Safety gates (all days)

| Gate | Status |
|------|--------|
| R8 run | no |
| Canonical DB migrations | no |
| Automated GL repairs | no |
| Passwords in git | no |
| Play Store | not approved |
| Supplier party_discount QA | not approved |
| Salesman device QA | **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |

## Next recommended phase

1. Continue **Day 13+** daily monitoring toward R8 window completion (~2026-07-15 earliest review).
2. Salesman on-device QA when Pixel + credentials available.
3. Optional: investigate 1 PKR hybrid vs unified parity (separate from calendar evidence).
4. R8 legacy retirement — **BLOCKED** until window complete + final approval.

## Related docs

- [`FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md`](FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md)
- [`reports/single-core-engine-calendar-stability-official-20260710/admin-compare-1pkr-materiality-waiver.md`](../reports/single-core-engine-calendar-stability-official-20260710/admin-compare-1pkr-materiality-waiver.md)
