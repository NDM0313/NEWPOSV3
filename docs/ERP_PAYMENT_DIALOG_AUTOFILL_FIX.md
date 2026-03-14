# ERP Payment Dialog — Amount Auto-fill Fix

## Requirement

When the payment dialog opens (after creating a sale or from "Add Payment"), the amount field should default to the sale's payable amount: full due if unpaid, remaining due if partially paid. User can still edit manually.

## Root cause

The dialog was resetting the amount to `0` whenever it opened in "add payment" mode, instead of using the `outstandingAmount` (or derived `effectiveOutstanding`) passed by the parent.

## Fix

**File: `src/app/components/shared/UnifiedPaymentDialog.tsx`**

- In the effect that runs when the dialog opens, for the non–edit path (new payment) the amount is set to `Math.max(0, effectiveOutstanding)` instead of `0`.
- `effectiveOutstanding` is already computed from props: when the parent passes `outstandingAmount` (or `totalAmount`/`paidAmount`), it reflects full due or remaining due.
- Added `effectiveOutstanding` to the effect dependency array so the prefill updates when the dialog is opened with different sale/context.

## Behavior

- **Fully unpaid sale**: Parent passes `outstandingAmount = total` (or totalAmount/paidAmount such that effectiveOutstanding = total). Dialog opens with amount = full due.
- **Partially paid sale**: Parent passes `outstandingAmount = remaining due` (or totalAmount/paidAmount so effectiveOutstanding = remaining). Dialog opens with amount = remaining due.
- **Edit payment**: Unchanged; amount is set from `paymentToEdit.amount`.
- User can still change the amount before saving.

## Verification

1. Create a new sale (final), open payment dialog → amount should be the sale total.
2. Record a partial payment, open "Add Payment" again → amount should be the remaining due.
3. Save/Add Payment flow should work as before; only the initial value of the amount field changes.

## Rollback

Revert the change in `UnifiedPaymentDialog.tsx`: in the same effect, set `setAmount(0)` in the else branch and remove `effectiveOutstanding` from the dependency array.
