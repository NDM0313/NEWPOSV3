# Option A — DIN BRIDAL fixture-only refresh (INVALID SAME-DATE SAMPLE)

**Status:** **NOT APPROVED / NOT ELIGIBLE — date gate bypassed**

**Date of invalid sample:** 2026-07-06  
**Classification:** `DATE_GATE_BYPASSED_SAMPLE_FAIL_NOT_CALENDAR_COUNTED`

## Do not apply

**Do not apply these values.**  
This note was generated from a monitoring run on **2026-07-06**, the same calendar date as Official Day 6 (already counted). That run is **not** Official Calendar Day 7.

Re-run Official Day 7 on **2026-07-07** or later and generate a **fresh** Option A approval note if drift appears on the valid-date run.

---

## Observed drift (reference only — not for fixture update)

**Monitoring artifact (invalid sample):** `three-company-monitoring-2026-07-06T11-47-36-751Z.json`

| Metric | Current official fixture (PKR) | Observed in invalid sample (PKR) |
|--------|-------------------------------|-------------------------------------|
| Trial Balance total | 25,303,077 | 26,255,077 |
| Roznamcha Cash In | 3,335,850 | 2,835,850 |
| Roznamcha Cash Out | 1,294,607 | 1,794,607 |
| Roznamcha Closing | 2,041,243 | 1,041,243 |

MR REHAN ALI closing **530,000** — unchanged in invalid sample

## What this is NOT

- Not approved Option A work
- Not eligible for fixture refresh
- Not a GL repair, migration, or production data change
- Not R8
- Not an official Day 7 PASS record

## Safety attestation

| Gate | Status |
|------|--------|
| migrations_run | false |
| gl_mutations | false |
| repairs_run | false |
| production_mutation | none |
| fixture_refresh_applied | **no** |
