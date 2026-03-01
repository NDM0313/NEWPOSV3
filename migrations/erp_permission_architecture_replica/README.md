# ERP Permission Architecture — Replica

This folder is a **replica** of the Create ERP Permission Architecture used by the app. Use it to fix the error:

**"Could not find the table 'public.role_permissions' in the schema cache"**

## What it does

- Creates `public.role_permissions` (role, module, action, allowed).
- Ensures helper functions `get_user_role()` and `get_user_company_id()` exist (safe if already present).
- Enables RLS on `role_permissions` (only admin/owner can modify; all authenticated can read).
- Seeds permissions for roles: **owner**, **admin**, **manager**, **user**.

## How to run

1. Open your **Supabase** project → **SQL Editor**.
2. Copy the contents of `01_role_permissions_table_and_seed.sql`.
3. Run the script.
4. In the app, refresh the page or reopen **Settings → Permission Management** (and **User Permissions** if V2 is on). The schema cache will pick up the new table.

## Dependencies

- Table `public.users` with columns: `id`, `auth_user_id`, `role`, `company_id`.  
  If your project already has the main app migrations, this is already there.

## Full architecture (optional)

For the full permission engine (RLS on sales, payments, ledger, etc. using `has_permission()`), run in this order from the main `migrations/` folder:

1. `erp_permission_architecture_global.sql`
2. `identity_model_auth_user_id.sql` (and `auth_user_id_functions.sql` if you use auth_user_id)
3. `erp_permission_engine_v1.sql`

This replica is a **minimal subset** so the Permission Management and User Permissions UI work without running the full engine.
