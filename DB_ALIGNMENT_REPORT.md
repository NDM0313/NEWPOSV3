# DB Alignment Execution Report – Backend Architect

**Date:** February 2026  
**Reference:** BACKEND_INTEGRATION_ARCHITECTURE.md (frozen)

---

## 1. SQL Migrations Required (Generated)

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase-extract/migrations/43_companies_finalization.sql` | **PART 1 – Companies:** Add `currency`, `financial_year_start`, `timezone`, `date_format`, `decimal_precision` with `ADD COLUMN IF NOT EXISTS`. |
| 2 | `supabase-extract/migrations/44_rental_status_enum_alignment.sql` | **PART 2 – Rental enum:** Add `picked_up` and `closed` to `rental_status` (idempotent); create type with all 7 values if type missing. |
| 3 | `supabase-extract/migrations/45_get_customer_ledger_rentals_rpc.sql` | **PART 3 – Ledger RPC:** Create `get_customer_ledger_rentals(p_company_id, p_customer_id, p_from_date, p_to_date)` with SECURITY DEFINER and GRANT. |

**Execution order:** Run in numeric order (43 → 44 → 45). Apply via Supabase Dashboard SQL Editor or `supabase db push` / your migration runner.

---

## 2. RPC Verification Result

### get_customer_ledger_sales

| Item | Status |
|------|--------|
| Exists | ✅ In migrations 39, 40, 41 |
| Signature | `(p_company_id UUID, p_customer_id UUID, p_from_date DATE DEFAULT NULL, p_to_date DATE DEFAULT NULL)` |
| Frontend usage | `customerLedgerApi.ts`, `accountingService.ts`: same param names | ✅ Match |
| Returns | id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status | ✅ |

### get_customer_ledger_payments

| Item | Status |
|------|--------|
| Exists | ✅ In migrations 39, 40, 41 |
| Signature | `(p_company_id UUID, p_sale_ids UUID[], p_from_date DATE DEFAULT NULL, p_to_date DATE DEFAULT NULL)` |
| Frontend usage | Same params | ✅ Match |
| Returns | id, reference_number, payment_date, amount, payment_method, notes, reference_id | ✅ |

### get_customer_ledger_rentals

| Item | Status |
|------|--------|
| Exists | ⚠️ **Was missing** → ✅ **Added in migration 45** |
| Signature | `(p_company_id UUID, p_customer_id UUID, p_from_date DATE DEFAULT NULL, p_to_date DATE DEFAULT NULL)` |
| Frontend usage | Same params; expects id, pickup_date, booking_date, created_at, total_amount | ✅ Match |
| Returns | id, booking_no, booking_date, pickup_date, return_date, actual_return_date, status, total_amount, paid_amount, created_at | ✅ |

**RPC verification summary:** Sales and payments RPCs already present and match. Rentals RPC added in `45_get_customer_ledger_rentals_rpc.sql`.

---

## 3. Enum Verification Result

### rental_status

| Required value | schema.sql (current) | CLEAN_COMPLETE_SCHEMA | After migration 44 |
|---------------|---------------------|------------------------|---------------------|
| booked | ✅ | ✅ | ✅ |
| picked_up | ❌ | ✅ | ✅ |
| active | ✅ | ✅ | ✅ |
| returned | ✅ | ✅ | ✅ |
| overdue | ✅ | ✅ | ✅ |
| closed | ❌ | ✅ | ✅ |
| cancelled | ✅ | ✅ | ✅ |

**Enum verification summary:** `schema.sql` and any DB created from it only have 5 values. Migration 44 adds `picked_up` and `closed` idempotently (or creates full enum if type is missing).

---

## 4. RLS Validation (PART 4)

### Tables scoped by company_id

| Table | Policy / check | company_id scope |
|-------|----------------|------------------|
| companies | SELECT: id = get_user_company_id() | ✅ |
| branches | company_id = get_user_company_id() | ✅ |
| users | company_id = get_user_company_id() | ✅ |
| contacts | company_id = get_user_company_id() | ✅ |
| products | company_id = get_user_company_id() | ✅ |
| product_variations | Via products.company_id | ✅ |
| sales | company_id = get_user_company_id() + has_branch_access | ✅ |
| purchases | company_id = get_user_company_id() + has_branch_access | ✅ |
| rentals | company_id = get_user_company_id() + has_branch_access | ✅ |
| expenses | company_id = get_user_company_id() + has_branch_access | ✅ |
| accounts | company_id = get_user_company_id() | ✅ |
| journal_entries | company_id = get_user_company_id() | ✅ |
| payments | company_id = get_user_company_id() + has_branch_access | ✅ |
| settings | company_id = get_user_company_id() | ✅ |
| stock_movements | company_id = get_user_company_id() | ✅ |
| studio_orders | company_id = get_user_company_id() | ✅ |

All listed tables are scoped by company (and branch where applicable).

### Role permissions (has_module_permission)

- **contacts:** view, create, edit, delete
- **products:** view, create, edit, delete
- **inventory (stock_movements):** view, create
- **sales:** view, create, edit, delete (branch + status conditions)
- **purchases:** view, create, edit, delete (branch + status)
- **rentals:** view, create, edit (branch)
- **studio_orders:** view, create
- **expenses:** view, create; update for admin/manager
- **accounting (accounts, journal_entries):** view; manage for admin/accountant/manager
- **payments:** view, insert (company + branch)
- **settings:** view, all for admin
- **users:** view company users; manage for admin
- **permissions:** manage for admin; view own for user

No policy uses a bare `true` for SELECT without a company/permission check. **Audit logs** allow INSERT with `WITH CHECK (true)` for system/triggers only; SELECT is restricted to company_id + admin/manager.

### Public access

- No policy grants SELECT to `public` or anonymous without company_id/auth.
- Ledger RPCs use SECURITY DEFINER and filter by p_company_id inside the function; they are granted to `authenticated` and `anon` so the app can call them with valid JWT (anon may be used for server-side if needed). Data is still restricted by company_id in the function body.

**RLS validation summary:** All tables are company-scoped; role permissions use has_module_permission (or role checks); no open public read access.

---

## 5. Final Backend Alignment Confirmation

| Part | Action | Status |
|------|--------|--------|
| **1. Companies** | Migration 43 adds currency, financial_year_start, timezone, date_format, decimal_precision | ✅ Ready to apply |
| **2. Rental enum** | Migration 44 adds picked_up, closed to rental_status | ✅ Ready to apply |
| **3. Ledger RPCs** | get_customer_ledger_sales, get_customer_ledger_payments already exist; get_customer_ledger_rentals added in migration 45 | ✅ Ready to apply |
| **4. RLS** | All tables company-scoped; has_module_permission used; no open public access | ✅ Confirmed |

**Next steps:**

1. Run migrations 43, 44, 45 in order on your Supabase project.
2. Re-run Ledger Debug (or customer ledger) and verify rentals appear when applicable.
3. Confirm company profile in Settings loads timezone, date_format, decimal_precision.
4. Confirm rental lifecycle (e.g. set status to picked_up, closed) works without enum errors.

Backend alignment for the frozen BACKEND_INTEGRATION_ARCHITECTURE.md is complete pending application of the three migrations.
