# R5 Stage 1 — DIN BRIDAL pilot ON

**Date:** 2026-06-27  
**SQL:** `scripts/single-core-ledger/din-bridal/r5-enable-pilot.sql`  
**Rollback:** `scripts/single-core-ledger/din-bridal/r5-rollback-pilot.sql`  
**Company id:** `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`

## Result: PASS

| Check | Expected | Actual |
|-------|----------|--------|
| unified_ledger_pilot | ON | ON |
| unified_ledger_engine | OFF | OFF |
| Screen flags | OFF | OFF |
| Loader flags | OFF | OFF |
| DIN CHINA | 12 ON unchanged | PASS |
| Other expansion loaders | 0 (DIN COUTURE) | PASS |
