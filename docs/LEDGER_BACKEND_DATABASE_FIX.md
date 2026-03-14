# User Ledger – Backend & Database Fix

## Backend ↔ Database flow

| Layer | What it does |
|-------|----------------|
| **UI** | Accounting → User Ledger → `GenericLedgerView` (date range + entity) |
| **Adapter** | `getUserLedgerData(companyId, userId, …)` in `ledgerDataAdapters.ts` |
| **Service** | `getOrCreateLedger(companyId, 'user', userId, name)` then `getLedgerEntries(ledgerId, from, to)` in `ledgerService.ts` |
| **Supabase** | Tables: `ledger_master` (one row per user/supplier), `ledger_entries` (debit/credit rows) |

- **Read:** `ledger_master` SELECT → get/create ledger → `ledger_entries` SELECT by `ledger_id` + date.
- **Write (commission post):** `commissionReportService.postCommissionBatch()` → `getOrCreateLedger()` then `addLedgerEntry()` → INSERT into `ledger_master` (if new) and `ledger_entries`.

## Problem

- **`ledger_master`** had only a **SELECT** RLS policy. There was **no INSERT (or UPDATE) policy**.
- So when the app tried to create a new User Ledger (first time for a salesman), the INSERT was **blocked by RLS** and `getOrCreateLedger()` returned `null`. No ledger → no entries → nothing showed in User Ledger.
- `ledger_entries` already had a FOR ALL policy (SELECT + INSERT + UPDATE + DELETE) in `enterprise_defaults_and_rls_isolation.sql`, so inserts there were allowed once a ledger existed.

## Fix (RLS)

Migration **`migrations/ledger_master_ledger_entries_rls_insert_update.sql`** adds:

- **`ledger_master_insert_enterprise`** – INSERT allowed when `company_id = get_user_company_id()` and `get_user_role() IN ('admin','manager','accountant')`.
- **`ledger_master_update_enterprise`** – UPDATE with same conditions (e.g. for `opening_balance` / `updated_at`).

Same role rules as `ledger_entries`, so commission post and User Ledger stay consistent.

## Run in Supabase

1. **Apply the fix**  
   In Supabase Dashboard → **SQL Editor**, run the contents of:
   - **`migrations/ledger_master_ledger_entries_rls_insert_update.sql`**

2. **Verify**  
   In SQL Editor, run:
   - **`scripts/supabase_ledger_verify.sql`**  
   You should see:
   - `ledger_master` and `ledger_entries` exist, RLS on.
   - Policies on `ledger_master` include at least SELECT + INSERT (and UPDATE if you applied the migration).
   - Policies on `ledger_entries` include SELECT and INSERT (or FOR ALL).
   - `get_user_company_id()` and `get_user_role()` return your company and role when run while logged in (e.g. via a small API that runs this as the app user, or from a test that uses the app’s JWT).

After this, posting a new commission batch should create/use `ledger_master` and insert rows into `ledger_entries`, and they should show in User Ledger for the correct salesman and date range.
