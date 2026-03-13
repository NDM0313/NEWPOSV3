# ERP Bugfix: Shipping in Sales Flow

**Date:** 2026-03-13  
**Issue:** Shipping added inside the sale was not behaving correctly: shipping charge entered for a new sale was not included in the total or persisted.

---

## Root cause

1. **New sale total:** `totalAmount` was computed as `afterDiscountTotal + (initialSale?.id ? shipmentChargesFromApi : 0)`. For a **new** sale (`!initialSale?.id`), the shipping charge input (`shippingChargeInput`) was never added, so the total and the saved sale ignored it.
2. **New sale payload:** `expenses` and `shippingCharges` sent to the backend used `shippingCharges: 0` for new sales, so the DB sale had no shipping amount.
3. **No shipment row for new sale:** When creating a new sale with a shipping amount, no `sale_shipments` row was created, so shipment list, tracking, and shipment accounting had nothing to attach to.

---

## Fix

### 1. Total and payload (SaleForm)

- **effectiveShippingCharges:** Use `initialSale?.id ? shipmentChargesFromApi : (shippingChargeInput || 0)` so that for a new sale the typed shipping amount is used.
- **totalAmount:** Set to `afterDiscountTotal + effectiveShippingCharges` so the grand total always includes shipping (from existing shipments or from input for new sale).
- **expenses:** For new sale, pass `expensesTotal + shippingChargeInput` so the DB sale total matches (expenses column includes the shipping amount when there is no shipment row yet).
- **shippingCharges:** Pass `effectiveShippingCharges` in the payload for consistency.

### 2. Create shipment row after new sale (SaleForm)

- After `createSale(saleData)` succeeds and `shippingChargeInput > 0`, call `shipmentService.create(created.id, companyId, finalBranchId, { shipment_type: 'Courier', charged_to_customer: shippingChargeInput, actual_cost: 0, currency: 'PKR', shipment_status: 'Pending' }, undefined, documentNumber)`.
- This creates a `sale_shipments` row so that:
  - Shipment list and “Update Shipment” (courier, tracking) work.
  - Shipment accounting can post against the shipment.
  - UI and backend stay in sync (one shipment with charged_to_customer = entered amount).

---

## Files changed

- `src/app/components/sales/SaleForm.tsx`: effectiveShippingCharges and totalAmount; expenses/shippingCharges in payload; post-create shipment when shippingChargeInput > 0.

---

## Verification

- **New sale with shipping:** Set status to Final, enter a shipping charge, save. Total includes the charge; sale record has correct total/expenses; one `sale_shipments` row with that charged amount; can open “Update Shipment” to set courier/tracking.
- **Edit sale with shipment:** Existing flow unchanged: shipment charges from API, Add/Update Shipment modal, totals and accounting as before.

---

## Rollback

- Revert SaleForm changes: restore `totalAmount = afterDiscountTotal + (initialSale?.id ? shipmentChargesFromApi : 0)`, `expenses: expensesTotal`, `shippingCharges: initialSale?.id ? ... : 0`, and remove the post-create `shipmentService.create` block.
