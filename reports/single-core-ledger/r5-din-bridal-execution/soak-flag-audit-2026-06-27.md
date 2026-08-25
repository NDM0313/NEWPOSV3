# R5 DIN BRIDAL — Soak flag audit (2026-06-27)

**Run:** R5 DIN BRIDAL SOAK MONITORING + FINAL COMPLETION RUN  
**Date:** 2026-06-27  
**Main commit:** `aeb4058b`  
**Status:** **PASS**

## Production read-only audit

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| DIN BRIDAL unified flags ON | 12 | 12 | **PASS** |
| DIN BRIDAL loaders ON | 5 | 5 | **PASS** |
| DIN CHINA unified flags ON | 12 | 12 | **PASS** |
| DIN CHINA loaders ON | 5 | 5 | **PASS** |
| DIN COUTURE loaders | 0 | 0 (no rows) | **PASS** |
| Cross-company leakage | none | none | **PASS** |

Audit SQL: `scripts/single-core-ledger/din-bridal/r5-monitoring-flags-pipe.sql`
