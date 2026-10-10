# DIN BRIDAL Trial Balance drift diagnosis (read-only)

**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**Method:** Read-only Playwright monitoring against production unified TB loader (wide date range 2000-01-01 → today)

## Totals

| Metric | Golden (PKR) | Current actual (PKR) | Delta (PKR) |
|--------|--------------|----------------------|-------------|
| Total debit | 22,056,075 | 22,215,400 | +159,325 |
| Total credit | 22,056,075 | 22,215,400 | +159,325 |
| Debit = credit | — | **Yes** | — |

**Source:** `three-company-monitoring-2026-07-01T12-31-25-103Z.json`

## Account-level delta

Account-level row comparison was **not** run in this read-only pass (anon Supabase RPC returns empty without authenticated session). Operator should run a separate read-only authenticated TB export diff if account attribution is required.

## BS/P&L mobile goldens

| Screen | Golden | Device QA (2026-07-01) |
|--------|--------|------------------------|
| Balance Sheet assets | 13,521,792 | **PASS** |
| P&L net | 119,992 | **PASS** |

Mobile Admin QA remains valid — drift is in **monitoring TB total golden**, not BS/P&L screen goldens verified on Pixel 6 Pro.

## Timeline

- Post-1100 golden refresh (2026-06-30): TB **22,056,075** — monitoring PASS
- 2026-07-01 through 11:32 UTC: still **22,056,075** — PASS
- 2026-07-01 from 11:58 UTC: **22,136,075** (+80,000)
- 2026-07-01 12:31 UTC: **22,215,400** (+79,325 additional)

## Linked factors

| Factor | Assessment |
|--------|------------|
| 1100 Option C apply | Not cause — golden already refreshed; stable until July 1 afternoon |
| BS/P&L loader swap | Not cause — loaders unified; other companies PASS |
| Monitoring flag count | Unchanged (18/18) |
| Stale fixture | Fixture frozen at post-apply baseline |
| New production activity | **Primary** — balanced increases after last refresh |
| Report basis mismatch | Unlikely — debit=credit; unified loader |

**Preliminary classification:** `NEW_UNAPPROVED_DATA_DRIFT` (golden refresh is separate operator-approved path if activity is legitimate).
