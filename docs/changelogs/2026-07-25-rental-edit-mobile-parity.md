# 2026-07-25 — Rental date conflict, mobile full edit, build fix

## A. Same-day handoff + conflict banner (web + mobile)

- **Root cause:** loading existing bookings with `new Date('YYYY-MM-DD')` shifted dates to UTC midnight (05:00 PKT), causing false half-open overlap on handoff day; server used `.gte('return_date', startDate)` so same-day return+pickup blocked save.
- **Decision:** same-day handoff **allowed** (`[pickup, return)` half-open on UI and server).
- Web drawer `loadExistingBookings`: `parseLocalDateInput` for pickup/return/booking dates.
- `rentalAvailabilityService` + mobile `rentals.checkRentalAvailability`: `.gte(return_date)` → `.gt(return_date)`.
- Conflict banner message includes booking no + customer; edit self-exclusion uses string id compare.
- Drawer Booking # shows `editRental.rentalNo` (was wrong `bookingNo` → always "Auto").

## B. Mobile rental full edit (web parity)

- New `updateBooking` in `erp-mobile-app/src/api/rentals.ts` (draft/booked only): customer, dates, items (keeps `variation_id`), rates, salesman, bill ref, notes; **never writes `paid_amount`**; due from existing paid.
- `getRentalById` / `RentalDetail`: `bookingDate` + item `variation_id` / `durationDays` for hydrate.
- `CreateRentalFlow` `editRentalId` mode: prefills form, skips advance/payment steps, saves via `updateBooking`, button **Update Booking**, disables create draft autosave.
- Entry: list menu **Edit Booking** + detail **Edit Booking**; quick **Edit Bill Ref** kept.

## C. Mobile build TS2345 (cash flow multi-account)

- `PaymentAccountFilter = string | string[] | null` + helpers on mobile `roznamcha.ts`.
- Query filters use `.eq` / `.in`; in-memory checks use `matchesPaymentAccountFilter`.
- Fixes `unifiedReports` passing expanded parent account id arrays into `getRoznamcha`.
