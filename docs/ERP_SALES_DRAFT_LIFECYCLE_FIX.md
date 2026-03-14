# ERP Sales Draft Lifecycle Fix

## Problem

- Sale saved as draft could appear as Final when reopened, or was not clearly editable.
- No consistent rule for draft numbering vs final numbering.
- Convert-to-final mechanism existed but form did not preserve draft status when opening.

## Root cause

In **SaleForm**, when pre-filling from `initialSale`, status was derived from `initialSale.type` only:
- If `type === 'quotation'` → set `saleStatus` to `'quotation'`.
- Else → set `saleStatus` to `'final'`.

So a draft sale (stored with `status: 'draft'`, `type: 'quotation'`) was treated as quotation or, in some paths, effectively shown as final. The actual DB `status` (draft/quotation/order/final) was not used when initializing the form.

## Fix

### 1. SaleForm.tsx – Initialize status from DB

**File:** `src/app/components/sales/SaleForm.tsx`

When editing an existing sale, set form status from the saved `status` field so draft stays draft:

- Read `savedStatus = (initialSale as any).status ?? initialSale.type`.
- If `savedStatus` is `'draft'`, `'quotation'`, `'order'`, or `'final'`, call `setSaleStatus(savedStatus)`.
- Otherwise keep previous fallback: quotation from `type === 'quotation'`, else final.

Result: reopening a draft opens in Draft mode and remains editable; quotation/order/final also match the record.

### 2. SalesPage.tsx – Convert to Final

**File:** `src/app/components/sales/SalesPage.tsx`

- On **Convert to Final**, call `updateSale(sale.id, { status: 'final', type: 'invoice' })` so the sale is consistently final and type is invoice.
- List already shows “Convert to Final” for non-final, non-cancelled sales; no UI change.

## Numbering

- Drafts keep their document number (e.g. DRAFT-xxx). Converting to final does **not** change the invoice number in this pass; only status and type are updated.
- If you later want a new SL- number on finalize, that can be done in a follow-up (numbering service + context support for updating `invoice_no` when converting draft → final).

## Verification

- **Case A:** Save a sale as Draft → it appears as Draft in the list and in the form when reopened.
- **Case B:** Open/Edit a Draft → form shows Draft, remains editable, Save keeps it draft (or you can switch to Final and save).
- **Case C:** From list, **Convert to Final** → sale becomes Final; stock movements and list refresh as before.

## Rollback

- In SaleForm, revert the “Pre-fill status” block to the previous logic that only used `initialSale.type` (quotation vs final).
- In SalesPage, revert `updateSale(sale.id, { status: 'final', type: 'invoice' })` back to `updateSale(sale.id, { status: 'final' })`.
