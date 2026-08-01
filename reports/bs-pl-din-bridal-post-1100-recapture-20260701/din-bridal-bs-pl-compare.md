# DIN BRIDAL BS/P&L post-1100 compare

**Captured:** 2026-07-01 (after JV-000209 / JV-000210)  
**Classification:** `ZERO_DIFF_READY_FOR_FINANCE_REVIEW`

## Balance Sheet (as at 2026-07-01)

| Field | Legacy | Unified preview | Δ |
|-------|--------|-----------------|---|
| Total Assets | PKR 13,521,792 | PKR 13,521,792 | **0** |
| Total Liabilities | PKR -547,191 | PKR -547,191 | **0** |
| Total Equity | PKR 14,068,983 | PKR 14,068,983 | **0** |
| Liabilities + Equity | PKR 13,521,792 | PKR 13,521,792 | **0** |
| A − (L+E) | 0 | 0 | **0** |

**Section-level deltas:** All zero.  
**Line-level:** Export JSON has 28 asset / 6 liability / 4 equity lines; section compare pass — no line-level drift reported in diff engine.  
**Net income in preview rollup:** PKR 139,992

### vs pre-1100 capture (2026-06-29)

Section totals **unchanged** — 1100 AR reclass is within AR sub-ledgers; BS section aggregates match prior capture.

## Profit & Loss (2000-01-01 → 2026-07-01)

| Field | Legacy | Unified preview | Δ |
|-------|--------|-----------------|---|
| Revenue | PKR 354,500 | PKR 354,500 | **0** |
| Cost of Sales | PKR 49,028 | PKR 49,028 | **0** |
| Gross Profit | PKR 305,472 | PKR 305,472 | **0** |
| Expenses | PKR 185,480 | PKR 185,480 | **0** |
| Net Profit | PKR 119,992 | PKR 119,992 | **0** |

**Section-level deltas:** All zero.

## Engine state (read-only)

- `screenFlagEnabled`: false (loader swap **not** enabled)
- `mode`: preview
- Compare pass: **true**

## Evidence

- `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/exports/din-bridal-balance-sheet-preview.json`
- `reports/single-core-ledger/phase-3d-bs-pl-golden-capture/exports/din-bridal-profit-loss-preview.json`
- Screenshots in `phase-3d-bs-pl-golden-capture/screenshots/`

## Remaining before loader swap

Finance rule confirmations (BS equity rollup, P&L COGS mapping) and signed operator approval still required. **Loader swap not approved.**
