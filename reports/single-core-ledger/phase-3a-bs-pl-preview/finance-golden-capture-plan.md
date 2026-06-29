# Finance golden capture plan — BS / P&L

**Status:** NEEDS_GOLDEN_CAPTURE — **do not invent numbers**

## Companies

DIN CHINA · DIN BRIDAL · DIN COUTURE

## Per company capture (finance-led)

### Balance Sheet

| Capture item | Notes |
|--------------|-------|
| As-of date | Align with monitoring window or fiscal month-end |
| Branch matrix | All branches + single branch if material |
| Total Assets | From signed finance workbook |
| Total Liabilities | |
| Total Equity incl. net income | |
| A − (L+E) | Should be 0 unless known TB imbalance |
| Basis | `official_gl` for production adoption |

### Profit & Loss

| Capture item | Notes |
|--------------|-------|
| Period | e.g. YTD or fiscal month |
| Revenue total | |
| Cost of Sales total | COGS mapping must be signed |
| Gross profit | |
| Operating expenses | |
| Net profit | |

## Process

1. Run Phase 3A preview compare on office PC with per-company credentials
2. Export compare JSON from preview panel
3. Finance reviews deltas vs legacy main
4. Finance signs golden markdown/json under `reports/single-core-ledger/phase-3-golden-capture/` (future phase 3D)
5. Only then consider Phase 3E loader swap

## Stop

Do not adopt preview totals as production truth until finance sign-off.
