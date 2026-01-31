# Rental Module – Full ERP Analysis & Implementation

## STEP 1 – FRONTEND ANALYSIS (DEEP)

### 1. Rental Listing Page
- **Columns:** Rental No, Customer, Product/Item, Branch, Rental Start Date, Expected Return Date, Actual Return Date, Status (Draft/Rented/Returned/Overdue/Cancelled), Total Amount, Paid, Due, Actions
- **Filters:** Date range, Customer, Product, Status, Branch
- **Actions:** View, Edit (when draft), Receive Return (when rented/overdue), Add Payment, Print, Delete (draft only; admin-only for hard delete if required)

### 2. Add/Edit Rental Page
- **Mandatory:** Branch, Customer, Rental Start Date, Expected Return Date
- **Items:** Product, Qty, Unit, Packing (if enablePacking), Rental rate (per day/unit)
- **Auto:** Total rental amount, Advance paid, Remaining due
- **Validation:** Branch required, at least one item, expected_return_date >= start_date

### 3. Rental View (Sale/Purchase style)
- **Tabs:** Details, Payments, History
- **Details:** Customer, dates, items (with packing if enabled), payment summary
- **Payments:** Payment history, Add payment (when status rented/overdue)
- **History:** Activity timeline (created, finalized, payment added, returned, etc.)

---

## STEP 2 – RENTAL STATUS FLOW

| Status    | Stock        | Payment     | Notes                    |
|-----------|--------------|-------------|---------------------------|
| Draft     | No movement  | Optional    | Editable, deletable       |
| Rented    | OUT (rental_out) | Allowed | Finalized from draft      |
| Returned  | IN (rental_in)   | Settlement | actual_return_date set    |
| Overdue   | OUT          | Allowed     | expected_return_date passed |
| Cancelled | No movement  | No          | Only from draft          |

---

## STEP 3 – INVENTORY INTEGRATION

- **Finalize (draft → rented):** `stock_movements` INSERT with `movement_type = 'rental_out'`, `quantity` negative, `reference_type = 'rental'`, `reference_id = rental.id`. Optional: `box_change`, `piece_change` when packing enabled.
- **Return (rented/overdue → returned):** `stock_movements` INSERT with `movement_type = 'rental_in'`, `quantity` positive. Balance updated only via movements (trigger/sync).

---

## STEP 4 – BACKEND SERVICES (rentalService)

- `createRental(companyId, createdBy, rental, items)` – draft only; no stock
- `updateRental(id, companyId, updates, items)` – only when status = draft
- `finalizeRental(id, companyId, performedBy)` – draft → rented; stock OUT
- `receiveReturn(id, companyId, actualReturnDate, performedBy)` – rented/overdue → returned; stock IN
- `cancelRental(id, companyId, performedBy)` – only draft
- `addPayment(rentalId, companyId, amount, method, reference?, performedBy?)` – rental_payments + update rentals.paid_amount/due_amount
- `deletePayment(paymentId, rentalId, companyId, performedBy?)` – delete payment, recalc paid/due
- `deleteRental(id, companyId, performedBy?)` – only draft; hard delete
- Activity logging on all actions (module = 'rental').

---

## STEP 5 – DATABASE (migrations/rental_module_schema.sql)

- **rentals:** id, company_id, branch_id, rental_no (AUTO via trigger), customer_id, customer_name, start_date, expected_return_date, actual_return_date, status, total_amount, paid_amount, due_amount, notes, created_by, created_at, updated_at
- **rental_items:** id, rental_id, product_id, product_name, sku, quantity, unit, boxes, pieces, packing_details, rate, total, notes
- **rental_payments:** id, rental_id, amount, method, reference, payment_date, created_by, created_at
- **stock_movements:** movement_type = 'rental_out' | 'rental_in' (no schema change)

---

## STEP 6 – ACTIVITY LOGGING

- activityLogService: module type extended with `'rental'`.
- Log actions: rental_created, rental_edited, rental_finalized, payment_added, payment_deleted, rental_returned, rental_cancelled, rental_deleted.
- Admin: Activity Logs page (filters: user, date, action, module). Normal user: only own rental history in View Rental → History tab.

---

## STEP 7 – PRINT / PDF

- Classic design aligned with Sale/Purchase: company header, rental no, dates, items (with packing if enabled), payment summary. Same fonts/spacing.

---

## Implementation Status

| Step | Status | Notes |
|------|--------|--------|
| 1 Frontend analysis | Doc done | RentalsPage, RentalForm, ViewRentalDetailsDrawer to implement |
| 2 Status flow | Done | Enforced in rentalService |
| 3 Inventory | Done | rental_out / rental_in in rentalService |
| 4 Backend services | Done | rentalService.ts full rewrite |
| 5 Database | Done | migrations/rental_module_schema.sql |
| 6 Activity log | Done | activityLogService + rental module; log in service |
| 7 Print | Pending | Classic print view component |

---

## Run migration

```bash
# In Supabase SQL Editor or CLI
psql -f migrations/rental_module_schema.sql
```

Ensure `companies`, `branches`, `contacts`, `products`, `users` exist (from 02_clean_erp_schema or 03_frontend_driven_schema). If `rentals`/`rental_items`/`rental_payments` already exist with different columns, alter or recreate as per this schema.
