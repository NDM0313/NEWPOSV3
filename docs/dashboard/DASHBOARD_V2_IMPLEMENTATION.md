# Dashboard V2 Implementation

## Summary

Replaced monolithic `Dashboard.tsx` with modular Dashboard V2 under `src/app/components/dashboard/v2/`, backed by a single facade (`dashboardV2Service.ts`) and optional RPC `get_dashboard_v2_snapshot`.

## Files added

| Path | Role |
|------|------|
| `migrations/20260610120000_dashboard_v2_snapshot_rpc.sql` | Additive read-only RPC |
| `src/app/services/dashboardV2Service.ts` | Single load facade + 60s cache |
| `src/app/hooks/useDashboardV2.ts` | Hook wired to global filter |
| `src/app/lib/dashboardV2Period.ts` | Prior period window + trend % |
| `src/app/lib/dashboardV2Stock.ts` | Unified low/out/negative stock rules |
| `src/app/lib/dashboardV2Mappers.ts` | RPC → snapshot mapping |
| `src/app/components/dashboard/v2/*` | Page shell, cards, alerts, charts, operations |
| `docs/dashboard/DASHBOARD_V2_AUDIT.md` | Phase 1 audit |

## Files changed

| Path | Change |
|------|--------|
| `src/app/App.tsx` | Route `dashboard` → `DashboardV2Page` |
| `src/app/components/dashboard/DashboardLegacy.tsx` | Renamed from `Dashboard.tsx`; exports `CreateYourBusinessCard` |
| `src/app/components/layout/NotificationsDropdown.tsx` | Passes `branchId` into low-stock fetch |
| `src/app/services/financialDashboardService.ts` | Export `parseFinancialMetrics` for V2 facade |
| `package.json` | Dashboard V2 unit tests in `test:unit` |

## Per-card data source

| Widget | Source | Filter |
|--------|--------|--------|
| Period sales / purchases / OpEx / trends | `get_dashboard_v2_snapshot` or `get_dashboard_metrics` | Date + branch |
| Net profit | Operational: sales − purchases − paid expenses | Same |
| Cash / bank | GL via `get_financial_dashboard_metrics` path in metrics pack | Company-wide |
| AR / AP | `get_contact_balances_summary` via metrics RPC | Branch when selected |
| Low stock alerts + table | `inventoryService.getInventoryOverview` + `dashboardV2Stock` | Branch when selected |
| Rentals | RPC `rental_alerts` subquery | Branch when selected |
| Recent activity lists | RPC subqueries | Date + branch |
| Branch breakdown | RPC when all branches | Period dates |

## Limitations (v1)

- Profit is operational estimate, not GL P&L.
- COGS not journal-sourced — use Profit & Loss report.
- Cash/bank company-wide; no per-branch GL split on cards.
- VPS must apply `20260610120000` for full V2 RPC; otherwise facade falls back to `get_dashboard_metrics` + client enrichment.

## Manual verification checklist

1. Open dashboard as owner — summary cards match global date filter.
2. Switch branch — period metrics and stock table update; cash/bank unchanged.
3. Low stock alert count equals operations table row count.
4. All branches — branch breakdown table visible.
5. Worker role — no money cards; stock/rental alerts still visible.
6. Wide date range with no docs — empty state message shown.
7. Refresh button updates `lastUpdated`.
8. Notifications dropdown low stock respects branch filter.
9. `npm run test:unit` passes.
10. `npm run build` passes.

## Deploy note

Apply migration on VPS separately:

```bash
# On VPS after pull
node scripts/run-migrations.js
```
