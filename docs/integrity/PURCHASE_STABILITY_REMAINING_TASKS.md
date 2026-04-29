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

1. **JE allocator unification**
   - Move ad-hoc `JE-*` generation to one canonical sequence path where required.
   - Target files:
     - `src/app/services/documentNumberService.ts`
     - `src/app/context/PurchaseContext.tsx`
     - `src/app/context/SalesContext.tsx`

2. **Mobile create flow attachment input UI**
   - Add purchase attachment picker/uploader in mobile purchase create flow and send to API payload.
   - Target file:
     - `erp-mobile-app/src/components/purchase/CreatePurchaseFlow.tsx`

3. **Purchase accounting service defensive fallback parity**
   - Add/confirm fallback in purchase accounting service for legacy rows where discount charge may be absent.
   - Target file:
     - `src/app/services/purchaseAccountingService.ts`

4. **Mutation invalidation standardization**
   - Standardize mutation emitters so same-tab and cross-client behavior remain consistent without duplicate refresh storms.
   - Target files:
     - `src/app/lib/dataInvalidationBus.ts`
     - related purchase/payment mutation call-sites.

5. **Post-deploy verification**
   - Validate on live DB after running migrations:
     - first POR/PUR/Sale/JE starts at `001` for reset company,
     - discount JE reflects correctly (e.g., 500),
     - mobile purchase attachments visible in details,
     - web auto-refresh works after mobile create/payment.
