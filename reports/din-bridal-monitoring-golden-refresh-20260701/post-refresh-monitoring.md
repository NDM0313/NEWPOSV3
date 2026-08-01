# Post-refresh monitoring

| Item | Value |
|------|-------|
| Run | DIN BRIDAL MONITORING GOLDEN REFRESH |
| Generated | 2026-07-01 |
| Command | `npm run monitor:three-company-unified-ledger` |
| Artifact | `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-01T14-18-15-475Z.json` |
| Overall | **PASS** |

## Company results

| Company | Result |
|---------|--------|
| DIN CHINA | PASS |
| DIN BRIDAL | **PASS** |
| DIN COUTURE | PASS |

## DIN BRIDAL verified actuals (match refreshed goldens)

| Metric | Value (PKR) |
|--------|-------------|
| Trial Balance total | **22,390,400** |
| Roznamcha Cash In | **2,116,850** |
| Roznamcha Cash Out | **917,780** |
| Roznamcha Closing | **1,199,070** |
| MR REHAN ALI closing | **530,000** |

## Guards

| Check | Result |
|-------|--------|
| migrations_run | false |
| gl_mutations | false |
| flags | 18/18 unchanged per company |
| Admin Compare (din-china) | 9/9 PASS |
| Admin Compare (din-bridal) | waived (profile skip) |
