# Post-standardization drift check — 4000 vs 4100

**Date:** 2026-07-10  
**Standardization commit:** `b7fa557d`  
**Cutoff timestamp:** `2026-07-10T17:06:53Z` (ERP frontend deploy — nginx `Last-Modified` on https://erp.dincouture.pk)  
**Method:** Read-only production SQL  
**DB mutation:** no

## Summary

| Metric | Value |
|--------|-------|
| New 4000 merchandise revenue JEs after cutoff | **0** |
| New 4100 merchandise revenue JEs after cutoff | **0** |
| New sale_return revenue debits on 4000 after cutoff | **0** |
| New sale_return revenue debits on 4100 after cutoff | **0** |
| **Drift check result** | **PASS** (vacuous — no post-deploy revenue postings yet; no erroneous 4000 drift) |

## Companies checked

### DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

| Code | Post-cutoff sale credits | Post-cutoff return debits |
|------|--------------------------|---------------------------|
| 4000 | 0 | 0 |
| 4100 | 0 | 0 |

All-time context: 4000 net Rs. 1,573,600 (3 sales); 4100 net Rs. 49,685,321.98 (92 sales + 4 returns)

### DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)

| Code | Post-cutoff sale credits | Post-cutoff return debits |
|------|--------------------------|---------------------------|
| 4000 | 0 | 0 |
| 4100 | 0 | 0 |

All-time context: 4000 net Rs. 943,750 (26 sales); 4100 net Rs. 0 (no JE activity)

### DIN COUTURE (`2ab65903-62a3-4bcf-bced-076b681e9b74`)

| Code | Post-cutoff sale credits | Post-cutoff return debits |
|------|--------------------------|---------------------------|
| 4000 | 0 | 0 |
| 4100 | 0 | 0 |

All-time context: 4000 net Rs. 21,250 (1 sale); 4100 net Rs. 0

## Interpretation

- **PASS** — no new revenue posted to **4000** after deploy while **4100** exists
- Observation window is short (~20 minutes between deploy and this check); absence of new sales is expected
- Next finalized sale is the definitive live proof — expect **4100** credit

## Safety

| Item | Status |
|------|--------|
| DB migrations | not run |
| Transfer JE | not run |
| GL mutation | none |
