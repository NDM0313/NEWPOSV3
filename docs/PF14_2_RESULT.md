# PF-14.2 Business Edit UX + Audit Trail Separation – Result

## Root cause of current confusion

1. **Journal / Day Book** showed raw `sale_adjustment` and `payment_adjustment` entries without clear “same document/payment edited” context, so users treated them as new transactions.
2. **Activity / History** did not record payment edits or sale component edits (discount, shipping, extra expense, total), so there was no human-readable audit of what changed.
3. **JE descriptions** did not include old vs new values, so the accounting trail was harder to interpret.
4. **Payment edit** already updated the same row (no duplicate); the gap was only history and description clarity.

## Files changed

| File | Change |
|------|--------|
| **`src/app/services/saleService.ts`** | After successful `updatePayment`, log activity with `action: 'payment_edited'`, `oldValue`/`newValue`, `description`: "Payment edited from Rs X to Rs Y via Cash". |
| **`src/app/services/activityLogService.ts`** | In `formatActivityLog`: added cases for `payment_edited` and `sale_component_edited` so History tab shows human-readable text. |
| **`src/app/context/SalesContext.tsx`** | After `postSaleEditAdjustments`, log one activity per changed component: discount, shipping, extra expense, total; `action: 'sale_component_edited'`, `field`, `oldValue`, `newValue`, `description`: "Discount changed from Rs X to Rs Y", etc. |
| **`src/app/services/saleAccountingService.ts`** | Sale adjustment JE descriptions now include old/new: e.g. "Sale adjustment – discount change (was Rs 1,900, now Rs 2,500) – SL-0004". |
| **`src/app/services/paymentAdjustmentService.ts`** | Payment adjustment JE description: "Payment edited: was Rs 30,000, now Rs 27,000 – SL-0004". |
| **`scripts/verify-pf14-2-business-edit-ux.sql`** | Checks: no duplicate payment rows per sale, activity log actions, sample descriptions. |
| **`docs/PF14_2_RESULT.md`** | This file. |

## Payment edit flow (confirmed)

- **Single row**: `saleService.updatePayment` uses `.update(updateData).eq('id', paymentId)` – the same payment row is updated; no new row is created.
- **Effective value**: Payment history and “total paid” use `getSalePayments(saleId)` (current rows), so the edited amount (e.g. 25,000) is the only value shown.
- **Accounting**: Original payment JE is unchanged; one `payment_adjustment` JE is posted for the delta (PF-14.1).
- **History**: New `payment_edited` activity log with description "Payment edited from Rs 30,000 to Rs 25,000 via Cash".

## History / activity logging

- **Payment edited**: Logged in `saleService.updatePayment` with `action: 'payment_edited'`, `entityId: saleId`, `entityReference: invoiceNo`, `oldValue`/`newValue`, `description`. Shown in sale History tab via `formatActivityLog`.
- **Sale component edited**: Logged in `SalesContext` after `postSaleEditAdjustments` for each of: Discount, Shipping, Extra expense, Total; `action: 'sale_component_edited'`, `field`, `oldValue`, `newValue`, `description` (e.g. "Discount changed from Rs 1,900 to Rs 2,500"). Shown in sale History tab.

## Journal / Day Book

- **Immutable trail**: Original sale and payment JEs are still never modified or deleted.
- **Adjustment JEs**: `sale_adjustment` and `payment_adjustment` remain visible for audit.
- **Descriptions**:  
  - Sale: e.g. "Sale adjustment – discount change (was Rs 1,900, now Rs 2,500) – SL-0004".  
  - Payment: e.g. "Payment edited: was Rs 30,000, now Rs 27,000 – SL-0004".  
  So each adjustment is clearly tied to a document and to old/new values.

## Verification SQL

Run **`scripts/verify-pf14-2-business-edit-ux.sql`** in Supabase SQL Editor (replace company_id if needed). It checks:

1. No duplicate payment rows per (reference_type, reference_id) that would imply duplicate “active” payments.
2. Counts of `payment_edited`, `sale_component_edited` (and related) actions in `activity_logs`.
3. Recent sale activity for manual review.
4. Sample JE descriptions for `sale_adjustment` and `payment_adjustment`.

## Acceptance criteria

- [x] Editing a posted payment behaves like editing the same payment in the UI (one row, updated amount).
- [x] Journal preserves the immutable accounting trail (original JEs + adjustment JEs).
- [x] History tab shows payment edit events (e.g. "Payment edited from Rs 30,000 to Rs 25,000 via Cash").
- [x] Sale history shows human-readable component changes (e.g. "Discount changed from Rs 1,900 to Rs 2,500", "Total changed from Rs 81,500 to Rs 80,900").
- [x] No duplicate active values in payment history (single payment row per payment id, updated in place).
- [x] Day Book / Journal remain audit-safe with clearer adjustment descriptions.

## Next steps (optional)

- Apply the same activity-logging pattern to **purchase** (payment_edited, purchase_component_edited).
- Add optional grouping in Day Book by (reference_type, reference_id) so all entries for one sale appear together.
- Extend History tab to show “Accounting” vs “Business” sections if you want to separate JE references from business events in the UI.
