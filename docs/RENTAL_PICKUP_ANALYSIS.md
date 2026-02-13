# Rental Pickup Flow — Analysis Report

## PHASE 1 — FRONTEND ANALYSIS

### 1. Rental statuses supported
- **UI (RentalStatus):** draft, booked, rented, returned, overdue, cancelled
- **RentalContext mapStatus:** booked→booked, picked_up→rented, active→rented, returned→returned, overdue→overdue, closed→returned, cancelled→cancelled

### 2. picked_up in DB enum
**YES** — DB enum `rental_status` includes: booked, picked_up, active, returned, overdue, closed, cancelled

### 3. actual_pickup_date column
**MISSING** — rentals table has: pickup_date, return_date, actual_return_date. No actual_pickup_date.

### 4. RentalsPage action menu (status-based)
- **draft/booked:** View, Edit, View Payments, Add Payment, Print, Delete
- **rented/overdue:** View, Receive Return, Add Payment, View Payments, Print
- **No "Mark as Picked Up"** for booked status

### 5. rentalService.updateBooking
**Does NOT support status change** — only: customerId, customerName, pickupDate, returnDate, rentalCharges, securityDeposit, paidAmount, notes, items

**Note:** `finalizeRental()` exists — sets status to picked_up, does stock movement. Does NOT set actual_pickup_date (column missing).

## PHASE 2 — BACKEND VALIDATION

- DB enum: ✓ booked, picked_up, active, overdue, returned present
- actual_pickup_date: **MIGRATION REQUIRED**
- RLS: rentals has relrowsecurity=false — no policies, updates allowed

## Implementation Plan

1. Migration: ADD actual_pickup_date TIMESTAMPTZ
2. rentalService.markAsPickedUp(id, companyId, actualPickupDate, performedBy) — status=picked_up, actual_pickup_date, stock movement
3. PickupModal component
4. "Mark as Picked Up" in RentalsPage + ViewRentalDetailsDrawer for status=booked
5. Auto-overdue: mark picked_up → overdue when today > expected_return_date
6. Dashboard counters: Today Pickups (booked + pickup_date=today), Active (picked_up), Overdue (picked_up + past return)
7. Calendar: overflow-y-auto max-h-[70vh], horizontal scroll

## IMPLEMENTATION COMPLETE (summary)

- **Migration:** actual_pickup_date added to rentals
- **markAsPickedUp:** New service method with date validation, stock movement, activity log
- **markOverdueRentals:** Called on loadRentals; auto-marks picked_up past return_date → overdue
- **PickupModal:** Date picker, validates date >= pickup_date
- **Mark as Picked Up:** Action in RentalsPage and ViewRentalDetailsDrawer when status=booked
- **Dashboard:** Today Pickups (booked + pickup_date=today), Active Rentals (rented/picked_up), Overdue
- **Calendar:** max-h-[70vh], overflow-y-auto, overflow-x-auto on ScrollArea
