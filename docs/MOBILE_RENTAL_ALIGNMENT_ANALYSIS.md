# Mobile Rental Alignment Analysis

## Purpose
Align the mobile app rental module with the **web rental logic** using the **manual flexible pricing model**. This document captures the web implementation before changing the mobile app.

---

## 1. Web Rental Entry Points

| Component | Purpose | Rent Model |
|-----------|---------|------------|
| **RentalBookingDrawer** | Main booking flow (drawer from Rentals dashboard) | **Manual** – user enters "Rent Amount"; no auto calc from days |
| **NewRentalBooking** | Standalone page | **Per-day** – base + extra days × perDayPrice (not the canonical model) |

**Canonical model for alignment:** RentalBookingDrawer (manual rent amount).

---

## 2. How Rent Amount Is Entered (Web – RentalBookingDrawer)

- **Manual field:** `manualRentPrice` (string state), user types the rent amount.
- **Product selection:** One product selected; product’s `rentPrice` (from `rental_price_daily`) can **pre-fill** the manual field but user can change it.
- **Validation:** `rentAmount = parseFloat(manualRentPrice) || 0`; must be `> 0` to book.
- **No automatic calculation** from pickup/return dates; dates are for reservation and availability only.
- **Items sent to API:** Single item: `{ productId, productName, quantity: 1, ratePerDay: selectedProduct.rentPrice ?? rentAmount, durationDays: totalDays || 1, total: rentAmount }`. The **total** is the manual rent; `ratePerDay`/`durationDays` are for schema only.

---

## 3. Advance / Booking Amount

- **Field:** `advancePaid` (string), parsed as number.
- **Balance:** Not stored separately; backend computes `due_amount = total_amount - paid_amount`.
- **createBooking params:** `rentalCharges: rentAmount`, `paidAmount: parseFloat(advancePaid) || 0`.
- **Backend:** `total_amount = rentalCharges + securityDeposit`, `due_amount = total_amount - paidAmount`. Advance stored in `rental_payments` with `payment_type: 'advance'`.

---

## 4. Security Deposit (Web)

- **RentalBookingDrawer:** `securityDeposit: 0` (hardcoded); no security deposit in current drawer flow.
- **createBooking/updateBooking:** Accepts `securityDeposit`; if used, `total_amount = rental_charges + security_deposit`.

---

## 5. Status Transitions

| Status | Meaning |
|--------|--------|
| draft | Created via rentalService.createRental (different flow); not used in booking drawer |
| **booked** | Booking created; not yet picked up |
| **picked_up** / rented | Marked as picked up; stock out done |
| **returned** | Return processed; stock in, document returned |
| overdue | Return date passed, not yet returned |
| cancelled | Booking cancelled |

**Flow:** booked → (mark as picked up) → picked_up/rented → (receive return) → returned.

---

## 6. Return Flow (Web – ReturnModal)

- **Payload:** `actualReturnDate`, `notes`, `conditionType` ('good' | 'minor_damage' | 'major_damage'), `damageNotes`, `penaltyAmount`, `penaltyPaid`, `documentReturned`.
- **Rules:**
  - If condition !== good: require `damageNotes`, `penaltyAmount > 0`, `penaltyPaid === true`.
  - `documentReturned` must be true to confirm.
- **Backend (rentalService.receiveReturn):**
  - Only for status in ['rented','overdue','picked_up','active'].
  - Inserts `stock_movements` with `movement_type: 'rental_in'` for each rental item.
  - Updates rental: `status: 'returned'`, `actual_return_date`, `condition_type`, `damage_notes`, `damage_charges` (penalty), `penalty_paid`, `document_returned`.
  - If penalty > 0 and penaltyPaid: inserts `rental_payments` with `payment_type: 'penalty'` and updates rental `paid_amount` / `due_amount`.

---

## 7. Rental Payments Logic (Web)

- **Booking advance:** Stored in `rental_payments` (payment_type: 'advance'); `rentals.paid_amount` / `due_amount` updated.
- **Additional payments:** Via addPayment; same table, payment_type typically 'remaining'.
- **Penalty on return:** Inserted as rental_payments (payment_type: 'penalty'); paid_amount/due_amount updated.
- **No automatic allocation** of payments to “rent” vs “penalty”; everything is summed in paid_amount.

