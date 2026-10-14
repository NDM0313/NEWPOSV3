# 2026-09-24 — Complete Delete, sale stock `unit_price`, rental Created filter

## A. Complete Delete (hard delete) on Transaction Detail

- Accounting Transaction Detail **Basic Information** actions gain **Complete Delete** for eligible manual / misc / correction_reversal / voided (non-payment) journals.
- Confirm dialog requires typing exact phrase `HARD DELETE` before the action enables.
- Service permanently deletes `journal_entry_lines` then `journal_entries` (company-scoped). Fail-closed when non-line FKs still reference the JE.
- **Blocked:** payment-linked JEs and source-document roots (sale / purchase / rental / studio). Use Cancel Payment / open source document instead.
- **Cancel Entry** unchanged (still posts `correction_reversal` / reverse path).

> **Update 2026-09-26:** Complete Delete now also applies to Receive/Pay (`payment_id` cascades). See [`2026-09-26-complete-delete-receive-payment.md`](2026-09-26-complete-delete-receive-payment.md). Document-root bills remain blocked.

### Files

- `src/app/lib/manualJournalHardDeletePolicy.ts` (+ tests)
- `src/app/services/journalHardDeleteService.ts`
- `src/app/lib/transactionActionRules.ts`
- `src/app/components/accounting/TransactionActionPanel.tsx`
- `src/app/components/accounting/TransactionConfirmDialog.tsx`
- `src/app/components/accounting/TransactionDetailModal.tsx`

### Policy note

Prefer **Cancel Entry** when an audit trail is required. Complete Delete is intentional permanent removal for cleanup of orphan / mistaken manual journals only.

---

## B. Mobile Post: `column "price" does not exist`

- **Root cause:** `ensure_sale_stock_movements` legacy `sale_items` branch still selected `price AS unit_price`; schema is `unit_price`. Also fell through to legacy path when `sales_items` existed but all lines were filtered (non-tracked / CUSTOM / bespoke).
- **Fix:** migration `migrations/20260924144500_ensure_sale_stock_unit_price_legacy_fix.sql` — use `unit_price`; early return after `sales_items` path; same rename on `handle_sale_final_stock_movement` legacy branch.
- **Client:** no APK rebuild required (DB RPC fix). Re-try mobile Payment Post after migration apply.

---

## C. Admin rentals list — salesman rows missing on “Today”

- **Root cause:** list date filter mode **Created** used `booking_date` (mislabeled), so same-day salesman bookings with older/null booking date did not appear under Today.
- **Fix:** `createdAt` maps to DB `created_at`; separate `bookingDate`. Filters: **Created / Booking / Pickup**.

### Files

- `src/app/lib/rentalUiMapper.ts`
- `src/app/types/rentalTypes.ts`
- `src/app/components/rentals/RentalsPage.tsx`
- `src/app/components/rentals/RentalBookingDrawer.tsx`
