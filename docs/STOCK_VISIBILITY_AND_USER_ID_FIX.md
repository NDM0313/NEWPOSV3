# Stock Visibility & User ID Fix

## Root cause summary

### Problem 1 — User code not generating
- **Cause:** The User Management table shows **CODE** (e.g. USR-001). Many users had blank codes because:
  - New users created via the **Edge Function** `create-erp-user` do not set `user_code` or `code` on the profile insert.
  - Legacy `createUser` in `userService` did set `user_code` via `generateUserCode()`, but that path is only used when the Edge Function is unavailable.
  - No database trigger ensured a code on INSERT, so any insert without an explicit code left it NULL.
- **Fix:** Added `generate_user_code(company_id)` and a **BEFORE INSERT** trigger on `public.users` so that when `code`/`user_code` is NULL, the trigger sets both to the next USR-XXX for that company. Backfill gives existing users codes.

### Problem 2 — Stock exists in DB but not visible to some users
- **Cause:** Stock is stored in **stock_movements** (and mirrored in **inventory_balance**). If RLS was enabled on these tables without branch-aware policies, or with overly strict policies, non-admin users could be blocked from seeing rows for branches they should see. Alternatively, RLS was missing and all rows were visible; the more likely issue was **missing or wrong RLS**: once RLS is enabled, default deny applies, so without explicit “admin all, non-admin by branch” policies, some users see no stock.
- **Fix:** Added branch-based RLS on **stock_movements** and **inventory_balance**: **admin** sees all company rows; **non-admin** sees only rows where `branch_id` is in `user_branches` (for `auth.uid()`) or `branch_id IS NULL`. Stock query logic already passes `branchId` (or `null` for “all”); with RLS, non-admins only get data they are allowed to see.

---

## What changed

### PHASE A — User code auto-generation

| Item | Detail |
|------|--------|
| **Migration** | `migrations/add_user_code_autogenerate.sql` |
| **Columns** | `user_code` and `code` added on `public.users` if missing. Both kept in sync. |
| **Function** | `generate_user_code(p_company_id UUID)` returns next `USR-XXX` per company (max of existing code numbers + 1). |
| **Trigger** | `trigger_set_user_code_on_insert` BEFORE INSERT: if `code`/`user_code` is NULL/empty, sets both via `generate_user_code(NEW.company_id)`. |
| **Backfill** | Existing users with NULL/empty code get backfilled with `USR-001`, `USR-002`, … per company (ordered by `created_at`, `id`). |
| **Constraint** | `users_company_code_unique` UNIQUE (`company_id`, `code`) added if possible (skipped if duplicates exist). |

- **Edge Function:** No change. Profile insert still does not send `code`; the trigger sets it on INSERT.
- **Frontend:** Continues to show `user_code` (or `code`) in the User Management table; after migration and backfill, all users have a code.

### PHASE B & C — Stock visibility and query logic

| Item | Detail |
|------|--------|
| **Storage** | Stock = **stock_movements** (source of truth); **inventory_balance** is a snapshot updated by trigger. |
| **Migration** | `migrations/stock_movements_rls_branch_based.sql` |
| **RLS** | **stock_movements**: SELECT/INSERT/UPDATE allowed only if `company_id = get_user_company_id()` and (admin OR `branch_id` in `user_branches` for `auth.uid()` OR `branch_id IS NULL`). Same idea for **inventory_balance** (SELECT/INSERT/UPDATE). |
| **Query logic** | No change needed: `inventoryService.getInventoryOverview(companyId, branchId)` already filters by `branchId` when provided; when `branchId` is `null` or `'all'`, it does not filter by branch. RLS now enforces that non-admins only see movements/balances for their branches. Admin sees all (company-scoped). |
| **Frontend** | Inventory dashboard already passes `branchId === 'all' ? null : branchId`; with RLS, non-admin users only receive data for branches they have in `user_branches`. |

### PHASE D — Negative stock setting and validation

| Item | Detail |
|------|--------|
| **Setting** | Stored in **settings**: key `inventory_settings` (object with `negativeStockAllowed`) or legacy key `allow_negative_stock`. |
| **settingsService** | `getAllowNegativeStock(companyId)` returns `inventory_settings.negativeStockAllowed` or `allow_negative_stock` value. |
| **Backend validation** | In **saleService.createSale**, when `status === 'final'` and there are items: if `!getAllowNegativeStock(company_id)`, for each item we fetch stock at `sale.branch_id` via `productService.getStockMovements(..., branchId)` and `calculateStockFromMovements`. If `item.quantity > currentBalance`, throw: *"Insufficient stock: … requested X, available Y. Enable Negative Stock Allowed in Settings → Inventory to allow."* |
| **Frontend** | SalesContext already checks `inventorySettings.negativeStockAllowed` before create; backend check ensures API/other clients cannot bypass. |

