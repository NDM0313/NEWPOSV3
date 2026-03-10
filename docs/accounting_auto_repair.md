# Accounting Auto-Repair

This document describes how the ERP accounting system ensures required Chart of Accounts and how repairs are executed automatically (no manual SQL required).

---

## Required ERP Accounts

| Code | Name                 | Type     | Use |
|------|----------------------|----------|-----|
| 2000 | Accounts Receivable  | Asset    | Dr on sale finalization |
| 4000 | Sales Revenue        | Revenue  | Cr on sale finalization |
| 5000 | Cost of Production   | Expense  | Dr on studio stage completion |
| 2010 | Worker Payable      | Liability| Cr on studio stage completion |

The Studio Costs dashboard reads from **journal_entry_lines** for accounts **5000** (Cost of Production) and **2010** (Worker Payable). If these accounts are missing, the dashboard shows no data.

---

## Automatic Account Creation

### 1. Migrations (run on deploy / `npm run migrate`)

- **`migrations/accounting_ensure_default_accounts.sql`**  
  Defines `ensure_erp_accounts(company_id)` and runs it for every company (from `accounts` and `companies`). Uses `INSERT ... ON CONFLICT (company_id, code) DO NOTHING`.

- **`migrations/accounting_ensure_erp_accounts_rpc.sql`**  
  Defines two RPCs:
  - **`ensure_erp_accounts_for_current_company()`** — ensures the four accounts for the **current user’s company**. Call from the app (e.g. Studio Costs tab “Create default accounts” button).
  - **`ensure_erp_accounts_all_companies()`** — ensures the four accounts for **every company**. Used by scripts or admin; idempotent.

Both RPCs are `SECURITY DEFINER` and use `ensure_erp_accounts` when it exists; otherwise they insert directly (without `balance` if the column is missing).

### 2. Script (run after migrations)

- **`scripts/ensure-accounting-accounts.js`**  
  Loads `.env.local`, creates a Supabase client with the anon key, and calls `ensure_erp_accounts_all_companies()`. No manual SQL.

**Usage**

Ensure migrations have been applied first (so the RPC exists), then run:

```bash
npm run ensure-accounting
```

Or run steps explicitly:

```bash
npm run migrate   # applies accounting_ensure_* migrations and creates the RPC
npm run ensure-accounting
```

The script uses the same Supabase project as the app (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). If those are not set, the script exits with code 0 and skips.

---

## RPC Usage

| RPC                               | When to use |
|-----------------------------------|-------------|
| `ensure_erp_accounts_for_current_company()` | From the app when the user is on Studio Costs and sees “no data” — e.g. “Create default accounts” button. |
| `ensure_erp_accounts_all_companies()`       | From a script, CI, or admin flow to repair all companies at once. |

Both return JSONB: `{ "ok": true, ... }` or `{ "ok": false, "error": "..." }`. The all-companies RPC also returns `companies_processed`.

---

## Studio Costs Accounting Flow

1. **Studio stage completion** → trigger creates a journal entry: Dr 5000 (Cost of Production), Cr 2010 (Worker Payable).
2. **Studio Costs dashboard** → `studioCostsService.getStudioCostsFromJournal()` reads `journal_entries` and `journal_entry_lines` for accounts 5000 and 2010.
3. **Summary cards** — Total Cost (5000 debits − credits), Outstanding (2010 credits − debits), Paid = Total Cost − Outstanding, worker breakdown from stage references.

If accounts 5000 or 2010 are missing, the service returns zeros and the UI can prompt the user to run “Create default accounts” (which calls `ensure_erp_accounts_for_current_company()`), or an admin can run `npm run ensure-accounting`.

---

## Verification

- After running migrations and the ensure script, check that every company has the four accounts:

  ```sql
  SELECT company_id, code, name FROM accounts
  WHERE code IN ('2000','4000','5000','2010') ORDER BY company_id, code;
  ```

- Studio Costs tab should show “Live from Journal Entries” when journal data exists and accounts 5000/2010 are present.
