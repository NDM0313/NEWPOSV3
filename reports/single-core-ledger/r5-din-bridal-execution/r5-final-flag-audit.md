# R5 DIN BRIDAL — Final flag audit

**Date:** 2026-06-27  
**Main commit:** `5ac71545`  
**Status:** **PASS**

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| DIN BRIDAL unified flags | 12 ON | 12 | **PASS** |
| DIN BRIDAL loaders | 5 ON | 5 | **PASS** |
| DIN CHINA unified flags | 12 ON | 12 | **PASS** |
| DIN CHINA loaders | 5 ON | 5 | **PASS** |
| Other-company loaders | 0 | 0 | **PASS** |
| Cross-company leakage | none | none | **PASS** |

SQL: `scripts/single-core-ledger/din-bridal/r5-monitoring-flags-pipe.sql`
