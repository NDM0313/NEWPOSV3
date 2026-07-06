# Attempted Official Day 7 — invalid same-date sample (2026-07-06)

**Classification:** `DATE_GATE_BYPASSED_SAMPLE_FAIL_NOT_CALENDAR_COUNTED`

This run was executed on **2026-07-06** after bypassing the Official Day 7 date gate.  
It is **NOT** counted as Official Calendar Day 7.  
It is **NOT** eligible for Official Day 7 fixture refresh.  
It is retained only as local blocked/invalid diagnostic evidence.

Official Day 7 must be re-run on **2026-07-07** or later.  
If legitimate golden drift appears on the valid Day 7 run, create a fresh Option A approval note using the actual values from that valid-date run.

---

| Item | Value |
|------|--------|
| Run local date/time | 2026-07-06 16:47:34 → 16:58:32 +05:00 |
| Attempted official day | **7** |
| Official Day 7 counted | **NO** |
| Monitoring artifact | `three-company-monitoring-2026-07-06T11-47-36-751Z` |
| Overall | **FAIL** (DIN BRIDAL golden drift — diagnostic only) |

## Profile results (diagnostic only)

| Company | Result | Notes |
|---------|--------|-------|
| DIN CHINA | PASS | 19/19 checks |
| DIN BRIDAL | **FAIL** | 14/19 — Roznamcha golden + TB golden |
| DIN COUTURE | PASS | 18/19 |

## Loader guard

**PASS** — read-only flag guard OK

## DIN BRIDAL drift observed (do not apply as fixture refresh)

Fixture baseline after Official Day 6 (counted). Values below are from invalid same-date sample only:

| Check | Fixture (PKR) | Observed (PKR) | Delta |
|-------|---------------|----------------|-------|
| Trial Balance golden total | 25,303,077 | 26,255,077 | +952,000 |
| Roznamcha Cash In | 3,335,850 | 2,835,850 | −500,000 |
| Roznamcha Cash Out | 1,294,607 | 1,794,607 | +500,000 |
| Roznamcha Closing | 2,041,243 | 1,041,243 | −1,000,000 |

MR REHAN ALI party/ledger checks: **PASS** (530,000 unchanged)  
Trial Balance debit = credit: **PASS** (26,255,077) at time of invalid sample

## Actions taken

- No repair
- No migration
- **No fixture refresh** — not eligible from this run
- No GL/business data mutation
- Tests/build not run
- **No commit/push** of official Day 7

## Valid baseline unchanged

- Official Day 6: PASS / counted — commit `80ad4115`
- Official Day 7: **NOT RUN / NOT COUNTED**

## Safety

| Gate | Status |
|------|--------|
| R8 run | no |
| DB migrations | no |
| Repairs | no |
| GL mutation | no |
| Play Store | no |
| Passwords committed | no |
