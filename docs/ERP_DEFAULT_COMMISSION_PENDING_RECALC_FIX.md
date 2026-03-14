# ERP Default Commission — Auto-apply and Pending Recalc

## Business rule

- New sales use the salesman’s current default commission % when a salesman is selected.
- Changing a user’s default commission (e.g. from 0% to 1%) should:
  - Apply to all **new** sales automatically.
  - Allow **pending / unposted** commission sales to be recalculable or updated in a controlled way.
  - **Posted** sales must not change.

## Changes made

### 1. User default commission field

**Migration: `migrations/users_default_commission_percent.sql`**

- Adds optional column `users.default_commission_percent` (DECIMAL(5,2), nullable).
- When set, it is used as the default commission % when that user is assigned as salesman.

**File: `src/app/services/userService.ts`**

- Extended `User` interface with optional `default_commission_percent?: number | null`.
- `getAllUsers` / `getSalesmen` already use `select('*')`, so they will return this column once the migration is applied.

### 2. SaleForm: apply default when salesman is selected

**File: `src/app/components/sales/SaleForm.tsx`**

- Salesmen list now includes `defaultCommissionPercent` from each user.
- When a salesman is selected for a **new** sale (no `initialSale`), an effect sets commission type to percentage and `commissionValue` to that salesman’s `default_commission_percent` if present.
- Admin can still override the commission % per sale; the default is only applied when the salesman is chosen.
- For **existing** sales (edit mode), we do not overwrite the saved commission; only new sales get the default.

### 3. Pending sales recalc

- **No automatic** update of pending sales when a user’s default commission is changed (avoids accidental bulk changes).
- A controlled **“Recalculate pending commission”** action can be added later (e.g. in Commission report or User settings) that:
  - Only updates sales with `commission_status = 'pending'`.
  - Recomputes `commission_percent` and `commission_amount` from the salesman’s current `default_commission_percent` and sale base amount.
  - Does not touch `commission_status = 'posted'` or `commission_batch_id`.

## Verification

1. Run `migrations/users_default_commission_percent.sql` in Supabase.
2. In User Management, set a user’s default commission % (if you add a UI for `default_commission_percent`; otherwise set it in DB for testing).
3. Create a new sale and select that user as salesman → commission % and amount should default from the user’s default.
4. Override commission % on the sale and save → override should persist.
5. Edit an existing sale with commission → saved commission should not be replaced by the default.

## Rollback

- Revert SaleForm changes (remove default-commission effect and `defaultCommissionPercent` from salesmen list).
- Revert User type and migration; optionally drop column: `ALTER TABLE public.users DROP COLUMN IF EXISTS default_commission_percent;`
