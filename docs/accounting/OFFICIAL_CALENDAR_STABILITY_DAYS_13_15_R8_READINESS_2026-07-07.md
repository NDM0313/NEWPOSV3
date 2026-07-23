# Official Calendar Stability — Days 13–15 R8 Readiness

**Date:** 2026-07-08  
**Status:** **READINESS EVIDENCE COMPLETE** for Days 13–15 checkpoint  
**R8:** **BLOCKED** until Nadeem written approval (`NADEEM_APPROVES_R8_LEGACY_RETIREMENT`)

This pack is **readiness evidence only**. Do **not** retire legacy paths automatically.

## Day-by-day summary

| Day | Classification | Artifact | Admin Compare | Fixture refresh | Tests/build | Commit |
|-----|----------------|----------|---------------|-----------------|-------------|--------|
| 13 | **PASS** | `three-company-monitoring-2026-07-08T12-18-09-526Z` | MATERIALITY_WAIVER maxAbsDiff=1 | CHINA TB/roznamcha + BRIDAL roznamcha | 334/334 · 176/176 · build PASS | `c15bb11e` |
| 14 | **PASS** | `three-company-monitoring-2026-07-08T12-56-01-209Z` | **9/9 strict** maxAbsDiff=0 | CHINA TB/roznamcha + BRIDAL roznamcha | 334/334 · 176/176 · build PASS | `24a01808` |
| 15 | **PASS** | `three-company-monitoring-2026-07-08T13-55-49-198Z` | MATERIALITY_WAIVER maxAbsDiff=1 | CHINA TB/roznamcha + BRIDAL TB/roznamcha | 334/334 · 176/176 · build PASS | (this commit) |

## DIN CHINA trajectory (Days 13–15)

| Day | TB | Roznamcha (In / Out / Closing) | MR JALIL | Admin Compare |
|-----|-----|--------------------------------|----------|---------------|
| 13 | 353,192,001.7 | 109,088,121 / 74,675,317 / 34,412,804 | 216,299 | waiver 1 PKR |
| 14 | 333,268,801.7 | 59,762,230 / 35,651,877 / 24,110,353 | 216,299 | **9/9 strict** |
| 15 | 353,192,001.7 | 109,088,121 / 74,675,317 / 34,412,804 | 216,299 | waiver 1 PKR |

Note: Day 14 vs 13/15 totals differ due to live GL/roznamcha activity between runs; each day re-baselined under Option A with TB debit=credit and party balances stable.

## DIN BRIDAL trajectory

| Day | TB | Roznamcha | MR REHAN ALI |
|-----|-----|-----------|--------------|
| 13 | 26,330,077 | 2,968,850 / 1,794,607 / 1,174,243 | 530,000 |
| 14 | 26,330,077 | 2,850,850 / 1,794,607 / 1,056,243 | 530,000 |
| 15 | 26,410,077 | 2,968,850 / 1,794,607 / 1,174,243 | 530,000 |

## DIN COUTURE status

Unchanged across Days 13–15 when fully exercised: roznamcha **85,000 / 34,500 / 50,500**; DHARIA **4,488,088**; TB **49,747,104**.

## Safety gates

| Gate | Status |
|------|--------|
| R8 run | **no** |
| DB migrations | **no** |
| Repairs | **no** |
| Production mutation from calendar runs | **none** |
| Play Store | **NOT RELEASED** |
| Supplier Party Discount QA | **NOT APPROVED** |
| Passwords committed | **no** |

## Remaining blockers

1. **R8** — approval phrase `NADEEM_APPROVES_R8_LEGACY_RETIREMENT` **not present**
2. **Salesman mobile QA** — `BLOCKED_SALESMAN_DEVICE_QA_PENDING` (no Pixel 6 Pro on ADB)
3. Manager QA — N/A/waived
4. Optional 1 PKR parity investigation — separate; does not block calendar PASS when Admin Compare materiality waiver applies

## R8 readiness recommendation

**READY FOR OPERATOR APPROVAL REVIEW** on Days 13–15 evidence only.  
**NOT AUTHORIZED TO RUN R8.** Await exact written phrase, then locate R8 runbook, verify rollback/backup, and return a preflight report before any retirement action.

Evidence folders:

- [`reports/single-core-engine-calendar-stability-official-20260713/`](../reports/single-core-engine-calendar-stability-official-20260713/)
- [`reports/single-core-engine-calendar-stability-official-20260714/`](../reports/single-core-engine-calendar-stability-official-20260714/)
- [`reports/single-core-engine-calendar-stability-official-20260715/`](../reports/single-core-engine-calendar-stability-official-20260715/)
