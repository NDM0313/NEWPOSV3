# Mobile Rental Final Flow — UX, Backend Integrity & Return Workflow

## Overview

This document describes the **final professional fixes** applied to the mobile rental module: layout (no horizontal overflow), global numeric keyboard, backend-linked account selection, pickup/security document flow, return workflow with damage rules, and database integrity.

---

## PART 1 — Mobile Layout (Width Overflow)

### Problem
Date inputs and some fields could overflow container width on small screens; wide tables caused horizontal scroll on the viewport.

### Fix Applied
- **Global (index.css):**
  - `html`, `body`, `#root`: `overflow-x: hidden`, `max-width: 100%` / `100vw`.
  - All `input`, `select`, `textarea`: `width: 100%`, `max-width: 100%`, `min-width: 0`, `box-sizing: border-box`.
  - Utilities: `.mobile-no-overflow`, `.mobile-form-container`, `.mobile-table-scroll` for contained scroll.
- **Tables (AccountLedgerReport, DayBookReport):**
  - Wrapped table in `mobile-table-scroll` with `w-full max-w-full overflow-x-auto` so only the table area scrolls horizontally; viewport never scrolls horizontally.
- **DateTimePicker:** `w-full max-w-full sm:max-w-[360px]` so it respects parent width on mobile.
- **Rental / forms:** Inputs use `w-full max-w-full min-w-0 box-border` where needed.

### Rule
- No fixed pixel width on form inputs.
- No horizontal scroll on the mobile viewport; wide content scrolls inside a dedicated container.

---

## PART 2 — Global Numeric Keyboard

### Problem
Numeric fields could open the full keyboard instead of the numeric/decimal keypad.

### Fix Applied
For **all numeric inputs** across the app:
- `type="number"`
- `inputMode="decimal"` (amounts, prices, quantities with decimals) or `inputMode="numeric"` (integer quantities).
- `pattern="[0-9.]*"` (decimal) or `pattern="[0-9]*"` (integer).

### Files Updated
- **Rental:** CreateRentalFlow (rent, advance), RentalReturnModal (penalty), RentalAddPaymentModal — already had or added.
- **Sales:** AddProducts (quantity, price), PaymentDialog, SaleSummary (discount, shipping).
- **Purchase:** CreatePurchaseFlow (paid amount, discount, quantity, unit price).
- **Contacts:** AddContactFlow, EditContactFlow (worker rate, balance, credit limit).
- **Products:** AddProductFlow (cost, retail, wholesale, stock, min stock).
- **Accounts:** ExpenseEntryFlow, AccountTransferFlow, SupplierPaymentFlow, GeneralEntryFlow, WorkerPaymentFlow, AddAccountForm.
- **Studio:** StudioStageAssignment (internal cost, customer charge), StudioUpdateStatusView (expected/final cost).

### Rule
- Every financial or quantity input uses `inputMode` + `pattern` so mobile shows the appropriate keypad.

---

## PART 3 — Account Selection Backend Linked

### Requirement
Account dropdown must use real data from the database (no hardcoded list), filtered by company, show only active Cash/Bank/relevant accounts, and fail if the selected account does not exist.

### Implementation
- **API:** `erp-mobile-app/src/api/accounts.ts`
  - `getAccounts(companyId)` — fetches from `accounts` table, `company_id`, `is_active = true`.
  - `getPaymentAccounts(companyId)` — same, filtered `type IN ('cash','bank','asset','mobile_wallet')` for rental/sales/purchase payment selection.
- **Rental booking (CreateRentalFlow):**
  - Step “Payment Confirmation”: “Receive Advance Into” dropdown is filled from `getPaymentAccounts(companyId)`.
  - Selected `advancePaymentAccountId` is sent to `createBooking`; backend validates account exists and is active for the company; otherwise returns error “Invalid or inactive payment account.”
- **Rental return (RentalReturnModal):**
  - “Penalty received into” dropdown is filled from `getPaymentAccounts(companyId)`.
  - `penaltyPaymentAccountId` is sent to `receiveReturn`; backend validates account; otherwise returns “Invalid or inactive penalty payment account.”
- **Backend (rentals.ts):**
  - `createBooking`: when `advancePaymentAccountId` is provided, looks up account in `accounts` by id + company_id + is_active; derives `method` from account type.
  - `receiveReturn`: when `penaltyPaymentAccountId` is provided, same validation before inserting penalty payment.

### Rule
- No hardcoded account list; all payment account options come from `getPaymentAccounts(companyId)`; every payment/advance/penalty that uses an account is validated in the API.

---

## PART 4 — Rental Pickup + Security Document + Return Flow

