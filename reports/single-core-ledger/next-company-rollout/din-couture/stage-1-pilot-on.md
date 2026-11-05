# Stage 1 — DIN COUTURE pilot ON

**Date:** 2026-06-27  
**SQL:** `scripts/single-core-ledger/din-couture/dc-enable-pilot.sql`  
**Rollback:** `dc-rollback-pilot.sql`  
**Company id:** `2ab65903-62a3-4bcf-bced-076b681e9b74`

## Result: PASS

| Check | Expected | Actual |
|-------|----------|--------|
| unified_ledger_pilot | ON | ON |
| unified_ledger_engine | OFF | OFF |
| Screen flags | OFF | OFF |
| Loader flags | OFF | OFF |
| DIN CHINA / DIN BRIDAL | unchanged | PASS |
