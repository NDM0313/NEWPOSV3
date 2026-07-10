# Post-correction drift check — 4000 canonical

**Date:** 2026-07-10  
**Correction commit:** `8adf5ff2`  
**Deploy timestamp:** `2026-07-10T18:21:44Z` (nginx `Last-Modified` on https://erp.dincouture.pk)  
**Method:** Read-only production SQL  
**DB mutation:** no

## Drift status

**`PENDING_OBSERVATION`**

No post-correction finalized sale activity yet. No erroneous **4100** native sale posting detected.

## Summary

| Metric | Value |
|--------|-------|
| New 4000 merchandise revenue JEs after correction deploy | **0** |
| New 4100 merchandise revenue JEs after correction deploy | **0** |
| Post-correction sale document JEs | **0** |
| Sale references found | **none** |

## Expected behavior (after next natural sale)

- Revenue credit should post to **4000** when both accounts exist
- **4100** should not receive new native sale revenue while **4000** exists
- If native post-correction sale credits **4100** → `FAIL_4100_POSTING_AFTER_4000_CORRECTION`

## Prior context

- `b7fa557d` briefly set 4100-first (deployed 2026-07-10T17:06:53Z) — **no post-cutoff sales occurred** before correction
- No live proof was ever collected for 4100-first policy

## Safety

| Item | Status |
|------|--------|
| DB migrations | not run |
| Transfer JE | not run |
| GL mutation | none |