### Booking (Created)
- Status: `booked`.
- If advance received: **Dr Cash/Bank** (selected account), **Cr Rental Advance**; stored in `rental_payments` with `payment_type: 'advance'` and `method` from account.

### Pickup Process
- **Eligibility:** Only status `booked` can be marked picked up.
- **UI (RentalPickupModal):**
  - “Security Document Collected?”:
    - Document type: CNIC / Card / Other.
    - Document number (required).
    - Document image URL (optional).
  - Security status: collected (stored as `security_status: 'collected'`).
- **Backend (markRentalPickedUp):**
  - Writes `security_document_type`, `security_document_number`, `security_document_image_url`, `security_status: 'collected'` to `rentals`.
  - Performs stock out (`rental_out`); status → `picked_up`.

### Return Process
- **Eligibility:** Only status in `['rented','overdue','picked_up','active']` can be returned (i.e. must have been picked up).
- **UI (RentalReturnModal):**
  - Condition: Good / Minor damage / Major damage.
  - If not good: damage notes (required), penalty amount (required for major; optional for minor), penalty paid checkbox.
  - If penalty paid: “Penalty received into” account dropdown (from `getPaymentAccounts`).
  - Final Payable = Remaining Rent + Penalty.
  - “Document returned to customer” (security document returned).
- **Backend (receiveReturn):**
  - Stock in (`rental_in`).
  - Updates rental: `status: 'returned'`, `actual_return_date`, `condition_type`, `damage_notes`, `damage_charges`, `penalty_paid`, `document_returned`, **`security_status: 'returned'`**.
  - If penalty > 0 and penalty paid: inserts `rental_payments` with `payment_type: 'penalty'` and validates `penaltyPaymentAccountId`; updates `paid_amount` / `due_amount`.
- **Accounting (conceptual):**
  - Return: **Dr Cash/Bank**, **Cr Rental Income** (remaining); if penalty: **Cr Penalty/Other Income**. Mobile stores payment method from selected account; full journal integration can be added later.

### Rule
- Security document is collected at pickup (type, number, optional image) and returned at return; `security_status`: collected → returned.

---

## PART 5 — Damage Handling Rules

- **Minor damage:** Penalty amount is optional (manual input allowed).
- **Major damage:** Penalty amount is **required**; user cannot confirm return without entering a penalty (and if paid, selecting penalty account).
- **Balance:** Return cannot be completed if **Final Payable > 0** and not settled (enforced in UI and in `receiveReturn`: “Clear balance (remaining rent + penalty) before completing return.”).

---

## PART 6 — Database Integrity Rules

- **Cannot mark returned without pickup:** `receiveReturn` allows only status in `['rented','overdue','picked_up','active']`; returns error “Only rented or overdue rentals can be returned. Mark as picked up first.” for `booked`.
- **Cannot close return without clearing balance:** Backend checks `balanceAfterPenalty`; if still > 0 after applying penalty payment, returns error and does not update to returned.
- **Cannot record advance/penalty without account when amount > 0:** Frontend requires “Receive Advance Into” / “Penalty received into” when advance/penalty is paid; backend validates `advancePaymentAccountId` / `penaltyPaymentAccountId` and fails if invalid or inactive.
- **Security document:** `security_status` is set to `returned` only on successful return; no separate “release security without return” path.

---

## PART 7 — Backend Integration

- All rental flows use **Supabase** (company_id, branch_id where applicable).
- **createBooking:** Inserts `rentals`, `rental_items`; if advance > 0, validates account and inserts `rental_payments`.
- **markRentalPickedUp:** Updates `rentals` (including security fields), inserts `stock_movements` (rental_out).
- **receiveReturn:** Updates `rentals` (including security_status), inserts `stock_movements` (rental_in), optionally inserts penalty in `rental_payments` with account validation.
- No frontend-only state that bypasses DB; all status and payment changes go through the API.

---

## PART 8 — Deliverables Summary

| Deliverable                         | Status |
|-------------------------------------|--------|
| Mobile width overflow fixed globally| Done (CSS + table scroll containers) |
| Numeric keypad fixed globally       | Done (inputMode + pattern on numeric inputs) |
| Account selection DB linked         | Done (getPaymentAccounts + validation in createBooking/receiveReturn) |
| Security document workflow         | Done (pickup: type/number/image, security_status collected; return: security_status returned) |
| Return + penalty flow              | Done (condition, penalty, account, balance check) |
| Damage rules                       | Done (major: penalty required; balance must be cleared) |
| DB integrity rules                  | Done (no return without pickup; no close without balance; no payment without valid account) |
| Documentation                      | This document (MOBILE_RENTAL_FINAL_FLOW.md) |

---

*Last updated: Mobile Rental Final Professional Fix (Parts 1–8).*
