# Post-standardization drift check — 4000 vs 4100

**Date:** 2026-07-10 (re-checked)  
**Standardization commit:** `b7fa557d`  
**Latest observation commit:** `b74408d3`  
**Cutoff timestamp:** `2026-07-10T17:06:53Z` (ERP frontend deploy of `b7fa557d`)  
**Checked at:** `2026-07-10T17:53:00Z`  
**Method:** Read-only production SQL  
**DB mutation:** no

## Drift status

**`PASS_NO_DRIFT_NO_ACTIVITY`**

No post-cutoff merchandise revenue postings on either **4000** or **4100**. No erroneous 4000 drift detected.

## Summary

| Metric | Value |
|--------|-------|
| New 4000 merchandise revenue JEs after cutoff | **0** |
| New 4100 merchandise revenue JEs after cutoff | **0** |
| New sale_return revenue debits on 4000 after cutoff | **0** |
| New sale_return revenue debits on 4100 after cutoff | **0** |
| Post-cutoff sale document JEs | **0** |
| Sale references found | **none** |

## Decision matrix

| Condition | Status |
|-----------|--------|
| New sale posts to 4100 | `PASS_4100_POSTING_CONFIRMED` — **not yet observed** |
| No sale exists after cutoff | `PASS_NO_DRIFT_NO_ACTIVITY` — **current** |
| New sale posts to 4000 while 4100 exists | `FAIL_4000_POSTING_AFTER_STANDARDIZATION` — **not observed** |

## Companies checked

### DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

| Code | Post-cutoff sale credits | Post-cutoff return debits |
|------|--------------------------|---------------------------|
| 4000 | 0 | 0 |
| 4100 | 0 | 0 |

All-time: 4000 net Rs. 1,573,600; 4100 net Rs. 49,685,321.98

### DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)

| Code | Post-cutoff sale credits | Post-cutoff return debits |
|------|--------------------------|---------------------------|
| 4000 | 0 | 0 |
| 4100 | 0 | 0 |

All-time: 4000 net Rs. 943,750; 4100 net Rs. 0

### DIN COUTURE (`2ab65903-62a3-4bcf-bced-076b681e9b74`)

| Code | Post-cutoff sale credits | Post-cutoff return debits |
|------|--------------------------|---------------------------|
| 4000 | 0 | 0 |
| 4100 | 0 | 0 |

All-time: 4000 net Rs. 21,250; 4100 net Rs. 0

## Interpretation

- No bug indicated — no finalized sale since deploy
- First real sale proof: `PENDING_OBSERVATION` in `first-real-sale-4100-proof.md`
- Re-check after next natural finalized sale

## Safety

| Item | Status |
|------|--------|
| DB migrations | not run |
| Transfer JE | not run |
| GL mutation | none |
