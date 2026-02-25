# Mobile Rental Booking Flow (Updated — Correct Business Pattern)

## Purpose

This document describes the **redesigned mobile rental booking flow** aligned with the real business process and web rental accounting logic. The flow is step-based: product first, then duration, then manual rent, then advance, then payment account (if advance > 0), then final confirmation.

---

## ✅ Required Rental Booking Flow

### Step order (high level)

1. **Customer** — Select customer (unchanged).
2. **Step 1 — Product Selection** — First screen after customer.
3. **Step 2 — Duration Selection** — After product(s) selected.
4. **Step 3 — Manual Rent Entry** — After duration; no auto calculation.
5. **Step 4 — Advance Entry** — Advance amount; balance = Rent − Advance.
6. **Step 5 — Payment Confirmation** — Summary + “Receive Advance Into” (mandatory if advance > 0).
7. **Step 6 — Final Confirmation** — Branch (if needed), notes, Create Booking.

---

## Step Details

### Step 1 — Product Selection (First Screen)

- **Product search bar** at top (search by name or SKU).
- User searches → selects product(s) → **selected product card(s)** appear below (image placeholder + SKU + name).
- **Do not ask dates or rent amount here.**
- Next: proceed to **Duration**.

### Step 2 — Duration Selection

- Show **Pickup Date** and **Return Date** (or allow manual “X days” if desired).
- Dates are for:
  - Booking period
  - Availability check  
- **Not** for automatic price calculation.
- Next: proceed to **Rent Amount**.

### Step 3 — Manual Rent Entry

- Single field: **“Enter Rent Amount (Rs.)”** — **manual input only**.
- Manager decides rent; **no per-day fixed logic**, **no auto calculation**.
- Next: proceed to **Advance**.

### Step 4 — Advance Entry

- Show **Rent** (read-only).
- **Advance Amount (Rs.)** — optional but common (e.g. Rent = 50,000, Advance = 20,000).
- System calculates: **Balance Due = Rent − Advance**.
- Next:
  - If **Advance > 0** → **Step 5 (Payment Confirmation)**.
  - If Advance = 0 → **Step 6 (Final Confirmation)**.

### Step 5 — Payment Confirmation Screen

- Shown **only when advance > 0** (mandatory in that case).
- **Summary:** Product(s), Pickup Date, Return Date, Rent, Advance, Balance Due.
- **“Receive Advance Into”** — dropdown:
  - Cash Account  
  - Bank Account  
  - Other Ledger  
- Accounting alignment: **Dr Cash/Bank (selected account), Cr Rental Advance Liability.**
- Next: **Step 6 — Final Confirmation**.

### Step 6 — Final Confirmation

- **Branch** (if “All Branches” selected) — required.
- **Notes** (optional).
- **Create Booking** button.
- On confirm:
  - Create booking (rentals + rental_items).
  - If advance received: record advance in `rental_payments` with **method** = selected account (cash/bank/other).
  - **Do not record full rental income yet** — income is finalized on **return** (with penalty if any).

---

## 🔒 Accounting Rules (Web-Aligned)

| Stage        | What is recorded |
|-------------|-------------------|
| **Booking** | If advance > 0: **Dr Cash/Bank, Cr Rental Advance Liability.** No full income yet. |
| **Pickup**  | Only advance is already recorded; no additional accounting at pickup in this flow. |
| **Return**  | Finalize income + penalty (if any). |

- **Advance:** Stored in `rental_payments` with `payment_type: 'advance'` and `method` = cash | bank | other (from “Receive Advance Into”).
- **Full rental income:** Recognized on return, not at booking.

---

## ❌ Removed (Incorrect Patterns)

- **Asking dates before product selection** — dates come **after** product selection.
- **Auto per-day rent calculation** — rent is manual only.
- **Fixed rental rate assumption** from product — manager enters rent.
- **Mixing payment selection on same screen as advance** — payment account has its own step (Step 5) when advance > 0.

---

## 🎨 UI Requirements

- **Clean vertical layout**, no clutter.
- **Mobile-optimized** step-by-step flow.
- **Next** and **Confirm** buttons clearly placed (e.g. fixed bottom bar where applicable).
- **Payment account selection** only on the dedicated Payment Confirmation step when advance > 0.

---

## Implementation Summary

### CreateRentalFlow (Mobile)

- **Steps:** `customer` → `products` → `duration` → `rent` → `advance` → `payment_confirm` (if advance > 0) → `confirm`.
- **Product step:** Search bar at top; selected product cards below; product list filtered by search.
- **Duration step:** Pickup + return date only; no rent or price here.
- **Rent step:** Single “Enter Rent Amount” field; no auto calculation.
- **Advance step:** Rent (read-only), advance input, balance due.
- **Payment step:** Summary + “Receive Advance Into” (Cash / Bank / Other); shown only when advance > 0.
- **Confirm step:** Branch (if needed), notes, Create Booking.

### API (createBooking)

- **advancePaymentMethod** (optional): `'cash' | 'bank' | 'other'`.
- When `paidAmount > 0`, advance is stored in `rental_payments` with `method` = `advancePaymentMethod` (default `'cash'`).
- Aligns with web accounting: Dr Cash/Bank, Cr Rental Advance.

### Files

- `erp-mobile-app/src/components/rental/CreateRentalFlow.tsx` — restructured 6-step flow, product search, payment account selection.
- `erp-mobile-app/src/api/rentals.ts` — `CreateBookingInput.advancePaymentMethod`, used when inserting advance payment.

---

*Document describes the updated mobile rental booking flow. Must match web rental accounting logic (advance only at booking; income + penalty on return).*
