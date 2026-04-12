# 12 — Rental Core Engine

**Last updated:** 2026-04-12
**Stack:** Next.js + Supabase (multi-tenant)
**Primary service:** `src/app/services/rentalService.ts`
**Context provider:** `src/app/context/RentalContext.tsx`
**Availability guard:** `src/app/services/rentalAvailabilityService.ts`

---

## Business Purpose

Bridal dress and accessory rental management. Customers book dresses/accessories for events (e.g., weddings). Items are tracked from booking through pickup to return, with security deposits, damage penalties, and multiple payment types recorded per rental. The system operates as an inventory-consuming workflow — items are moved out of stock on pickup and returned to stock on return.

---

## UI Entry Points

| View / Route | Purpose |
|---|---|
| `rentals` | Main rental list/dashboard — shows all rentals by status |
| `rental-booking` | Booking creation view — opens the booking drawer |

| Component | Role |
|---|---|
| `RentalDashboard` | Summary cards; status tabs; list of rentals |
| `RentalBookingDrawer` | Create/edit a booking (calls `rentalService.createBooking` / `updateBooking`) |
| `RentalCalendar` | Calendar view; availability visualisation per product |
| `RentalOrdersList` | Tabular list of rentals; status filter; action buttons |
| `ReturnModal` | Trigger `receiveReturn` flow; captures condition, penalty, document returned |
| `PickupModal` | Trigger `markAsPickedUp` flow; captures document details, photos |
| `ReturnDressModal` | Alias/variant of the return modal for the dress-specific return path |

---

## Frontend Files

```
src/app/context/RentalContext.tsx          — React context; wraps rentalService; exports useRentals()
src/app/services/rentalService.ts          — All DB mutations and reads
src/app/services/rentalAvailabilityService.ts — Double-booking guard
src/app/services/journalTransactionDateSyncService.ts — JE date sync on edit
```

The context `RentalContext.tsx` exposes:
- `rentals: RentalUI[]` — full list for the company
- `createRental()` — creates a draft rental (new schema: `start_date`/`expected_return_date`)
- `finalizeRental()` — moves draft/booked → rented, posts stock movement `rental_out`
- `markAsPickedUp()` — specifically for the booking flow (`booked` → `picked_up`)
- `receiveReturn()` — posts `rental_in` stock, captures condition, computes refund
- `addPayment()` / `deletePayment()` — `rental_payments` table mutations
- `cancelRental()` — only allows cancellation of `draft` status

The `mapStatus()` function in the context normalises DB status variants to the UI enum:
- `picked_up` / `active` → `rented`
- `closed` → `returned`

---

## Backend Services

### `rentalService.ts` — Key Functions

| Function | Signature summary | Purpose |
|---|---|---|
| `createRental` | `(companyId, createdBy, rental, items)` | Inserts into `rentals` + `rental_items`; status = `draft`; validates return ≥ start date |
| `createBooking` | `(params)` | Booking-schema variant; inserts with `booking_no`, `pickup_date`, `return_date`, `security_deposit`; calls availability check; status = `booked` |
| `updateBooking` | `(id, companyId, updates)` | Edits `draft` or `booked` rentals only; re-runs availability check; replaces items if provided |
| `updateRental` | `(id, companyId, updates, items)` | Edits `draft` only; updates `rental_items` if provided |
| `finalizeRental` | `(id, companyId, performedBy)` | `draft`/`booked` → `picked_up`; posts `rental_out` stock movement per item |
| `markAsPickedUp` | `(id, companyId, params, performedBy)` | `booked` → `picked_up`; records document type/number/images/photos; posts `rental_out` stock; validates full payment or credit flag |
| `markOverdueRentals` | `(companyId)` | Scans `picked_up` rentals where `return_date < today`; sets status `overdue` |
| `receiveReturn` | `(id, companyId, params, performedBy)` | `rented`/`overdue`/`picked_up`/`active` → `returned`; posts `rental_in` stock per item; records condition, penalty, refund amount; inserts `rental_payments` row for penalty |
| `cancelRental` | `(id, companyId, performedBy)` | `draft` only → `cancelled` |
| `addPayment` | `(rentalId, companyId, amount, method, reference, performedBy, options)` | Inserts `rental_payments`; updates `rentals.paid_amount` / `due_amount` |
| `linkJournalEntryToRentalPayment` | `(rentalPaymentId, journalEntryId)` | Writes `journal_entry_id` back to `rental_payments` row after posting |
| `voidRentalPaymentByReversedJournal` | `(companyId, originalJournalEntryId)` | Sets `voided_at` on `rental_payments`; recomputes paid/due via `recomputeRentalPaidDueFromActivePayments` |
| `recomputeRentalPaidDueFromActivePayments` | internal | Sums non-voided `rental_payments.amount`; writes `paid_amount` / `due_amount` to `rentals` |

