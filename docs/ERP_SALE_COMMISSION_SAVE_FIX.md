# ERP Sale Commission Save Fix (Duplicate Invoice / Save Flow)

**Date:** 2026-03-14  
**Scope:** Local only. One click = one save; stable invoice number on retry.

---

## Observed issue

When creating a new sale with salesman/commission selected, save sometimes failed with:

`duplicate key value violates unique constraint "sales_company_branch_invoice_unique"`

Sometimes pressing save again worked, suggesting an unstable save flow (double submit or invoice number reuse).

---

## Root cause

1. **Double submit:** No guard against the save handler running twice (e.g. double click or React strict mode). Both runs called `createSale`; the first could succeed and the second then hit the unique constraint with the same (or next) number depending on timing.
2. **Duplicate retry used hook state:** On duplicate key, the context retried with `getNumberingConfig(docType).nextNumber + 1` and `incrementNextNumber(docType)` (frontend hook). That can race with other tabs/sessions and does not guarantee a fresh DB-issued number.

---

## Fixes

### 1. Save-in-flight guard (SaleForm)

- Added `saveInProgressRef = useRef(false)`.
- At the start of `proceedWithSave`, if `saveInProgressRef.current` is true, return `null` immediately.
- Set `saveInProgressRef.current = true` at start of try, and `false` in `finally` with `setSaving(false)`.
- Ensures one click = one create/update call.

### 2. Retry with DB-issued number (SalesContext)

- On duplicate key (`23505` or message containing `sales_company_branch_invoice_unique`), instead of using the hook’s next number:
  - Call `documentNumberService.getNextDocumentNumberGlobal(companyId, sequenceType)` to get a fresh number from the DB.
  - Set `supabaseSale.invoice_no = effectiveInvoiceNo` and retry `saleService.createSale(...)` once.
- Removed use of `incrementNextNumber` and `getNumberingConfig` in the retry path so the single source of truth for the next number is the DB.

---

## Files changed

- `src/app/components/sales/SaleForm.tsx` – `saveInProgressRef` guard in `proceedWithSave`.
- `src/app/context/SalesContext.tsx` – duplicate-key retry uses `getNextDocumentNumberGlobal` only.

---

## Verification

1. Create a new sale, select salesman and commission, set status to Final, click Save once.
2. Sale should save successfully without duplicate key error.
3. Double-clicking Save should not create two sales (second run exits early).
4. If a duplicate ever occurs (e.g. rare race), the retry uses a new number from the DB and should succeed.

---

## Rollback

- SaleForm: remove `saveInProgressRef` and the early-return + ref set/clear in `proceedWithSave`.
- SalesContext: restore the previous duplicate-key block that used `getNumberingConfig`, `incrementNextNumber`, and `effectiveInvoiceNo = prefix + pad(nextNum)`.
