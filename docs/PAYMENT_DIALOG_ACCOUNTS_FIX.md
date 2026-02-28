# Payment dialog: accounts not showing (Select Account empty)

## Cause
Non-admin users see no accounts in **Add Payment → Select Account** because RLS on `accounts` only allows rows that the user is allowed to see. If the policy does not include **user_account_access** for `auth.uid()`, only default codes 1000/1010/1020 (or nothing) are visible.

## Fix on hosted DB (supabase.dincouture.pk)

**Run the accounts RLS migration on the project that the app uses** (e.g. Supabase Dashboard → SQL Editor):

1. Open **Supabase Dashboard** for the project (e.g. supabase.dincouture.pk or your project URL).
2. Go to **SQL Editor**.
3. Run the contents of:
   - `migrations/accounts_rls_allow_user_account_access.sql`

That script replaces the `accounts_select_enterprise` policy so that non-admin users can see:
- Default payment accounts (code 1000, 1010, 1020), and
- **Any account in `user_account_access` for the logged-in user** (`user_id = auth.uid()`).

## Ensure user_account_access uses auth user id

Account access is stored in `user_account_access` with `user_id` = **auth.users(id)** (not public.users id). When an admin assigns accounts in **Edit User → Account Access**, the app calls `set_user_account_access(p_user_id, ...)` with the user’s **auth_user_id**. If your DB still has `user_account_access.user_id` pointing at `public.users(id)`, non-admin users will get no accounts.

To align with the identity model (user_id = auth.users id):

1. Run (once) the identity/backfill parts if needed:
   - `migrations/identity_model_auth_user_id.sql`  
   (sections for `user_account_access`: backfill `user_id` from `auth_user_id`, then FK to `auth.users`).

Or run the smaller fix that only touches `user_account_access`:
   - `migrations/fix_user_account_access_fk_to_auth_users.sql`

After that, when an admin **saves** **Edit User → Account Access**, the RPC will write `user_id = auth.users(id)`, and the accounts policy above will let those accounts show in the payment dialog.

## App-side changes (already in code)

- Payment dialog **refreshes accounts** when opened (`refreshEntries()`).
- **Bank** method now includes accounts with code starting with `101` (e.g. 1010-Bank, 1011-NDM); **Wallet** includes `102x`.
- **Branch filter**: global accounts or current branch (or all branches when branch is "all").
- If no accounts are loaded, a message tells the user to check account access and RLS migration.

## Accounts Receivable (1100) not found when recording payment

If payment fails with **"Accounts Receivable account (1100 or 2000) not found"** even though the Chart of Accounts has code 1100, the trigger function runs in the **caller’s context**, so RLS can hide the 1100 account from non-admin users.

**Fix:** Make `create_payment_journal_entry` **SECURITY DEFINER** (and `SET search_path = public`) so it runs with the function owner’s privileges and can always see the A/R account. Applied in:
- `migrations/ensure_ar_1100_and_fix_payment_journal.sql` (run on VPS; also ensures 1100 exists for companies with 1000).
- `migrations/fix_payment_journal_ar_account_code.sql` (same function with SECURITY DEFINER for future runs).

**Already applied on VPS:** The SECURITY DEFINER version was run via SSH so payment recording should work now. If you use another host, run `ensure_ar_1100_and_fix_payment_journal.sql` there.

## Payment insert 403 (RLS on `payments`)

If recording a payment fails with **"new row violates row-level security policy for table 'payments'"**, the `payments` table has RLS enabled but no (or wrong) INSERT policy. Run on the hosted project:

- **`migrations/payments_rls_allow_insert.sql`**

This adds SELECT/INSERT/UPDATE/DELETE policies so authenticated users can manage payments for their company and for branches they have access to (`has_branch_access(branch_id)`). Requires `get_user_company_id()` and `has_branch_access(uuid)` to exist (from `enterprise_defaults_and_rls_isolation.sql` or `identity_model_auth_user_id.sql`).

## Checklist

- [ ] Run `accounts_rls_allow_user_account_access.sql` on the **hosted** Supabase project.
- [ ] Run `payments_rls_allow_insert.sql` on the **hosted** project if you get 403 when recording payments.
- [ ] If account access was saved before the identity migration, run `identity_model_auth_user_id.sql` or `fix_user_account_access_fk_to_auth_users.sql` so `user_account_access.user_id` = auth users id.
- [ ] Have an admin **re-save** the user’s account access (Edit User → Account Access → Update User) so rows use `auth_user_id`.
- [ ] Log in as that user, open Add Payment, and confirm accounts appear after the dialog loads.