---

## DB Tables

| Table | Key Columns | Notes |
|---|---|---|
| `rentals` | `id`, `company_id`, `branch_id`, `booking_no` / `rental_no`, `customer_id`, `customer_name`, `status`, `pickup_date` / `start_date`, `return_date` / `expected_return_date`, `actual_return_date`, `actual_pickup_date`, `rental_charges`, `security_deposit`, `total_amount`, `paid_amount`, `due_amount`, `duration_days`, `document_type`, `document_number`, `document_expiry`, `document_received`, `document_returned`, `condition_type`, `damage_notes`, `damage_charges`, `penalty_paid`, `refund_amount`, `credit_flag` | **Dual schema:** old rows use `booking_no`, `pickup_date`, `return_date`; new rows use `rental_no`, `start_date`, `expected_return_date`. Both are supported in `convertFromSupabaseRental()` |
| `rental_items` | `id`, `rental_id`, `product_id`, `product_name`, `quantity`, `unit`, `rate` / `rate_per_day`, `duration_days`, `total`, `boxes`, `pieces`, `packing_details` | Line items per rental |
| `rental_payments` | `id`, `rental_id`, `amount`, `method`, `reference`, `payment_date`, `payment_type`, `created_by`, `journal_entry_id`, `voided_at`, `payment_account_id` | All payments against a rental; `voided_at` soft-deletes; `journal_entry_id` links to accounting |
| `stock_movements` | Standard ERP table | Used for `rental_out` (negative qty on pickup) and `rental_in` (positive qty on return) |

---

## Booking Create Flow

1. User opens `RentalBookingDrawer`.
2. UI calls `rentalService.createBooking(params)`.
3. Service validates: items required, customer UUID required, return ≥ pickup date.
4. `checkRentalAvailabilityForItems()` runs per-item date overlap check (see Availability Checking section).
5. `settingsService.getNextDocumentNumber(companyId, branchId, 'rental')` generates `booking_no`.
6. Insert into `rentals` with `status = 'booked'`, `paid_amount = 0` (advance never applied at create).
7. Insert `rental_items` rows; if that fails, the rental row is deleted (manual rollback).
8. Activity log entry written.
9. Returns `{ id, booking_no }`.

**Note:** `createRental()` is a separate entry point (new-schema path) that creates with `status = 'draft'` and uses `start_date` / `expected_return_date` columns.

---

## Confirmation / Pickup Flow

Two paths exist depending on which status the rental is in:

### Path A — `finalizeRental` (draft/booked → rented)
- Allows `draft` or `booked` status.
- Posts `rental_out` stock movement per item (`quantity` stored as negative, `movement_type = 'rental_out'`, `unit_cost = 0`).
- Sets `status = 'picked_up'` (DB enum value).

### Path B — `markAsPickedUp` (booked → picked_up)
- Strict: only accepts `status = 'booked'`.
- Validates full payment unless `deliverOnCredit = true`.
- Validates `actualPickupDate >= pickup_date`.
- Posts `rental_out` stock movement (same format as Path A).
- Stores document details: `document_type`, `document_number`, `document_expiry`, `document_received`.
- Optionally stores base64 images: `document_front_image`, `document_back_image`, `customer_photo`.
- Sets `status = 'picked_up'`.

In the UI status model, `picked_up` maps to `rented`.

---

## Return Flow

Function: `receiveReturn(id, companyId, params, performedBy)`

