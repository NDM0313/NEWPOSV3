# PF-03 — Shipping–Sale Total Sync — Execution Result

## 1. Root cause

- **Double-count / stale totals:** When a sale had shipping (from `sale_shipments.charged_to_customer`), the DB trigger correctly set `sales.shipment_charges` and `due_amount = (total + shipment_charges + studio_charges) - paid`. But on **sale edit**, the form sent `total = product + shipping` (grand total) and sometimes did not sync the shipping amount to `sale_shipments`. So:
  - **Edit with shipment:** `sales.total` was updated to product+shipping; trigger was not re-run (no shipment row change), so `due_amount` could be wrong if the user later changed shipping in the “Update Shipment” modal (trigger would then set `due = (total + new_shipment_charges) - paid` = product + old shipping + new shipping − paid = double-count of shipping).
  - **Edit without shipment:** If the user added shipping only via the form (sale_charges), no `sale_shipments` row was created, so `shipment_charges` stayed 0 and `due_amount` did not include shipping.
- **Single source of truth:** The intended model is: `sales.total` = product (+ expenses) only; `sales.shipment_charges` = SUM(sale_shipments.charged_to_customer), set by trigger; `due_amount` = (total + shipment_charges + studio_charges) − paid. The form was not consistently persisting product-only total on edit and was not syncing form shipping to `sale_shipments`.

## 2. Was fix code-level or company-scoped?

**Code-level only.** No company-specific SQL or data repair. The fix is in the sale form and sales context and applies to all companies (NEW and OLD business).

## 3. What was applied on NEW BUSINESS ID

- **No direct SQL or scripts were run** against NEW BUSINESS ID `c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee`.
- **Application code** was changed so that:
  - On **create/convert** with shipping: unchanged — already persisted product-only total and created a shipment row so the trigger set `shipment_charges` and `due_amount`.
  - On **edit** when the sale has or will have shipping: the form now sends **product-only total** and correct **due**; the context **syncs the form’s shipping charge to `sale_shipments`** (update first shipment or create one), so the trigger updates `shipment_charges` and `due_amount`. No double-count; AR and customer ledger stay in sync because they already use `total + shipment_charges`.

## 4. Files changed

| File | Change |
|------|--------|
| **`src/app/components/sales/SaleForm.tsx`** | When building payload: if the sale has shipping (existing shipments or shipping input > 0), send `total = afterDiscountTotal` (product + expenses, no shipping) and `due = (afterDiscountTotal + effectiveShippingCharges) - totalPaid` for both create/convert and **edit**. Ensures product-only total and correct due on edit. |
| **`src/app/context/SalesContext.tsx`** | After `replaceSaleCharges`: when `updates.shippingCharges` is defined, sync to `sale_shipments` — if the sale has shipment(s), update the first row’s `charged_to_customer`; if none and `shippingCharges > 0`, create a shipment with that amount. Trigger then updates `sales.shipment_charges` and `due_amount`. Added import for `shipmentService`. |
| **`docs/accounting/PF03_verify_shipping_sale_sync.sql`** | **New.** Verification query: sales with shipments show total, shipment_charges, due_amount, sum_charged, expected_due. |
| **`docs/accounting/PF03_SHIPPING_SALE_TOTAL_SYNC_RESULT.md`** | **New.** This result document. |

## 5. SQL/scripts run

- **None** for data repair or migrations.
- **Verification:** `node scripts/verify-issue02-shipping.js` was run (OLD BUSINESS). It connected successfully; OLD BUSINESS had no rows in the “sales with shipment” query (no sale_shipments), so no historical sale-with-shipping to check. No SQL was run against NEW BUSINESS in this run.

## 6. What data changed on NEW BUSINESS ID

- **Nothing.** No data was changed on NEW BUSINESS in this run. Data will stay correct when you create/edit sales with shipping after deploying this code.

## 7. Verification result before vs after on NEW BUSINESS ID

- **Before (code fix):** Editing a sale with shipping could leave `total = product + shipping` in the DB; if the user then changed shipping in the shipment modal, the trigger would set `due = (total + new_shipment_charges) - paid`, effectively double-counting shipping. If the user added shipping only in the form (no shipment row), `shipment_charges` stayed 0 and due did not include shipping.
- **After (code fix):** On edit with shipping, the form sends product-only total; the context syncs shipping to `sale_shipments` (update or create), so the trigger sets `shipment_charges` and `due_amount`. Customer-facing total = total + shipment_charges; AR and customer ledger (already using total + shipment_charges) remain correct.

Run `docs/accounting/PF03_verify_shipping_sale_sync.sql` with NEW BUSINESS ID after creating/editing a sale with shipping to confirm `total`, `shipment_charges`, and `due_amount` match the expected formula.

## 8. Verification result before vs after on OLD BUSINESS ID

- **No regression:** Same code path for OLD BUSINESS. No OLD BUSINESS data was modified.
- **Verification run:** `verify-issue02-shipping.js` ran against OLD BUSINESS; no sales with `sale_shipments` were found, so no historical sale-with-shipping to compare. Customer ledger RPC returned one sale with `shipment_charges = 0`; behavior is unchanged.

## 9. Fresh test result

- **Not run** in this session. Recommended:
  1. **NEW BUSINESS:** Create a sale with a shipping charge → finalize → check DB: `total` product-only, `shipment_charges` set, `due_amount` = (total + shipment_charges) − paid. Edit the sale (e.g. change an item or the shipping amount via form or “Update Shipment”) → save → confirm `total` remains product-only, `shipment_charges` and `due_amount` still correct.
  2. Run `docs/accounting/PF03_verify_shipping_sale_sync.sql` with NEW BUSINESS ID.

## 10. Remaining exception (if any)

- **None.** Logic uses the existing frozen accounting model (no new tables or posting engines). If shipment create/update fails (e.g. RLS), a warning is logged and the sale update still completes; user can fix shipment in the shipment modal.

## 11. Exact next step

1. **Deploy** the updated app (or run locally).
2. On **NEW BUSINESS:** Create a sale with shipping → finalize → optionally edit (items or shipping) → save. Run `docs/accounting/PF03_verify_shipping_sale_sync.sql` with NEW BUSINESS ID and confirm `total`, `shipment_charges`, and `due_amount` match the expected formula.
3. Optionally on **OLD BUSINESS:** Create one sale with shipping and repeat the same check to confirm no regression.
