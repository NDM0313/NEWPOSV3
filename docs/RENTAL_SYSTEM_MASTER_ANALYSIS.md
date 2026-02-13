# Rental System – Master Analysis & Implementation Plan

## A) Existing System Analysis

### 1. New Booking Storage
- **RentalBookingDrawer** → `rentalService.createBooking()` – uses `rentals` + `rental_items`, **availability check ✅**
- **NewRentalBooking** → `rentalService.createRental()` – different schema, **NO availability check ❌**
- **Fields stored:** pickup_date, return_date, rental_charges, total_amount, paid_amount, due_amount
- **Advance payment:** Inserted into `rental_payments` with reference "Advance at booking"

### 2. Pickup/Delivery
- **PickupModal** → `rentalService.markAsPickedUp()`
- **Backend:** Validates status=booked, remainingPaymentConfirmed, document received
- **Gap:** PickupModal UI does NOT block when remaining > 0 (was removed per earlier request; master prompt requires it back)

### 3. Return
- **ReturnModal** → `rentalService.receiveReturn()`
- **Backend:** No validation for penalty_paid when penalty > 0 ❌
- **Stock:** rental_in movement on return ✅

### 4. Security Document
- **Pickup only:** document_type, document_number, document_expiry, document_received, document_front_image, document_back_image, customer_photo
- **New Booking:** Security removed (per earlier task) ✅
- **Return:** document_returned confirmation ✅

### 5. Payments
- **Table:** `rental_payments` (rental_id, amount, method, reference, payment_date, created_by)
- **Gap:** No `type` column (advance/remaining/penalty)
- **Gap:** No ledger/journal postings for rental payments ❌

### 6. Inventory Availability
- **rentalAvailabilityService:** `checkRentalAvailability()` – overlap logic (A_start < B_end AND A_end > B_start)
- **Blocking statuses:** booked, picked_up, active, overdue
- **Used in:** createBooking, updateBooking ✅
- **Not used in:** createRental (NewRentalBooking path) ❌

### 7. Tables & Relations
| Table | Purpose |
|-------|---------|
| rentals | Header: status, dates, amounts, document fields |
| rental_items | Line items: product_id, quantity, rate, total |
| rental_payments | Payments: amount, method, reference |
| stock_movements | rental_out (pickup), rental_in (return) |
| activity_logs | Audit trail |

### 8. Identified Gaps
1. Pickup: Full payment enforcement removed from UI – restore
2. Return: Backend must validate penalty_paid when penalty > 0
3. rental_payments: Add `payment_type` (advance/remaining/penalty)
4. Accounting: Rental payments not posting to ledger
5. NewRentalBooking/createRental: No availability check
6. RentalBookingDrawer: Uses client-side checkDateConflict; createBooking has backend check

---

## B) Implementation Status

### Booking ✅
- Date blocking: rentalAvailabilityService (createBooking/updateBooking)
- Advance optional: Yes
- Conflict warning: "Already booked for selected dates"

### Pickup 🔧 Fix
- Restore: Full payment required (remaining_due = 0)
- Restore: Document required
- Add Payment button: Present ✅

### Return 🔧 Fix
- Backend: Validate penalty_paid when penalty_amount > 0

### Accounting ✅ Complete
- payment_type added to rental_payments (advance/remaining/penalty) ✅
- Ledger postings: ✅
  - Advance at booking: recordRentalBooking (RentalBookingDrawer, NewRentalBooking)
  - Remaining payment: recordRentalDelivery (UnifiedPaymentDialog)
  - Penalty at return: recordRentalReturn (RentalContext.receiveReturn)

### Security ✅
- Pickup only: document_type, document_number, document_received
- New Booking: No security fields

---

## Test Cases (Manual Verification)

| Test | Expected |
|------|----------|
| Overlapping booking | Create booking for Product A, dates X–Y. Try same product, overlapping dates → "Already booked" |
| Pickup blocked when due > 0 | Open Pickup modal with remaining > 0 → Confirm disabled, red alert, Add Payment button |
| Return blocked when penalty unpaid | Select Minor/Major damage, enter penalty, leave "Confirm penalty received" unchecked → Confirm disabled |
| Return with penalty | Select damage, enter penalty, check penalty received, confirm document returned → Confirm enabled, backend records penalty payment |
| Overdue detection | rentalService.markOverdueRentals() called on load; picked_up + return_date < today → overdue |
| Payment types | rental_payments: advance (booking), remaining (Add Payment), penalty (return) |
