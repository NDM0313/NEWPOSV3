# Phase 2.10B — Baseline loader QA (loader flag OFF)

**Result:** **PASS**  
**Timestamp (UTC):** 2026-06-26T10:15:00Z (approx)  
**Mode:** `baseline`  
**Script:** `scripts/single-core-ledger/run-phase-210-loader-browser-qa.mjs baseline`  
**Base URL:** http://localhost:3002 → VPS `erp-frontend-preview` :3003

## Checks

| Check | Result | Notes |
|-------|--------|-------|
| DIN CHINA admin login | PASS | din@yahoo.com |
| Ledger V2 / Account Statements | PASS | Tab navigation + MR JALIL |
| `data-ledger-v2-main-loader` | PASS | `legacy` |
| Preview toggle visible | PASS | Admin/developer |
| Preview toggle default OFF | PASS | |
| No unified RPC toggle OFF | PASS | 0 calls |
| MR JALIL main closing | PASS | PKR 216,300 |
| Preview toggle ON golden | PASS | MR JALIL golden PASS |
| Admin Compare Center | PASS | |
| Pilot ON / Engine ON | PASS | |
| Party MR JALIL compare | PASS | old=216300 new=216300 |
| Pilot batch | PASS | 9/9 |
| Staff preview hidden | WAIVED | No staff credentials |
| Export spot-check | PASS | Signed — see `export-spot-check-baseline.md` |

## Screenshots

- `screenshots/210-loader-baseline.png`
- `screenshots/210-admin-compare-baseline.png`
- `screenshots/210-export-pdf-preview.png`

## JSON

`browser-qa-baseline.json`

## Confirmed

- Main table remains **legacy** `getLedgerStatementV2` (loader flag OFF)
- No other screen flags enabled
- Cash/Bank / Roznamcha / other screens **not** enabled (waived per Phase 2.9A-CB)
