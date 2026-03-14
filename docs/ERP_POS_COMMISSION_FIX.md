# ERP POS Sales in Commission Report

## Requirement

POS sales (web or mobile) must support commission: persist `salesman_id`, `commission_percent`, `commission_amount`, and `commission_status` so POS sales appear in the commission report and in sale details.

## Root cause

The **web POS** (`src/app/components/pos/POS.tsx`) was building `saleData` for `createSale()` without any commission or salesman fields. So POS sales were stored with null `salesman_id` and default/zero commission, and did not show in the commission report.

## Fix

**File: `src/app/components/pos/POS.tsx`**

When building `saleData` for checkout, the following fields are now passed:

- **salesmanId**: `(user as any)?.id ?? null`  
  The current app user’s id (from `useSupabase().user`, i.e. `users.id`). So the sale is attributed to the user who is logged in at the POS (admin or salesman).

- **commissionAmount**: `0`  
  POS does not compute commission by default; amount can be updated later if needed, or you can add a default % later.

- **commissionPercent**: `null`  
  No default percentage from POS; can be edited later on the sale if needed.

`SalesContext.createSale` and the backend already map these into `sales.salesman_id`, `commission_amount`, `commission_percent`, and `commission_status = 'pending'`. So no backend change was required; only the payload from the POS was completed.

## Behavior

- **Admin at POS**: Sale is created with `salesman_id` = admin’s user id (or null if you prefer; currently we set current user so the sale is attributed).
- **Salesman at POS**: Sale is created with `salesman_id` = that salesman’s id, so it appears under their name in the commission report.
- Commission report includes rows where `commission_amount > 0` OR `salesman_id IS NOT NULL`, so POS sales with a salesman appear even when commission amount is 0.
- Sale detail (e.g. View Sale) already shows salesman and commission when present; no change needed there.

## Mobile POS

The mobile app’s POS (`erp-mobile-app`) uses a different API (`salesApi.createSale`). To have mobile POS sales participate in commission, the mobile payload should also include `salesmanId` (and optionally `commissionAmount` / `commissionPercent`) when the backend supports them. That can be done in a separate change in the mobile repo.

## Verification

1. Log in as a salesman (or admin) and open POS.
2. Complete a sale and finish checkout.
3. Open Reports → Commission, filter by that user or "All salesmen", Include due sales → the POS sale should appear.
4. Open the sale from the sales list and check Sale detail → Salesman and commission section should show the current user (and 0% / 0 amount if not set).

## Rollback

In `POS.tsx`, remove the three fields `salesmanId`, `commissionAmount`, and `commissionPercent` from the `saleData` object passed to `createSale()`.
