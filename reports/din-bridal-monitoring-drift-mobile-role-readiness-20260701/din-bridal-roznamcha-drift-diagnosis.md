# DIN BRIDAL Roznamcha drift diagnosis (read-only)

**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**Method:** Read-only Playwright — unified roznamcha main loader; body-text Cash In / Cash Out / Closing summary

## Failing metrics

| Metric | Expected (PKR) | Actual (PKR) | Delta (PKR) |
|--------|----------------|--------------|-------------|
| Cash In | 1,836,350 | 1,916,350 | +80,000 |
| Closing Balance | 918,570 | 998,570 | +80,000 |

## Passing metrics

| Metric | Golden | Actual | Result |
|--------|--------|--------|--------|
| Cash Out | 917,780 | 917,780 | PASS |
| Main loader | unified | unified | PASS |
| Preview compare | legacy_shadow | legacy_shadow | PASS |

## Balance mechanics

Cash In and Closing both rose by **exactly PKR 80,000** while Cash Out unchanged — consistent with a net liquidity inflow event, not a loader swap regression.

## Visibility / semantics

| Check | Result |
|-------|--------|
| Default report visibility changed | No evidence |
| correction_reversal / void / cancel visibility | Not indicated — party golden MR REHAN ALI still 530,000 |
| Cash Flow / BS / P&L flags | Unrelated — 18/18 flags stable |

## RPC proxy vs browser golden

`golden-fixtures.json` documents `rpc_proxy_baseline.roznamcha_cash_in_pkr = 1,916,350` from 2026-06-27 RPC capture, while monitoring uses browser capture **1,836,350**. Live browser matched **1,836,350** through 2026-07-01T11:32Z, then jumped to **1,916,350** at 11:58Z — indicating **new activity** (+80k), not merely exposing a static RPC/browser methodology gap.

## Stale golden vs regression

| Hypothesis | Verdict |
|------------|---------|
| Stale golden (fixture not refreshed) | Partial — fixture frozen since 2026-06-27 browser capture for roznamcha |
| Report regression | **Unlikely** — loaders pass; cash out stable; din-china/din-couture PASS |
| New unapproved data drift | **Primary** — +80k aligned with TB drift onset |

**Preliminary classification:** `NEW_UNAPPROVED_DATA_DRIFT`