---

## 8. Accounting (Web – AccountingContext)

- **Booking (advance only):** `recordRentalBooking`
  - Dr Cash/Bank (payment method)
  - Cr Rental Advance
  - (If security deposit cash) Dr Cash, Cr Security Deposit
- **Return (penalty):** `recordRentalReturn` (when damageCharge > 0)
  - Dr Cash (or payment method)
  - Cr Sales Revenue / Other Income (penalty income)

Mobile does not implement accounting context; it uses same backend (rentals, rental_payments, stock_movements). Accounting integration on web is optional (.catch). Mobile can remain backend-only unless accounting is added later.

---

## 9. Backend API Contract (createBooking)

- **Input:** companyId, branchId, createdBy, customerId, customerName, bookingDate, pickupDate, returnDate, **rentalCharges** (number), securityDeposit, paidAmount, notes, **items** (array of { productId, productName, quantity, ratePerDay, durationDays, **total** }).
- **Total amount:** `total_amount = rentalCharges + securityDeposit`; **due_amount = total_amount - paidAmount**.
- **Items:** Each item has **total**; backend does not recalc total from ratePerDay × durationDays. So **manual rent = rentalCharges** and can be sent as single item with **total = rentalCharges** (or split across items; mobile will send one item with total = manual rent).

---

## 10. What to Remove from Mobile

- Auto daily rent calculation (e.g. rentPricePerDay × durationDays × quantity).
- Using date difference to compute price.
- Fixed “per day” assumption; rent is one manual amount for the booking.

---

## 11. What to Implement on Mobile

1. **Product selection:** Select product(s); show name, SKU, image if available.
2. **Manual rent input:** Single required field “Enter Rent Amount”; editable; no auto calc from dates.
3. **Dates:** Keep booking date, pickup date, return date; for reservation/availability only.
4. **Advance:** Optional advance input; balance = Rent - Advance (display only); backend computes due_amount.
5. **Return flow:** Already present; ensure condition, penalty, document returned match web (ReturnModal contract).
6. **Create payload:** rentalCharges = manual rent; items = one (or more) row(s) with total = manual rent share (e.g. one item with total = rentAmount).

---

## 12. Mobile UI Structure (Target)

1. Customer  
2. Dates (Booking, Pickup, Return)  
3. Selected Item(s) (product name, SKU, image)  
4. Manual Rent Amount (required)  
5. Advance  
6. Balance (Rent - Advance)  
7. Book button  

No “Total from days” or “Per day” display as the source of truth; rent is the single manual value.

---

---

## 13. Implementation Summary (Done)

### Mobile CreateRentalFlow
- **Manual rent:** Single field "Enter Rent Amount (Rs.)" – required, editable. No auto calculation from dates.
- **Dates:** Pickup and return kept for reservation only; duration shown as "(for reservation only)" on confirm.
- **Product selection:** Name + SKU shown; no per-day price display. Multiple items supported; rent amount split across items when saving.
- **Advance & balance:** Advance input on confirm step; Balance due = Rent - Advance (display and backend).
- **Payload:** `rentalCharges = manualRentAmount`, `items[].ratePerDay = 0`, `items[].total` = split of rent (equal split for multiple items).

### Mobile Return (RentalReturnModal)
- **Condition options:** good | minor_damage | major_damage (aligned with web).
- **Validation:** Document returned required; when condition !== good: damage notes required, penalty amount required, penalty paid required.
- **API:** receiveReturn penalty payment_type set to `penalty` (was `remaining`) to match web.

### Removed from mobile
- Auto daily rent calculation (rentPricePerDay × durationDays × quantity).
- Any display of "per day" or "Duration: X days" as source of total.
- Fixed rental price assumption from product.

### Files changed
- `erp-mobile-app/src/components/rental/CreateRentalFlow.tsx` – manual rent, no auto price, advance/balance.
- `erp-mobile-app/src/components/rental/RentalReturnModal.tsx` – condition options, validation.
- `erp-mobile-app/src/api/rentals.ts` – penalty payment_type.

---

*Document generated for mobile rental alignment. Implementation in erp-mobile-app follows this spec.*