1. Fetch rental; validate status is in `['rented', 'overdue', 'picked_up', 'active']`.
2. Validate: if `penaltyAmount > 0`, then `penaltyPaid` must be true and `documentReturned` must be true.
3. `documentReturned` must always be true to proceed.
4. Post `rental_in` stock movement per item (positive quantity, `movement_type = 'rental_in'`, `unit_cost = 0`).
5. Compute `refund_amount = max(0, security_deposit - penaltyAmount)`.
6. Update `rentals` row: `status = 'returned'`, `actual_return_date`, `condition_type`, `damage_notes`, `damage_charges`, `penalty_paid`, `document_returned`, `refund_amount`.
7. If `penaltyAmount > 0 && penaltyPaid`, insert a `rental_payments` row with `payment_type = 'penalty'`.
8. Activity log entry written.

Refund disbursement (returning the security deposit cash to the customer) is recorded separately and is not automated by this function.

---

## Overdue / Late Return Handling

Function: `markOverdueRentals(companyId)`

- Queries all `status = 'picked_up'` rentals where `return_date < today`.
- Bulk-updates each to `status = 'overdue'`.
- Returns count of rows updated.
- This is a poll-based function; it is not triggered by a DB cron. It must be called from the UI on page load or a scheduled refresh.

The UI `mapStatus()` function passes `overdue` through unchanged, so overdue rentals display distinctly.

---

## Payment Flow

All payments write to the `rental_payments` table via `rentalService.addPayment()`.

**Payment types** (`payment_type` column):
- `advance` — deposit / advance payment collected at booking
- `remaining` — balance payment collected at pickup or after
- `penalty` — damage/late charge recorded at return

**Payment methods** normalised to DB enum: `cash`, `bank`, `card`, `other` (cheque, mobile wallet, wallet all map to `other`).

**Lifecycle:**
1. `addPayment()` inserts `rental_payments` row.
2. Updates `rentals.paid_amount` (cumulative) and `due_amount = max(0, total_amount - paid_amount)`.
3. If `payment_account_id` is provided, stored on the row for accounting linkage.
4. The calling context (RentalContext or accounting middleware) is responsible for creating the journal entry separately and then calling `linkJournalEntryToRentalPayment()` to write `journal_entry_id` back.

**Void / reversal:**
- `voidRentalPaymentByReversedJournal()` finds the `rental_payments` row by `journal_entry_id`, sets `voided_at`, then calls `recomputeRentalPaidDueFromActivePayments()` to resum only non-voided rows.

**`due_amount` column resilience:** The code has explicit fallbacks for DBs where `due_amount` column is missing (`PGRST204` error) — it writes only `paid_amount` and continues.

---

## Stock Effect

Rentals **do** directly affect inventory stock via `stock_movements`:

| Event | `movement_type` | Quantity sign | `unit_cost` |
|---|---|---|---|
| Pickup / Finalize | `rental_out` | negative (items go out) | 0 |
| Return | `rental_in` | positive (items come back) | 0 |

`unit_cost = 0` on both movements means rental stock movements do not affect COGS or inventory valuation — they affect only the stock quantity. If the same product is tracked for sale, a `rental_out` will reduce available-to-sell quantity, and `rental_in` will restore it.

The availability check (`rentalAvailabilityService`) is a separate logical layer from stock movements. Availability is checked at booking creation/update time by querying the `rentals` table directly, not by reading `stock_movements`.

---

## Accounting Effect

The `rentalService.ts` file does **not** create journal entries directly. Journal entry creation is the responsibility of the context or a separate accounting middleware layer that calls `rentalService.linkJournalEntryToRentalPayment()` after posting.

The `rental_payments` table has a `journal_entry_id` FK column for this linkage. The accounting entries expected (based on service code and ERP conventions) are:

**On payment receipt:**
```
Dr  Cash / Bank / Card (payment account)      [amount]
    Cr  Rental Revenue or AR                  [amount]
```

**On security deposit receipt:**
```
Dr  Cash / Bank                               [deposit amount]
    Cr  Security Deposit Liability            [deposit amount]
```

**On return with damage penalty:**
```
Dr  Cash                                      [penalty amount]
    Cr  Damage Income / Rental Revenue        [penalty amount]
```

**On security deposit refund:**
```
Dr  Security Deposit Liability               [refund amount]
    Cr  Cash                                 [refund amount]
```

The exact account codes are resolved by the accounting middleware at post time, not hardcoded in `rentalService.ts`. Journal date sync is performed via `syncJournalEntryDateByDocumentRefs` (imported but the call site is in the context layer).

---

## Availability Checking

Service: `rentalAvailabilityService.ts`

