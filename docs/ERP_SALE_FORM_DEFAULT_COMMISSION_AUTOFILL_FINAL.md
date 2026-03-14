# ERP Sale Form — Default Commission Auto-fill (Final)

## Requirement

When a salesman is selected on a sale:

- If the user’s default commission is 1%, the sale form commission field should show 1%.
- If 2%, show 2%.
- If 0%, show 0 clearly.
- The commission field and type selector are **disabled** (not editable) when a salesman is selected — the value is always the salesman’s default. No per-invoice override in the UI.

## Root cause

- The commission field showed an empty value when the value was 0 (`value={commissionValue > 0 ? commissionValue : ''}`).
- The default-commission effect did not set the value when the salesman’s default was explicitly 0 (condition used `pct >= 0` but the comment suggested only “set” when defined; 0 was already included).

## Fix

**File: `src/app/components/sales/SaleForm.tsx`**

1. **Auto-fill from salesman default**
   - Effect runs when `salesmanId` or `salesmen` change, only for **new** sales (`!initialSale?.id`). When editing, we do not overwrite the saved commission.
   - If the selected salesman has `defaultCommissionPercent != null` (including 0), we set `commissionType` to `'percentage'` and `commissionValue` to that number so 0% is applied and displayed.

2. **Show 0 clearly**
   - Commission input uses `value={commissionValue === 0 ? 0 : commissionValue}` so 0 is displayed as “0” instead of blank, and `min={0}` on the input.

3. **Disabled when salesman selected**
   - When a salesman is selected (`salesmanId` is set and not `"1"` or `"none"`), the commission type `Select` and the commission value `Input` are **disabled**. The displayed value is always the salesman’s default; no per-invoice override in the UI.

## UX for zero commission

- When default is 0%, the field shows **0** and is **disabled** (same as for any other % when a salesman is selected).

## Verification

- **Case A:** Set a user’s default commission to 1% → create new sale, select that salesman → commission field shows 1% and is disabled.
- **Case B:** Set default to 0% → select that salesman → field shows 0 (not blank) and is disabled.
- **Case C:** With a salesman selected, the commission field cannot be changed; saved sale uses the salesman’s default.
- **Case G:** Sale detail shows “Created By” and “Salesman (commission/report)” separately.

## Rollback

- Remove `disabled={!!(salesmanId && salesmanId !== '1' && salesmanId !== 'none')}` from the commission `Select` and `Input` to make the field editable again.
- Revert the commission input to `value={commissionValue > 0 ? commissionValue : ''}` and remove `min={0}` if needed.
- Revert the effect to only set when `pct != null && Number(pct) > 0` if you do not want 0% to auto-fill.
