# ERP Sales Commission & Save — Last Mile Final Report

## Summary

Three targeted fixes were implemented for sales/commission usability (local only):

1. Sale form commission field auto-uses the selected salesman’s default % and shows 0 clearly.
2. Save and POS save are protected against multi-click duplicate saves.
3. Admin-created sale with selected salesman is owned by that salesman for commission/reporting; sale detail shows Created By and Salesman separately.

---

## Issue 1 — Sale form commission auto-fill from user default

**Root cause:** Commission input showed blank when value was 0; default-commission effect did not document/include 0% explicitly.

**Files changed:** `src/app/components/sales/SaleForm.tsx`

- Effect: when a salesman is selected on a **new** sale, set commission type to percentage and value from `salesmen[].defaultCommissionPercent` (including 0). On edit we do not overwrite saved commission.
- Input: `value={commissionValue === 0 ? 0 : commissionValue}` and `min={0}`; when a salesman is selected, the commission type Select and value Input are **disabled** so the value is always the salesman’s default.

**UX for zero commission:** When a salesman is selected, the commission type selector and value input are **disabled** (not editable). The value is always the salesman’s default (including 0%). No per-invoice override in the UI.

**Verification:** Case A (1% default → field shows 1%), Case B (0% → field shows 0), Case C (admin overrides on one sale).

**Doc:** `docs/ERP_SALE_FORM_DEFAULT_COMMISSION_AUTOFILL_FINAL.md`

---

## Issue 2 — Save button multi-click protection

**Root cause:** During slow DB/network, multiple clicks could trigger multiple create/save calls and duplicate sales.

**Files changed:**

- **`src/app/components/sales/SaleForm.tsx`**
  - `proceedWithSave` already used `saveInProgressRef` and `setSaving`. Early returns (branch validation) now set `saveInProgressRef.current = false` and `setSaving(false)` and return `null` so the next save is not blocked.
  - Save / Save & Print buttons remain `disabled={saving}` and show loading text.

- **`src/app/components/pos/POS.tsx`**
  - Added `posSaveInProgressRef` and `posSaveInProgress` state.
  - At start of `handleProceedToPayment`: if ref is already true, return; else set ref and state. In `finally` (and on stock-validation early return): clear ref and state.
  - “Proceed to Payment” button is disabled when `posSaveInProgress` and shows “Creating sale...” with spinner.

**How it works:** One in-flight request per flow (ref + loading state). Button is disabled and shows loading; extra clicks are ignored by the ref check. Early validation failures clear the ref so the user can correct and save again.

**Verification:** Case D (normal save, one click during slow save), Case E (POS, rapid clicks → one sale).

**Doc:** `docs/ERP_SAVE_BUTTON_DUPLICATE_PROTECTION.md`

---

## Issue 3 — Admin-created sale and selected salesman

**Root cause:** No bug in ownership; requirement was to confirm and clarify UI. Commission report and list already use `salesman_id`; `created_by` is separate.

**Files changed:** `src/app/components/sales/ViewSaleDetailsDrawer.tsx`

- Salesman label updated to “Salesman (commission/report)” so it is clear this is the commission/report owner, distinct from “Created By”.

**How it works:** SaleForm sends `salesmanId` for the selected salesman; SalesContext persists it as `salesman_id`. Commission report and lists use `salesman_id`. `created_by` remains the auth user (admin). Sale detail shows both “Created By” and “Salesman (commission/report)”.

**Verification:** Case F (admin creates sale with salesman → appears under that salesman in commission report), Case G (sale detail shows both fields).

**Doc:** `docs/ERP_ADMIN_CREATED_SALESMAN_OWNERSHIP_FIX.md`

---

## Verification checklist

| Case | Description | Status |
|------|-------------|--------|
| A | User default 1% → sale form shows 1% | Effect + input value |
| B | User default 0% → field shows 0 and disabled | value includes 0; field disabled |
| C | Commission locked to salesman default | Field disabled when salesman selected |
| D | Multiple Save clicks → one sale | Ref + disabled + early-return reset |
| E | Multiple POS Proceed to Payment → one sale | POS ref + state + disabled |
| F | Admin-created sale with salesman in report | Already correct; drawer label clarified |
| G | Sale detail shows Created By and Salesman | Both shown; Salesman labeled for commission |

---

## Rollback notes

- **Issue 1:** Revert commission input value and effect (see ERP_SALE_FORM_DEFAULT_COMMISSION_AUTOFILL_FINAL.md).
- **Issue 2:** Revert early-return ref reset in SaleForm; remove POS ref/state and guard/finally/disabled (see ERP_SAVE_BUTTON_DUPLICATE_PROTECTION.md).
- **Issue 3:** Revert drawer label to “Salesman” (see ERP_ADMIN_CREATED_SALESMAN_OWNERSHIP_FIX.md).

Commission report, batch posting, POS numbering, and no-repeat posting logic were not changed.
