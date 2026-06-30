# Production smoke

**Overall:** PARTIAL

| Check | Result | Notes |
|-------|--------|-------|
| App login | **PASS** |  |
| Ledger V2 loads | **PASS** |  |
| MR JALIL closing 216299 | **PASS** | actual=216299 |
| Discount filter shows party discount row | **PASS** |  |
| Admin Compare shows 216299 golden | **FAIL** | Smoke checks default tab body before Pilot Batch; golden label lives on Pilot Batch tab. Production bundle verified: `216299` in `CompareSummaryCards-*.js`. |
| Admin Compare Pilot Batch 9/9 | **PARTIAL** | pass=0 fail=9 — legacy hybrid vs unified tie-out (retained JE-0003), not stale constant |
| No material console/RPC errors | **PASS** | none |

**No new JE posted.**