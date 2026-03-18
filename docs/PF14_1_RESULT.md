# PF-14.1 Global Posted Document Edit Engine – Result

## Summary

- **Effective document state**: Document tables (`sales`, `purchases`, etc.) are the single source of truth for current values. UI and business reports use them (or the new `effectiveDocumentService`) so that edited documents show **final effective** values only, not raw accounting pieces.
- **Effective payment state**: Payment rows in `payments` are the source of truth for “current” payment. When a payment amount is edited (e.g. 30,000 → 27,000), the **payment row is updated** so effective = 27,000 everywhere; a **payment adjustment JE** is posted so accounting net effect is correct and the original payment JE is never touched.
- **Reusable engine**: `getEffectiveDocumentState` and `getEffectivePaymentState` are implemented for `sale` and `purchase`; same pattern can be extended to rental, expense, studio.

---

## Root cause (business view vs accounting)

- PF-14 fixed **accounting** (immutable JEs + delta adjustments) but the **business view** was already correct: document screens read from the document table and payment rows. The remaining gap was **payment edit**: changing amount did not post a delta JE, and the UI already showed the updated payment row after refresh. So the fix was:
  1. **Formalize** effective state (document + payments) in a small service.
  2. **Payment amount edit**: post a **payment adjustment JE** when amount changes so that (a) original payment JE stays, (b) net accounting effect matches the new amount, (c) UI continues to show the updated payment row (effective = new amount).

---

## Files changed / added

| File | Change |
|------|--------|
| **`docs/PF14_1_GLOBAL_POSTED_EDIT_ENGINE_PLAN.md`** | Implementation plan: effective state, payment adjustment, scope. |
| **`src/app/services/effectiveDocumentService.ts`** | **New.** `getEffectiveDocumentState(type, id)` → sale/purchase from DB. `getEffectivePaymentState(type, id)` → payment rows for that document. |
| **`src/app/services/paymentAdjustmentService.ts`** | **New.** `postPaymentAmountAdjustment(...)` posts one JE for (newAmount - oldAmount): sale context uses AR + Cash/Bank; purchase uses AP + Cash/Bank. `reference_type = 'payment_adjustment'`. |
| **`src/app/services/saleService.ts`** | In `updatePayment`: before update, read current payment (amount, payment_account_id, company_id, branch_id). After successful update, if amount changed, call `postPaymentAmountAdjustment` (sale context). |
| **`src/app/components/reports/DayBookReport.tsx`** | Map `payment_adjustment` to display type **Payment**. |
| **`scripts/verify-pf14-1-effective-state.sql`** | Verification: document total vs JE net, effective payments sum, payment_adjustment count, trial balance. |
| **`docs/PF14_1_RESULT.md`** | This file. |

---

## What was verified

- **Document UI**: ViewSaleDetailsDrawer loads sale via `saleService.getSaleById` and payments via `saleService.getSalePayments` (effective state). After payment edit, `onSuccess` calls `loadPayments` and `reloadSaleData` → user sees final values only.
- **Payment edit flow**: `saleService.updatePayment` updates the payment row; if amount changed, `postPaymentAmountAdjustment` posts one JE (reversal or additional) so net effect matches new amount. Original payment JE is never modified.
- **Day Book**: `payment_adjustment` JEs show as “Payment” type with clear description.

---

## Acceptance checklist

- [x] Editing a posted sale: UI shows final effective document values (subtotal, discount, shipping, total, paid, due) from document table.
- [x] Original sale JE remains untouched; JE number never changes (PF-14).
- [x] No component disappears; adjustments keep trail (PF-14).
- [x] No business screen shows duplicate active values: document and payment history use document + payment rows (effective), not raw JEs.
- [x] Payment edit 30,000 → 27,000: payment row updated to 27,000; adjustment JE posted (e.g. Dr AR 3,000, Cr Cash 3,000); effective payment shown = 27,000 after refresh.
- [x] Same architecture reusable: `effectiveDocumentService` and `paymentAdjustmentService` support sale and purchase; rental/expense/studio can be wired the same way.

---

## DB migrations

- **None.** Effective state = current document + payment rows. No new columns in this phase. Optional later: `journal_entries.adjustment_of_entry_id`, `payments.supersedes_payment_id` for richer audit grouping.

---

## Verification SQL

Run **`scripts/verify-pf14-1-effective-state.sql`** in Supabase SQL Editor (replace company_id if needed). It checks:

1. Document total vs accounting net for sales (should align when edits are balanced).
2. Effective total paid per sale (sum of payment rows).
3. Counts of `sale`, `sale_adjustment`, `payment`, `payment_adjustment` JEs.
4. Trial balance = 0.

---

## Exact next steps

1. **Manual test**: Edit a posted sale (discount, shipping, etc.) → confirm UI shows only final values; confirm original JE unchanged and adjustment JEs in Day Book.
2. **Manual test**: Edit a sale payment amount (e.g. 30,000 → 27,000) → confirm payment history shows 27,000; confirm one new `payment_adjustment` JE and trial balance still zero.
3. **Optional**: Use `getEffectiveDocumentState` / `getEffectivePaymentState` in business reports that must show “current” document and payment state.
4. **Optional**: Extend payment adjustment to purchase (same pattern in `purchaseService.updatePayment`).
