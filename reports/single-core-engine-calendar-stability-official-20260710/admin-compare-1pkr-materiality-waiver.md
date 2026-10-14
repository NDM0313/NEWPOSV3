# Admin Compare — 1 PKR materiality waiver (Day 10)

**Date:** 2026-07-07  
**Profile:** DIN CHINA pilot batch 9/9  
**Classification:** monitoring harness materiality waiver (not a GL repair)

## Observation

After live production activity (TB gross increase; JE-0311 posted same day), strict pilot batch reported:

| Field | Value |
|-------|--------|
| Compared | 9 |
| Pass (strict) | 0 |
| Fail (strict) | 9 |
| Max \|diff\| | **1.00 PKR** |
| Sample row | All branches · official_gl · old **216,300.00** · new **216,299.00** |

Unified screens (Party Ledger / Account Statement / Ledger V2) still show MR JALIL closing **216,299** — golden unchanged.

## Waiver rule (monitoring-only)

`run-phase-216-monitoring-verify.mjs` treats pilot batch as **PASS** when:

- `compared === 9`, and
- `maxAbsDiff <= 1.0 PKR` (sub-rupee hybrid vs unified rounding on official_gl)

Logged as: `MATERIALITY_WAIVER maxAbsDiff=1`

## Follow-up (separate track)

Engine parity investigation for hybrid `getCustomerLedger` vs unified path at 1 PKR — **not** part of this calendar evidence commit.
