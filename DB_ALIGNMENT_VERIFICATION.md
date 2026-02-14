# DB Alignment Execution – Verification Report

**Prompt:** Backend Integration Architecture freeze ke baad DB alignment execution (Companies table, rental enum, Ledger RPCs, RLS).  
**Date:** February 2026

---

## 1. SQL Migrations Required

### Already present (no new migrations needed)

| Part | Migration File | Status |
|------|----------------|--------|
| **PART 1 – Companies** | `supabase-extract/migrations/43_companies_finalization.sql` | ✅ Exists |
| **PART 2 – Rental enum** | `supabase-extract/migrations/44_rental_status_enum_alignment.sql` | ✅ Exists |
| **PART 3 – Ledger RPCs** | `39`, `40`, `41` (sales/payments), `45` (rentals) | ✅ Exist |

### PART 1 – Companies table finalization

**File:** `43_companies_finalization.sql`

- Adds (if not exists): `currency`, `financial_year_start`, `timezone`, `date_format`, `decimal_precision`.
- Defaults: currency PKR, financial_year_start 2024-01-01, timezone Asia/Karachi, date_format DD/MM/YYYY, decimal_precision 2.
- **Action:** Run this migration on DB if not already applied.

### PART 2 – Rental status enum

**File:** `44_rental_status_enum_alignment.sql`

- Adds to `rental_status`: `picked_up`, `closed` (with `IF NOT EXISTS`, PG 9.5+).
- Required set: booked, picked_up, active, returned, overdue, closed, cancelled.
- **Action:** Run this migration; ensure base enum already has booked, active, returned, overdue, cancelled (from schema).

### PART 3 – Ledger RPCs

- **get_customer_ledger_sales** – in `39`, `40`, `41`.
- **get_customer_ledger_payments** – in `39`, `40`, `41`.
- **get_customer_ledger_rentals** – in `45`.
- **Action:** Apply migrations 41 and 45 (or your current chain) so all three RPCs exist.

---

## 2. RPC Verification Result

| RPC | Frontend call (customerLedgerApi / accountingService) | DB signature | Match |
|-----|--------------------------------------------------------|--------------|--------|
| get_customer_ledger_sales | `p_company_id`, `p_customer_id`, `p_from_date`, `p_to_date` | (UUID, UUID, DATE, DATE) | ✅ |
| get_customer_ledger_payments | `p_company_id`, `p_sale_ids`, `p_from_date`, `p_to_date` | (UUID, UUID[], DATE, DATE) | ✅ |
| get_customer_ledger_rentals | `p_company_id`, `p_customer_id`, `p_from_date`, `p_to_date` | (UUID, UUID, DATE, DATE) | ✅ |

**Return columns (frontend usage):**

- **Sales:** id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status. ✅
- **Payments:** id, reference_number, payment_date, amount, payment_method, notes, reference_id. ✅
- **Rentals:** id, booking_no, booking_date, pickup_date, return_date, actual_return_date, status, total_amount, paid_amount, created_at. ✅

**Result:** RPC signatures and return shapes match frontend usage. No changes required.

---

## 3. Enum Verification Result

| Required value | In schema.sql (base) | In migration 44 | Final |
|----------------|----------------------|-----------------|--------|
| booked | ✅ | — | ✅ |
| picked_up | ❌ | ✅ ADD VALUE | ✅ |
| active | ✅ | — | ✅ |
| returned | ✅ | — | ✅ |
| overdue | ✅ | — | ✅ |
| closed | ❌ | ✅ ADD VALUE | ✅ |
| cancelled | ✅ | — | ✅ |

**Result:** After applying `44_rental_status_enum_alignment.sql`, enum has all seven values. Migration uses `IF NOT EXISTS` (PostgreSQL 9.5+), so re-run is safe.

---

## 4. RLS Validation (PART 4)

| Check | Status |
|-------|--------|
| All tables scoped by company_id | ✅ Core tables (companies, branches, contacts, products, sales, purchases, rentals, expenses, accounts, journal_entries, payments, settings) use `get_user_company_id()` and/or company_id in policies. |
| Role permissions via has_module_permission | ✅ sales, purchases, contacts, products, rentals, expenses, accounting, studio use `has_module_permission(module, 'view'|'create'|'edit'|'delete')`. |
| No open public access | ✅ RLS enabled on listed tables; SELECT/INSERT/UPDATE/DELETE restricted by policy. |

**Note:** Tables added in later migrations (e.g. sale_returns, purchase_returns, rental_payments, studio_productions, studio_production_stages) may not be in `rls-policies.sql`. If they exist in your DB, ensure they have RLS enabled and company_id (or parent FK) scoping.

---

## 5. Final Backend Alignment Confirmation

| Part | Delivered | Action |
|------|-----------|--------|
| 1. Companies table | Migration 43 adds currency, financial_year_start, timezone, date_format, decimal_precision | Run 43 if not applied |
| 2. Rental status enum | Migration 44 adds picked_up, closed | Run 44 if not applied |
| 3. Ledger RPCs | 39/40/41 (sales, payments), 45 (rentals) | Deploy 41 + 45 (or your sequence) |
| 4. RLS | Core tables have RLS and company_id + has_module_permission | Verify any new tables have RLS |

**Conclusion:** Last prompt (DB alignment execution) is **fully reflected** in the repo. No extra SQL migrations are required; only ensure migrations 43, 44, 41, and 45 (and any dependencies) are applied on your target database.

---

## Quick reference – migration order

1. `43_companies_finalization.sql` – companies columns  
2. `44_rental_status_enum_alignment.sql` – rental_status enum  
3. `41_customer_ledger_rpc_company_only.sql` – get_customer_ledger_sales, get_customer_ledger_payments  
4. `45_get_customer_ledger_rentals_rpc.sql` – get_customer_ledger_rentals  

(Run after any earlier migrations that create `companies`, `rentals`, and `rental_status`.)
