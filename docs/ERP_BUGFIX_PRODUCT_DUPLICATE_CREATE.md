# ERP Bugfix: Product Saving Twice

**Date:** 2026-03-13  
**Issue:** A newly created product was being saved twice (two product records for one user action).

---

## Root cause

- **UI-side double execution:** The product form submit ran twice when the user clicked "Save Product" (or "Save & Add to Transaction"). Causes:
  1. **No synchronous submit guard:** `onSubmit` used only `setSaving(true)`. Because React state updates are asynchronous, a second click (or StrictMode double-invoke) could call `onSubmit` again before `saving` became true, so two `productService.createProduct()` calls could run.
  2. **Buttons not disabled:** Save buttons stayed clickable during save, allowing double-clicks.

- **DB:** The database received two INSERTs when the user triggered save twice; there was no duplicate-insert logic in the service for create (only retry on SKU conflict).

---

## Fix

1. **Submit lock ref:** Added `submitInProgressRef` (useRef). At the very start of `onSubmit`, if `submitInProgressRef.current` is true, return immediately. Otherwise set it to true. In `finally` (and on early returns inside try that exit without completing save), set it back to false. This prevents a second submission from running while the first is in progress, regardless of state timing.

2. **Early returns:** When returning early (e.g. block variations modal, variation limit exceeded), set `submitInProgressRef.current = false` so the user can submit again after resolving the issue.

3. **Buttons:** Save and "Save & Add to Transaction" are `disabled={saving}` and show "Saving..." while `saving` is true, reducing accidental double-clicks.

---

## Files changed

- `src/app/components/products/EnhancedProductForm.tsx`:
  - Import `useRef`.
  - Added `submitInProgressRef`.
  - Top of `onSubmit`: guard with ref, set ref true; clear ref on early returns and in `finally`.
  - Save buttons: `disabled={saving}`, label "Saving..." when saving, `disabled:opacity-50 disabled:pointer-events-none` classes.

---

## Verification

- Create one new product with a single click on "Save Product": only one row appears in the products list and in the DB.
- Double-click or rapid second click: second submission is ignored (ref guard).
- After "block variations" or "variation limit" early return, user can click Save again.

---

## Rollback

Revert changes in `EnhancedProductForm.tsx`: remove `submitInProgressRef`, remove ref check and reset, remove `disabled` and "Saving..." from the two save buttons.
