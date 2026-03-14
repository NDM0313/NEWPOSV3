# ERP Self-Created Salesman Sales in Commission Report

## Requirement

When a salesman creates their own sale, that sale must automatically be attributed to them for commission and appear in the commission report.

## Root cause

The SaleForm auto-assign logic matched the current user to the salesmen list only by **name** (email, full_name). If the list used a different display name or the match failed, the salesman field stayed "No Salesman" and the sale was saved without `salesman_id`, so it did not appear in the commission report for that user.

## Fix

**File: `src/app/components/sales/SaleForm.tsx`**

1. **Match by user id first**  
   In the effect that auto-assigns the salesman for non-admin users, we now try to find the current user in the salesmen list by **id** first: `salesmen.find(s => s.id === (user as any).id)`. The app user from `useSupabase()` has `id` equal to `users.id`, which is the same id used in the salesmen list (from `userService.getSalesmen`).

2. **Fallback to name**  
   If no match by id, we still try the previous name-based match (email, user_metadata.full_name, user_metadata.name).

3. **Dependency on salesmen**  
   The effect now depends on `salesmen` so that when the salesmen list is loaded, it runs again and can set `salesmanId` to the current user’s id when they are in the list.

4. **Trigger when "No Salesman"**  
   Auto-assign runs when `salesmanId === "1"` or `salesmanId === "none"`, so the first time the form loads for a salesman user, they get themselves as the selected salesman.

## Behavior

- When a **non-admin** user (who is in the salesmen list) opens the sale form for a **new** sale, the Salesperson field is set to themselves.
- The sale is saved with `salesman_id` = that user’s id and commission fields as entered (or default from their profile if configured).
- Such sales appear in Reports → Commission when filtering by that salesman or "All salesmen".

## Verification

1. Log in as a user who can be assigned as salesman (e.g. arslan).
2. Create a new sale (do not change the Salesperson field).
3. Save as final.
4. Open Reports → Commission, filter by that salesman (or All salesmen) and Include due sales → the new sale should appear.

## Rollback

Revert the SaleForm effect to the previous version that only matched by name and did not include `salesmen` in the dependency array.
