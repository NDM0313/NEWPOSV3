# Completed tasks — 18 April 2026

Summary of work shipped or finalized in this session for the **Studio stock + UX** initiative and related fixes.

## Studio duplicate `PRODUCTION_IN` / stock ledger

- Aligned `PRODUCTION_IN` dedupe across `createProductFromProductionOrder` and `ensureStudioProductionInForSale` (canonical `studio_productions.id` / consistent reference keys).
- Updated [`src/app/services/studioStockLifecycleService.ts`](src/app/services/studioStockLifecycleService.ts) and [`src/app/services/studioCustomerInvoiceService.ts`](src/app/services/studioCustomerInvoiceService.ts).
- Mirrored dedupe logic in [`erp-mobile-app/src/api/studioStockLifecycle.ts`](erp-mobile-app/src/api/studioStockLifecycle.ts) where applicable.

## Purchases list refresh churn

- Refactored [`src/app/components/purchases/PurchasesPage.tsx`](src/app/components/purchases/PurchasesPage.tsx): stable sync key for context → local state, single refresh pipeline via `refreshPurchases`, removed redundant `loadPurchases` pairing where redundant.

## Blocking overlays (async saves)

- Mobile: full-card blocking overlay while payment posts in [`erp-mobile-app/src/components/studio/StudioOrderDetail.tsx`](erp-mobile-app/src/components/studio/StudioOrderDetail.tsx).
- Web: modal overlay + disabled close while ledger loads in [`src/app/components/products/FullStockLedgerView.tsx`](src/app/components/products/FullStockLedgerView.tsx).

## Mobile worker payment parity (web-aligned)

- Worker payment choice after receive: **No, pay later** closes without `rpc_confirm_stage_payment` accrual; **Yes, pay now** gated on invoice linked + all stages complete (matches [`StudioSaleDetailNew.tsx`](src/app/components/studio/StudioSaleDetailNew.tsx) behavior).
- Accrual-only control labeled and shown only when eligible.

## Follow-up UX (same day)

- **No, pay later** on the worker payment sheet now also **completes the stage** (calls `onCompleteStage`), so the pipeline advances without worker settlement—same practical outcome as skipping payment and pressing **Complete Stage** when internal cost was already recorded.

## Optional / related repo changes in this push

- Includes other modified files in the working tree at commit time (accounting, sales, realtime, inventory touchpoints, migration `20260518_rename_account_5000_cost_of_production.sql`) as bundled with this upload—review commit diff on GitHub for the exact set.

---

*Generated for traceability; adjust filename/date if you standardize docs under `docs/`.*
