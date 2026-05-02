# Purchase Stability - Remaining Tasks

Date: 2026-04-29

## Completed in current push set

- Company reset RPC now clears sequence tables for company-level restart to `001`.
- Business bootstrap seeds `document_sequences_global` and `erp_document_sequences`.
- Mobile purchase API now:
  - uses global `PDR/POR/PUR` number allocation by status,
  - persists discount into `purchase_charges` (web parity),
  - includes purchase-level attachments in create/read paths,
  - parses payment attachments from both array and JSON-string formats.
- Purchase posting engine now has defensive discount fallback (header discount -> synthetic discount charge when missing).
- Web accounting and purchases pages now include realtime-based cross-client refresh hooks.

## Remaining tasks

1. **JE allocator unification** ✅
   - Move ad-hoc `JE-*` generation to one canonical sequence path where required.
   - Target files:
     - `src/app/services/documentNumberService.ts`
     - `src/app/context/PurchaseContext.tsx`
     - `src/app/context/SalesContext.tsx`

2. **Mobile create flow attachment input UI** ✅
   - Add purchase attachment picker/uploader in mobile purchase create flow and send to API payload.
   - Target file:
     - `erp-mobile-app/src/components/purchase/CreatePurchaseFlow.tsx`

3. **Purchase accounting service defensive fallback parity** ✅
   - Add/confirm fallback in purchase accounting service for legacy rows where discount charge may be absent.
   - Target file:
     - `src/app/services/purchaseAccountingService.ts`

4. **Mutation invalidation standardization** ✅
   - Standardize mutation emitters so same-tab and cross-client behavior remain consistent without duplicate refresh storms.
   - Target files:
     - `src/app/lib/dataInvalidationBus.ts`
     - related purchase/payment mutation call-sites.

5. **Post-deploy verification** 🟨 Partial (automated done, UI checks pending)
   - ✅ Automated live DB verification script run:
     - `COMPANY_ID=595c08c2-1e47-4581-89c9-1f78de51c613 npm run verify:final`
     - Output: `docs/accounting/RESET COMPANY/FINAL_ACCEPTANCE_RESULT.md`
     - Trial balance = 0, AR/AP reconciled, no unbalanced JE.
   - ✅ Build/type safety:
     - `npm run typecheck:mobile`
     - `npm run build`
     - `npm --prefix erp-mobile-app run build`
   - ⏳ Manual UI validation still required on device/web session:
     - mobile purchase attachments visible in purchase detail screen,
     - web auto-refresh triggers after mobile create/payment in another client tab.
