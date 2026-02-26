# Sales & Products RLS — Test Scenarios

After applying `migrations/sales_products_rls_role_based.sql`, verify access isolation.

---

## Prerequisites

- Migration applied on VPS
- Test users: Admin, Manager, Salesman (each with `auth_user_id` linked)
- Manager must have `user_branches` row with `is_default = true`
- Sales with `company_id`, `branch_id`, `created_by` populated

---

## Test 1: Admin Login

**Expected:** Sees all sales in the company.

1. Log in as admin (e.g. admin@dincouture.pk).
2. Go to Sales list.
3. Verify: All sales for the company are visible (all branches, all creators).
4. Create a new sale → should succeed.
5. Edit/delete any sale → should succeed.

**SQL check (as admin JWT):**
```sql
SELECT COUNT(*) FROM sales WHERE company_id = get_user_company_id();
-- Should match total company sales.
```

---

## Test 2: Manager Login

**Expected:** Sees only sales from their branch.

1. Log in as manager.
2. Ensure manager has `user_branches` with `branch_id = X` and `is_default = true`.
3. Go to Sales list.
4. Verify: Only sales where `branch_id = X` are visible.
5. Create sale for branch X → should succeed.
6. Try to view sale from another branch → should not appear.

**SQL check:**
```sql
SELECT get_user_branch_id() AS my_branch;
SELECT COUNT(*) FROM sales WHERE company_id = get_user_company_id() AND branch_id = get_user_branch_id();
-- Should match visible sales.
```

---

## Test 3: Salesman Login

**Expected:** Sees only sales created by themselves.

1. Log in as salesman.
2. Go to Sales list.
3. Verify: Only sales where `created_by = auth.uid()` are visible.
4. Create a new sale → trigger sets `created_by = auth.uid()` → should succeed.
5. Try to view sale created by another user → should not appear.
6. Try to edit/delete another user's sale → should fail (row not visible).

**SQL check:**
```sql
SELECT COUNT(*) FROM sales WHERE company_id = get_user_company_id() AND created_by = auth.uid();
-- Should match visible sales.
```

---

## Test 4: Products (All Roles)

**Expected:** All users in the same company see all products.

1. Log in as admin → see all company products.
2. Log in as manager → see all company products.
3. Log in as salesman → see all company products.
4. No restriction by creator.

---

## Test 5: Insert Restriction (Salesman)

**Expected:** Salesman cannot insert sales for another user.

1. Log in as salesman.
2. Create sale via UI → succeeds (trigger sets `created_by = auth.uid()`).
3. Attempt to insert via API with `created_by = <other-user-uuid>` → should fail (RLS WITH CHECK).

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Manager sees no sales | `get_user_branch_id()` returns NULL → ensure `user_branches` has row with `is_default = true` |
| Salesman sees no sales | `created_by` may reference `users.id` not `auth.uid()` → ensure trigger sets `auth.uid()` |
| Products empty | `get_user_company_id()` NULL → user not in `public.users` or `auth_user_id` not linked |
| RLS blocks service role | Service role bypasses RLS; only anon/authenticated are restricted |
