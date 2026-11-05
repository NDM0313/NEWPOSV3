# DIN CHINA failure note — Official Day 7 valid-date run

**Local date:** 2026-07-07  
**Artifact:** `three-company-monitoring-2026-07-07T06-28-37-319Z`  
**Classification:** **NOT FIXTURE_ONLY** — requires operator/finance review

## Observed failures

| Check | Expected / fixture | Actual |
|-------|---------------------|--------|
| Roznamcha Cash In | 136,158,012 | **NaN** |
| Roznamcha Cash Out | 67,042,426 | **NaN** |
| Roznamcha Closing | 69,115,586 | **NaN** |
| TB debit = credit | balanced | debit **393,034,262.02** vs credit **393,034,072.02** (Δ **190 PKR**) |
| TB golden total | 407,957,272.02 | debit **393,034,262.02** |

## Passed checks

- Loader guard, flags, admin login, roznamcha loader unified
- MR JALIL party/ledger/statement: closing **216,299**
- Admin Compare Pilot Batch: **9/9 PASS**
- No material console/RPC errors

## Implication

This is **not** the same as DIN BRIDAL golden drift (live activity within balanced TB). DIN CHINA shows:

1. Roznamcha summary parse failure (NaN) — possible UI/harness regression or page load issue
2. Trial Balance **out of balance** by 190 PKR on production

**Do not** apply Option A fixture refresh for DIN CHINA without finance sign-off.  
**Do not** run repairs or migrations as part of calendar stability automation.

## Next

Operator review DIN CHINA TB 190 PKR variance and roznamcha NaN before re-running Official Day 7.
