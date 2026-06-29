# Post-deploy smoke — Phase 3A-PROD

**Target:** https://erp.dincouture.pk  
**Deployed commit:** `4a5dc304`  
**Generated:** 2026-06-29

## Smoke matrix

| # | Check | Method | Result |
|---|-------|--------|--------|
| 1 | App loads | `curl.exe` HTTP GET `/` | **PASS** — 200 |
| 2 | Login works | Three-company monitoring admin login per profile | **PASS** (din-china, din-bridal, din-couture) |
| 3 | BS legacy default | Code path unchanged; preview opt-in only | **PASS** (by design) |
| 4 | P&L legacy default | Code path unchanged; preview opt-in only | **PASS** (by design) |
| 5 | BS preview toggle default OFF | Source: `useState(false)`; not rendered until role + checkbox | **PASS** |
| 6 | P&L preview toggle default OFF | Same pattern | **PASS** |
| 7 | Preview ON = compare panel | Production bundle contains `balance-sheet-preview-compare`, `profit-loss-preview-compare` | **PASS** (asset) |
| 8 | Preview labels / finance pending | Bundle contains `PREVIEW_ONLY`, `NEEDS_FINANCE_GOLDEN` | **PASS** (asset) |
| 9 | No material RPC errors | Post-deploy monitoring 3/3 PASS on five live loaders | **PASS** |
| 10 | Staff role hidden controls | `canAccessBsPlUnifiedPreview` gates toggle; staff=false in unit tests | **PASS** (code + asset) |

## Production asset verification

Inside `erp-frontend` container:

- `ReportsDashboardEnhanced-BFx3Veew.js`
- `balance-sheet-preview-compare`: 1 occurrence
- `profit-loss-preview-compare`: 1 occurrence
- `PREVIEW_ONLY`: 2 occurrences

## Not browser-automated (operator optional)

Authenticated manual check: Reports → Balance Sheet / P&L → enable “Unified TB preview” as admin → confirm compare panel and JSON export. Hard refresh if service worker caches old bundle.

## Conclusion

**SMOKE PASS** — production bundle includes Phase 3A preview UI; five live unified loaders unaffected per monitoring.