### PHASE E — Sale created_by vs stock

- **Sales:** `created_by` = `auth.uid()` (identity). Used for “who created” and for RLS (e.g. salesman sees own sales). Stock visibility is **not** tied to `created_by`.
- **Stock movements:** Rows have `branch_id`, `product_id`, `quantity`; `created_by` is audit-only. Stock is **company + branch** based; user only affects `created_by`.
- No code change: existing design is correct.

---

## Files changed

| File | Change |
|------|--------|
| `migrations/add_user_code_autogenerate.sql` | **New.** User code column(s), `generate_user_code()`, trigger, backfill, unique constraint. |
| `migrations/stock_movements_rls_branch_based.sql` | **New.** RLS on `stock_movements` and `inventory_balance` (admin all, non-admin by branch). |
| `src/app/services/settingsService.ts` | Added `getAllowNegativeStock(companyId)`. |
| `src/app/services/saleService.ts` | Pre-insert validation in `createSale`: when status is final and negative stock not allowed, check stock per item (branch) and throw if insufficient. Imports: `settingsService`, `productService`, `calculateStockFromMovements`. |
| `docs/STOCK_VISIBILITY_AND_USER_ID_FIX.md` | This document. |

---

## SQL verification queries

Run in Supabase SQL Editor (as postgres or role with access).

**A1) User code trigger and function**
```sql
SELECT proname, prosrc IS NOT NULL
FROM pg_proc
WHERE proname IN ('generate_user_code', 'set_user_code_on_insert');

SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'trigger_set_user_code_on_insert';
```

**A2) Users with code after backfill**
```sql
SELECT id, email, full_name, code, user_code, company_id
FROM public.users
ORDER BY company_id, code
LIMIT 20;
```

**B1) Stock storage (sample)**
```sql
SELECT product_id, branch_id, quantity, movement_type, reference_type
FROM public.stock_movements
ORDER BY created_at DESC
LIMIT 20;
```

**B2) RLS on stock_movements and inventory_balance**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('stock_movements', 'inventory_balance');
```

**C) Negative stock setting**
```sql
SELECT company_id, key, value
FROM public.settings
WHERE key IN ('inventory_settings', 'allow_negative_stock');
```

---

## How to use

### User code
- **New users:** Add User (including via Edge Function). On INSERT, trigger sets `code` and `user_code` to next USR-XXX for that company. No manual step.
- **Existing users:** Run migration once; backfill assigns USR-001, USR-002, … per company. User Management table shows code for everyone.

### Stock visibility
- **Admin:** Can keep branch = “All”; sees all company stock (RLS allows).
- **Non-admin:** Should select a branch they are assigned to (or use default). They only see stock for branches in `user_branches`; RLS enforces this.

### Negative stock
- **Settings → Inventory:** Toggle “Negative Stock Allowed” (stored in `inventory_settings.negativeStockAllowed` or `allow_negative_stock`).
- **When OFF:** Creating a final sale (or any path that calls `saleService.createSale` with `status === 'final'`) checks stock per item at sale branch; if any item quantity > available stock, backend throws “Insufficient stock” and suggests enabling the setting.
- **When ON:** Sales can proceed even if stock goes negative.

---

## Test results (PHASE F)

| Test | Expected | Notes |
|------|----------|--------|
| **F1) Admin login** | Sees full stock; can sell any branch; negative stock behavior follows setting. | Admin bypasses branch restriction in RLS; setting read from DB. |
| **F2) Salesman login** | Sees only assigned branch stock; cannot see other branches; cannot complete sale if stock insufficient (unless negative allowed). | RLS limits `stock_movements`/`inventory_balance` to branches in `user_branches`; `createSale` validates stock when negative not allowed. |
| **F3) After sale** | `quantity` in `inventory_balance` (or sum of `stock_movements`) for that product/branch decreases. | Unchanged; movements and trigger already decrease stock. |

Manual checks:
- Insert user (e.g. via Edge Function or UI): confirm `code`/`user_code` is set (e.g. USR-003).
- As non-admin, open Inventory: only assigned branch(es) data.
- As admin, open Inventory with “All” branches: all company stock.
- With “Negative Stock Allowed” OFF, create a final sale with qty > available stock: backend must throw “Insufficient stock”.

---

## Notes

- **Identity:** Use `auth.uid()` for identity; `user_branches.user_id` = `auth.users(id)`. Do not use `public.users.id` for stock or branch logic.
- **Backfill:** If you already have duplicate or non-USR-XXX codes, the unique constraint `users_company_code_unique` may be skipped; trigger still applies to new inserts.
- **RLS and triggers:** `inventory_balance` is updated by a trigger on `stock_movements`. Trigger runs in the same session; RLS applies to the inserting user. User must have access to the branch they are writing in `stock_movements`.
