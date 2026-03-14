# ERP Production Bugfix Report

**Date:** 2026-03-13  
**Scope:** Targeted fixes from real physical testing. Safety-first, minimal changes, no destructive cleanup.

---

## Summary

| Issue | Root cause | Fix | Status |
|-------|------------|-----|--------|
| 1. Purchase stock posting twice | Trigger + frontend both created stock_movements | Rely on DB trigger only; removed app-side creation in createPurchase and updateStatus | ✅ |
| 2. Direct contact payment requires sale_id/purchase_id | Dialog required referenceId; no on-account path | On-account payments: reference_type='on_account', reference_id=null, contact_id; new services + dialog branches | ✅ |
| 3. Ledger broken / studio_orders | customerLedgerApi queried dropped table studio_orders | Removed all studio_orders queries; use zero/empty for those contributions | ✅ |
| 4. Contact save slow / get_contact_balances 400 | Invalid RPC params or concurrent loadContacts | Validate branchId (UUID or null); guard against concurrent loadContacts | ✅ |
| 5. Shipping in sales not working | New sale ignored shippingChargeInput in total and DB | Include shipping in total and expenses; create sale_shipments row after new sale when shipping > 0 | ✅ |

---

## Issue 1 — Purchase stock posting twice

- **Root cause:** Stock movements were created by (1) DB trigger `purchase_final_stock_movement_trigger` on INSERT/UPDATE when status = 'final', and (2) PurchaseContext in `createPurchase` and `updateStatus` (STEP 4). Result: double posting per purchase.
- **Fix:** Removed application-side stock movement creation for new purchases and for status change to final. Rely on trigger only. Kept delta stock logic in `updatePurchase` for edits to an already-final purchase.
- **Files changed:** `src/app/context/PurchaseContext.tsx`
- **Migrations/DB:** None
- **Doc:** `docs/ERP_BUGFIX_PURCHASE_DOUBLE_STOCK.md`

---

## Issue 2 — Direct contact payment (on-account)

- **Root cause:** UnifiedPaymentDialog required `referenceId` (sale/purchase UUID); ContactsPage opens the dialog without a document, so "Receive Payment" / "Pay Supplier" failed.
- **Fix:**
  - Migration: allow `payments.reference_type` and `payments.reference_id` to be NULL; ensure `contact_id` exists.
  - New: `saleService.recordOnAccountPayment`, `purchaseService.recordOnAccountPayment` (insert payment with reference_type='on_account', reference_id=null, contact_id).
  - New: `AccountingContext.recordOnAccountCustomerPayment` (Dr Cash/Bank Cr AR with metadata.customerId); `recordSupplierPayment` already supports no purchaseId.
  - Dialog: when !referenceId, use on-account flow (resolve branch, insert payment, post journal). Validation: allow any positive amount when on-account.
  - ContactsPage: pass contact UUID as entityId for payment dialog.
- **Files changed:**  
  `migrations/payments_on_account_null_reference.sql`,  
  `src/app/services/saleService.ts`, `src/app/services/purchaseService.ts`,  
  `src/app/context/AccountingContext.tsx`,  
  `src/app/components/shared/UnifiedPaymentDialog.tsx`,  
  `src/app/components/contacts/ContactsPage.tsx`
- **Migrations:** `payments_on_account_null_reference.sql` (run on DB to allow NULL reference_type/reference_id and ensure contact_id).
- **Doc:** `docs/ERP_BUGFIX_ON_ACCOUNT_PAYMENTS.md`

---

## Issue 3 — Ledger / studio_orders

- **Root cause:** customerLedgerApi queried `studio_orders`, which has been dropped; errors broke or emptied customer ledger.
- **Fix:** Removed all four blocks that queried `studio_orders` (opening balance, range totals, transaction list, second balance path). Use constants (0 / empty) and comments. Studio amounts remain in sales (sales.studio_charges) and appear as "Studio Sale" in the ledger.
- **Files changed:** `src/app/services/customerLedgerApi.ts`
- **Migrations/DB:** None
- **Doc:** `docs/ERP_BUGFIX_LEDGER_STUDIO_ORDERS.md`

---

## Issue 4 — Contact save performance

- **Root cause:** get_contact_balances_summary RPC could receive invalid `p_branch_id` (e.g. empty string) causing 400; multiple loadContacts in flight after save caused repeated reloads.
- **Fix:** In contactService, only pass UUID or null for p_branch_id (reject empty string / 'all' / non-UUID). In ContactsPage, use loadContactsInProgressRef to skip starting a new load while one is running; clear ref in finally.
- **Files changed:** `src/app/services/contactService.ts`, `src/app/components/contacts/ContactsPage.tsx`
- **Migrations/DB:** None
- **Doc:** `docs/ERP_BUGFIX_CONTACT_SAVE_PERFORMANCE.md`

---

## Issue 5 — Shipping in sales

- **Root cause:** For a **new** sale, shipping charge input was not included in totalAmount or in the payload; no sale_shipments row was created, so shipment list and accounting had nothing to attach to.
- **Fix:** effectiveShippingCharges = initialSale?.id ? shipmentChargesFromApi : shippingChargeInput; totalAmount includes it; expenses for new sale include shippingChargeInput; after createSale, if shippingChargeInput > 0, create one sale_shipments row with charged_to_customer = shippingChargeInput (Courier, Pending).
- **Files changed:** `src/app/components/sales/SaleForm.tsx`
- **Migrations/DB:** None
- **Doc:** `docs/ERP_BUGFIX_SHIPPING_FLOW.md`

---

## Functional verification (checklist)

Run after deployment:

1. Create test contact → save completes without repeated reloads; no 400 for balance RPC.
2. Create test product.
3. Create test purchase (final) → verify only one stock movement per line (check stock_movements / stock ledger).
4. Create test sale (with shipping charge) → total includes shipping; one sale_shipments row; can update shipment (courier/tracking).
5. Customer payment: with sale reference (from sale detail) and on-account (from Contacts → Receive Payment) both work.
6. Supplier payment: with purchase reference and on-account (from Contacts → Pay Supplier) both work.
7. Open customer ledger and account ledger → data loads without studio_orders errors.
8. Optional: record timings (contact save, purchase save, dashboard load, ledger load).

---

## Migrations to run

- **payments_on_account_null_reference.sql** — run once on production DB (allows on-account payments). Safe: only alters columns if currently NOT NULL; adds contact_id if missing.

---

## Rollback notes

- **Issue 1:** Restore removed blocks in PurchaseContext (createPurchase and updateStatus) from version control if trigger is disabled.
- **Issue 2:** Revert code and migration (re-enforcing NOT NULL on payments is not recommended if on-account rows exist).
- **Issue 3:** Revert customerLedgerApi; ensure studio_orders table exists if old queries are restored.
- **Issue 4:** Revert contactService and ContactsPage (remove ref guard and param validation).
- **Issue 5:** Revert SaleForm (total/expenses/shippingCharges and post-create shipment block).

---

## Remaining warnings

- Duplicate historical stock_movements for past test purchases: document if found; do not mass-delete without explicit safety checks.
- studioService.ts still references studio_orders (getStudioOrder, getAllStudioOrders); when table is missing they return []/null. No change in this pass.
- Ledger balance logic for studio now uses only sales (no separate studio_orders section); studio sales appear as Sales with documentType "Studio Sale".
