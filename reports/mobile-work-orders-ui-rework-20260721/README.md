# Mobile Work Orders UI rework — 2026-07-21

## Changes

| Item | Result |
|------|--------|
| Sale create form | Hidden when WO already exists; **+ Add work order** reveals form |
| WO row click | Opens `WorkOrderDetailSheet` (sale detail + company list) |
| Home module | **Work Orders** icon (bespoke-enabled companies only) |
| Sales header | **WOs** tab removed |

## Files

- `erp-mobile-app/src/components/sales/WorkOrderDetailSheet.tsx`
- `erp-mobile-app/src/components/sales/WorkOrdersModule.tsx`
- `SaleBespokeWorkOrders.tsx`, `WorkOrdersList.tsx`, `SalesHome.tsx`
- `HomeScreen.tsx`, `App.tsx`, `types.ts`, `permissionModules.ts`

## Delivery

| Item | Value |
|------|--------|
| Branch | `main` |
| Deploy | `deploy/vps-build-erp-only.sh` |
| Mobile | `https://erp.dincouture.pk/m/` |

Hard-refresh `/m/` after deploy.