**Blocking statuses:** `['booked', 'picked_up', 'active', 'overdue']`
- A product is considered "out" for any rental in one of these statuses.
- `draft` and `returned`/`cancelled` rentals do **not** block availability.

**Overlap logic:**
```
conflict = (existing.pickup_date < requested.endDate) AND (existing.return_date > requested.startDate)
```
This is the standard interval-overlap formula (exclusive endpoints).

**Two-step query:**
1. Find all rentals in blocking status where dates overlap.
2. Join to `rental_items` to check if the specific `product_id` appears in those rentals.

**Multi-item check:** `checkRentalAvailabilityForItems()` iterates each item serially; returns the first conflict found.

**Edit exclusion:** `excludeRentalId` param prevents a rental from blocking its own update.

**Branch scope:** Availability is scoped to `branch_id` if provided. Cross-branch availability is not checked.

---

## Source of Truth

| Question | Answer |
|---|---|
| Rental status | `rentals.status` column |
| Amount owed | `rentals.due_amount` (derived: `total_amount - paid_amount`, recomputed after each payment) |
| Amount paid | `rentals.paid_amount` (sum of non-voided `rental_payments.amount`) |
| Items rented | `rental_items` rows |
| Payment history | `rental_payments` rows (filter `voided_at IS NULL` for active) |
| Stock impact | `stock_movements` rows with `reference_type = 'rental'` |
| Accounting link | `rental_payments.journal_entry_id` → `journal_entries` |

---

## Known Failure Points

1. **Dual schema (`booking_no` vs `rental_no`, `pickup_date` vs `start_date`):** The context has a `convertFromSupabaseRental()` mapping function to bridge the two. New code may write to one schema while old UI reads the other. A migration to a single canonical column set has not been completed.

2. **`due_amount` column may not exist:** `addPayment()` has a catch for `PGRST204`; if the column is missing it silently omits the update. This means `due_amount` can go stale on older DB instances.

3. **Overdue check is not automatic:** `markOverdueRentals()` must be called explicitly. If no page load triggers it, rentals will remain `picked_up` past their due date without becoming `overdue`, breaking dashboard counts and late-fee logic.

4. **Stock cost is zero:** Both `rental_out` and `rental_in` use `unit_cost = 0`. This means inventory valuation reports will show zero cost for rented items even when the dress has a cost price. Inventory reports will show quantity correctly but not value.

5. **Penalty payment method hardcoded to `cash`:** In `receiveReturn()`, the penalty `rental_payments` row is inserted with `method: 'cash'` regardless of actual payment method. No payment account is captured for penalties at return time.

6. **No journal entry created in service:** The service only links a JE (`linkJournalEntryToRentalPayment`). If the calling context fails to create and link the JE, the payment is financially unposted. There is no guard or flag indicating a payment is "unposted".

7. **`cancelRental` only allows `draft`:** If a booking needs to be cancelled after confirmation (status `booked`), the service will throw. The UI must handle this case separately or the status guard must be relaxed.

8. **Cross-branch availability not enforced:** If the same rentable product exists in multiple branches, availability is checked only within the branch. A product could be double-booked across branches.

---

## Recommended Standard

1. **Consolidate to a single schema.** Migrate all `booking_no`/`pickup_date`/`return_date` rows to `rental_no`/`start_date`/`expected_return_date`. Remove the compatibility shim in `convertFromSupabaseRental()` once migration is complete.

2. **Add a `due_amount` DB column with NOT NULL default.** Eliminate the `PGRST204` fallback path.

3. **Automate overdue marking.** Add a Supabase cron function or a server-side edge function that calls `markOverdueRentals()` nightly for each active company.

4. **Create JE in service, not context.** Move journal entry creation into `rentalService.addPayment()` so every payment is guaranteed to post to accounting. Use the same pattern as `workerPaymentService.createWorkerPayment()`.

5. **Capture penalty payment method at return.** Add `penaltyMethod` and `penaltyAccountId` params to `receiveReturn()`.

6. **Guard for `booked` cancellation.** Add `cancelBooking()` (accepts `booked` status) separate from `cancelRental()` (accepts `draft` only), or expand the guard.

7. **Assign unit cost to stock movements.** Read `product.cost_price` at pickup time and write it as `unit_cost` on the `rental_out` movement, so inventory valuation remains accurate.
