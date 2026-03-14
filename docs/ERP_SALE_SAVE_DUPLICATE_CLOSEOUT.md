# ERP Sale Save Duplicate Key – Closeout

**Date:** 2026-03-14  
**Scope:** Local only. One click = one save; no duplicate `sales_company_branch_invoice_unique` from normal use.

---

## Why the previous pass was incomplete

- A **save-in-flight ref** and **retry with DB number** were documented and may have been added in code, but either they were reverted or the ref was not present in the file. This closeout re-applies and verifies the fix.

---

## Root cause of duplicate key

1. **Double submit:** Save handler could run twice (e.g. double click, or two code paths firing). Both calls invoke `createSale`; the first may succeed and the second then hits the unique constraint on `(company_id, branch_id, invoice_no)`.
2. **Retry using frontend state:** On duplicate, the context previously used `getNumberingConfig(docType).nextNumber + 1` and `incrementNextNumber(docType)`. That is not safe under concurrency and can produce the same or a wrong number.

---

## Fixes applied

### 1. Save-in-flight guard (SaleForm)

- **`saveInProgressRef = useRef(false)`** at the start of the save flow.
- At the **very start** of `proceedWithSave`: if `saveInProgressRef.current` is true, **return null** immediately (no second create).
- At the start of `try`: set `saveInProgressRef.current = true` and `setSaving(true)`.
- In **finally**: set `saveInProgressRef.current = false` and `setSaving(false)`.
- Buttons already use `disabled={saving}`; the ref ensures that even if a second call gets through before state updates, the second execution exits without calling `createSale`.

### 2. Retry with DB-issued number only (SalesContext)

- On duplicate key (`23505` or message containing `sales_company_branch_invoice_unique`):
  - Call **`documentNumberService.getNextDocumentNumberGlobal(companyId, sequenceType)`** to get a **new** number from the DB.
  - Set `supabaseSale.invoice_no = effectiveInvoiceNo` and retry **once**: `saleService.createSale(supabaseSale, supabaseItems, { allowNegativeStock })`.
- Removed use of `getNumberingConfig` and `incrementNextNumber` in the retry path so the only source of the next number on retry is the DB.

---

## Files changed

- `src/app/components/sales/SaleForm.tsx` – `saveInProgressRef`; early return when already in progress; set/clear ref in try/finally.
- `src/app/context/SalesContext.tsx` – duplicate-key catch block now uses `getNextDocumentNumberGlobal` and single retry only.

---

## Verification

1. **Normal save** – New sale, add items, Save once; sale is created, no duplicate error.
2. **Save with salesman** – Select salesman and commission, Final, Save once; success.
3. **Save & Print** – Save & Print once; sale created and print flow runs, no duplicate error.
4. **Double click** – Second click while saving should not create a second sale (ref guard + disabled button).

---

## Rollback

- **SaleForm:** Remove `saveInProgressRef`, the early-return check, and ref set/clear in try/finally.
- **SalesContext:** Restore the previous duplicate-key block that used `getNumberingConfig`, `incrementNextNumber`, and `effectiveInvoiceNo = prefix + pad(nextNum)`.
