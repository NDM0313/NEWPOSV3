# Calendar audit correction — OLD ERP / DIN Collection ERP

**Correction date:** 2026-07-05  
**Scope:** Single-core engine calendar stability window (R8 gate)  
**Action:** Official calendar interpretation corrected; technical evidence preserved.

## Summary

Day 6 and Day 7 monitoring samples were technically successful but were executed on the same local calendar date as Day 5 (`2026-07-05`). Same-day repeated samples do **not** count as separate calendar stability days for the 2–4 week R8 window.

## Day 6 accelerated sample

| Field | Value |
|-------|-------|
| Evidence commit | `8e5c259f` |
| Evidence folder | `reports/single-core-engine-calendar-stability-20260706/` |
| Actual local run date (evidence) | **2026-07-05** |
| Run local time | 2026-07-05 16:00:26 → 16:15:03 +05:00 |
| Technical monitoring result | **PASS** |
| Official calendar count | **NOT COUNTED** |
| Classification | `TECHNICAL_SAMPLE_PASS_NOT_CALENDAR_COUNTED` |
| Monitoring artifact | `three-company-monitoring-2026-07-05T11-00-27-523Z` |

## Day 7 accelerated sample

| Field | Value |
|-------|-------|
| Evidence commit | `bc4ded51` |
| Evidence folder | `reports/single-core-engine-calendar-stability-20260707/` |
| Actual local run date (evidence) | **2026-07-05** |
| Run local time | 2026-07-05 16:15:36 → 16:28:13 +05:00 |
| Technical monitoring result | **PASS** |
| Official calendar count | **NOT COUNTED** |
| Classification | `TECHNICAL_SAMPLE_PASS_NOT_CALENDAR_COUNTED` |
| Monitoring artifact | `three-company-monitoring-2026-07-05T11-15-38-400Z` |

## Reason

Same-day repeated samples on 2026-07-05 cannot substitute for official calendar-counted Days 6, 7, and 8. The R8 stability window requires distinct calendar days; accelerated same-day runs are retained as supplementary evidence only.

## Official calendar requirements (superseded 2026-07-07)

| Official day | Earliest valid run date |
|--------------|-------------------------|
| Calendar Day 6 | 2026-07-06 or later |
| Calendar Day 7 | 2026-07-07 or later |
| Calendar Day 8 | 2026-07-08 or later |

**Supersession (2026-07-07):** Forward official runs no longer require per-day calendar spacing — consecutive official days may run in same session after Official Day 7 PASS. This section is retained for historical audit only. Accelerated 2026-07-05 samples and 2026-07-06 bypass sample remain NOT COUNTED.

## R8 status

**BLOCKED** — real 2–4 week calendar stability window not complete; written approval from Nadeem required before R8.

## Safety attestation

| Gate | Status |
|------|--------|
| R8 run | no |
| DB migrations run | no |
| GL mutation | no |
| Repairs run | no |
| Play Store upload | no |
| Passwords committed | no |
| Git history rewritten | no |
| Evidence commits deleted | no |

## Related commits (preserved, not rewritten)

- Day 5 (official counted): `bcbd5fe4`
- Day 6 sample evidence: `8e5c259f`
- Day 7 sample evidence: `bc4ded51`
