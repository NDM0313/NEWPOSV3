# ERP Admin-Created Sale — Salesman Ownership

## Business rule

When an admin creates a sale and selects a salesman, that sale must count as that salesman’s for commission, reporting, and listing. `created_by` stays the admin; `salesman_id` is the selected salesman.

## Current behavior (verified)

- **createSale payload:** SaleForm builds `saleData` with `salesmanId: (salesmanId && salesmanId !== "1" && salesmanId !== "none") ? salesmanId : null`. So the selected salesman’s user id is sent.
- **SalesContext:** Maps `salesmanId` to `salesman_id` in the Supabase insert. So the DB row has `created_by` = auth user (admin) and `salesman_id` = selected salesman.
- **Commission report:** Uses `sales.salesman_id` (and optionally filters by salesman). So admin-created sales with a selected salesman appear under that salesman.
- **Sale detail:** ViewSaleDetailsDrawer shows “Created By” (from `sale.createdBy`) and “Salesman (commission/report)” (from `salesman_id` + users lookup). So both are visible and distinct.

## Change made

**File: `src/app/components/sales/ViewSaleDetailsDrawer.tsx`**

- The label for the salesman field was updated from “Salesman” to “Salesman (commission/report)” so it is clear that this is the commission/report owner, separate from “Created By”.

No change was required in createSale payload, SalesContext, or commission report logic; they already use `salesman_id` for ownership.

## POS

- POS currently sets `salesmanId: (user as any)?.id` so the sale is attributed to the logged-in user. If in the future POS supports “select salesman” (e.g. for admin at POS), the same pattern applies: send that selected id as `salesmanId` and it will be stored as `salesman_id` and used for commission/reporting.

## Verification

- **Case F:** Admin creates a sale, selects a salesman (e.g. arslan), saves → sale appears in Reports → Commission when filtering by that salesman; sale detail shows Created By = admin and Salesman = arslan.
- **Case G:** Sale detail shows “Created By” and “Salesman (commission/report)” separately.

## Rollback

- Revert the ViewSaleDetailsDrawer label from “Salesman (commission/report)” back to “Salesman” if desired.
