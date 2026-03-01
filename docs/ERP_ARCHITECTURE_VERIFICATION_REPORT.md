# ERP Architecture Verification Report — Final

**Date:** Verification pass (no schema changes).  
**Scope:** Global Permission + Identity + Walk-in + Health Dashboard consistency.

---

## Section | Status | Notes

### Phase 1 — Walk-in Integrity Hard Check

| Check | Status | Notes |
|-------|--------|-------|
| Exactly one walk-in per company | **PASS** | `unique_walkin_per_company_strict` on `contacts(company_id) WHERE system_type = 'walking_customer'` (`migrations/walkin_strict_enforcement.sql`). |
| system_type = 'walking_customer' | **PASS** | Enforced in trigger, backfill, and contactService; health dashboard checks this. |
| code = 'CUS-0000' | **PASS** | CHECK `walkin_code_must_be_reserved` in `walkin_strict_enforcement.sql`; backfill in `contacts_global_customer_code_and_walkin.sql`. |
| Unique index enforced | **PASS** | Partial unique index prevents duplicate walk-in per company. |
| sales.customer_id → single walk-in | **PASS** | Backfill in `contacts_global_customer_code_and_walkin.sql`; ledger RPC uses `customer_id`; no branch-based walk-in. |
| Ledger uses same ID | **PASS** | `get_customer_ledger_sales` / `get_customer_ledger_payments` use `company_id` + `customer_id` only; walk-in is one contact per company. |
| No branch-based walk-in in code | **PASS** | `contactService.getWalkingCustomer(companyId)` is company-only; no branch filter. `customerLedgerApi` and docs state no created_by filter so walk-in included. |

---

### Phase 2 — Permission Architecture

| Check | Status | Notes |
|-------|--------|-------|
| Owner/Admin full company visibility | **PASS** | `erp_permission_architecture_global.sql`: `is_admin_or_owner()` → no branch filter, no created_by restriction on main tables. |
| No branch filter for admin | **PASS** | Sales, payments, journal_entries, contacts, rentals, stock_movements: admin/owner see by `company_id` + (branch in user_branches for non-admin). |
| No created_by restriction for admin | **PASS** | SELECT policies use `is_admin_or_owner()` OR branch/user conditions; admin path does not filter by created_by. |
| Ledger shows all sales regardless of creator | **PASS** | `get_customer_ledger_sales` filters by `company_id` and `customer_id` only (SECURITY DEFINER); no created_by. `ledger_master` RLS: `company_id = get_user_company_id()` only. |
| Normal user company-scoped, branch-restricted | **PASS** | Non-admin: `branch_id IS NULL OR EXISTS (user_branches WHERE user_id = auth.uid() AND branch_id = ...)`. |
| Ledger customer-based (not created_by-based) | **PASS** | Customer ledger RPCs use `p_company_id`, `p_customer_id` (and sale IDs for payments); no created_by. |

---

### Phase 3 — Identity Standard

| Check | Status | Notes |
|-------|--------|-------|
| created_by stores auth.users(id) | **PASS** | `user_accountability_global.sql`: trigger `set_created_by_from_auth()` sets `auth.uid()`. `backfill_created_by_auth_user_id.sql` backfills `public.users.id` → `auth_user_id`. |
| payments.received_by = auth.users(id) | **PASS** | `global_identity_and_received_by.sql`: column FK to `auth.users(id)`, backfill from `auth_user_id`. |
| activity_logs.performed_by = auth.users(id) | **PASS** | FK to `auth.users(id)`; backfill and null-out invalid; `log_activity` uses `auth.uid()`. |
| No public.users.id in FK for identity | **CAUTION** | Core tables (sales, payments, journal_entries, contacts) use auth.uid()/backfill. **Exception:** `studio_production_stages.created_by` and some studio/rental tables still reference `users(id)` (public) in older migrations; display joins use `auth_user_id` where applicable. |
| Joins use users.auth_user_id | **PASS** | Docs and backfill align display to `users.auth_user_id`; RLS uses `auth.uid()` and `user_branches.user_id = auth.uid()`. |

---

### Phase 4 — Document Sequence Integrity

| Check | Status | Notes |
|-------|--------|-------|
| Numbers via get_next_document_number_global() | **PARTIAL** | **Invoice/sales:** `documentNumberService.getNextDocumentNumberGlobal()` → RPC `get_next_document_number_global`. **Customer codes (CUS):** same RPC in contactService. **Payments (PAY):** same in saleService. |
| No frontend serial logic for invoice | **PASS** | SalesContext uses `getNextDocumentNumberGlobal`; no client-side increment for invoice. |
| Company-level only (global) | **PASS** | `document_sequences_global` and RPC are company-scoped (`p_company_id`). |
| Concurrent save safe | **PASS** | RPC does in-DB increment; safe for concurrent calls. |
| Other document types | **NOTE** | Branch code, rental, expense, studio job ref use `settingsService.getNextDocumentNumber()` (different path: document_sequences / settings). Not all flows use global RPC; intentional for branch-scoped numbering where applicable. |

---

### Phase 5 — Health Dashboard Integrity

| Check | Status | Notes |
|-------|--------|-------|
| get_erp_health_dashboard() SECURITY DEFINER | **PASS** | `create_erp_health_dashboard_view.sql`: function is SECURITY DEFINER. |
| Defensive (information_schema guarded) | **PASS** | Every component checks table/column existence before querying; no direct table access without guard. |
| Returns no rows for non-admin | **PASS** | `IF COALESCE(get_user_role()::text, '') NOT IN ('admin', 'owner') THEN RETURN;`. |
| Never crashes | **PASS** | No DO block; no temp tables; all paths return or RETURN QUERY; guards prevent missing-table errors. |
| Settings → System Health admin-only visible | **PASS** | Tab shown only when `userRole` is admin/owner (SettingsPage.tsx and SettingsPageNew.tsx). |
| PASS if no FAIL rows | **PASS** | Frontend computes OVERALL = FAIL if any row status === 'FAIL', else PASS. |
| Real-time DB driven | **PASS** | Data from RPC `get_erp_health_dashboard()` on load and Refresh. |

---

### Phase 6 — Deep Consistency Cross-Check

| Check | Status | Notes |
|-------|--------|-------|
| Sales total vs ledger total (customer level) | **VERIFY AT RUNTIME** | Ledger is customer-based; reconciliation requires live DB. Use `walkin_post_consolidation_audit.sql` STEP 8 (sales count per walk-in) vs ledger in app. |
| Payment total vs journal entries | **VERIFY AT RUNTIME** | No automated script in repo; run ad-hoc or add to health dashboard if needed. |
| Stock movement sum vs inventory_balance | **VERIFY AT RUNTIME** | No single script; health dashboard does not yet include this reconciliation. |
| No orphan FKs | **VERIFY AT RUNTIME** | Health dashboard checks: orphan users (auth_user_id NULL), orphan sales (customer_id not in contacts), sales created_by / payments received_by in auth.users. Run `npm run health` or apply `create_erp_health_dashboard_view.sql` and open System Health. |
| No missing auth linkage | **VERIFY AT RUNTIME** | Orphan Users component in health dashboard; validate-migration-state.sql does not check linkage count. |

**Recommendation:** Run `scripts/validate-migration-state.sql` and `scripts/erp_full_health_check.sql` (or Settings → System Health) against the target DB for Phase 6 data checks.

---

### Phase 7 — Output

| Section | Status | Notes |
|---------|--------|-------|
| Phase 1 Walk-in | **PASS** | One walk-in per company, CUS-0000, unique index + CHECK; sales/ledger use same ID; no branch-based walk-in. |
| Phase 2 Permission | **PASS** | Admin/owner full company; user branch-scoped; ledger customer-based, no created_by. |
| Phase 3 Identity | **PASS** (1 exception) | created_by/received_by/performed_by = auth.users(id); studio/rental legacy FKs to public.users.id in places. |
| Phase 4 Document sequence | **PARTIAL** | Invoice/CUS/PAY use global RPC; branch/rental/expense use settings path. |
| Phase 5 Health dashboard | **PASS** | SECURITY DEFINER, defensive, admin-only, no crash; UI admin-only, PASS/FAIL, real-time. |
| Phase 6 Deep consistency | **REQUIRES LIVE DB** | Run validation and health scripts on target DB. |

---

## OVERALL SYSTEM STATUS

**STABLE** with the following caveats:

1. **Identity:** Some studio/rental tables still have `created_by` (or similar) referencing `public.users(id)` in schema; behavior is consistent with auth.uid() and backfills for core ERP tables. Optional follow-up: align studio/rental FKs to auth.users(id) or document as legacy.
2. **Document numbering:** Invoice, customer code, and payment ref use global RPC; other flows use settings/document_sequences. Acceptable if branch-scoped numbering is by design.
3. **Phase 6:** Sales vs ledger, payment vs journal, stock vs inventory_balance, and orphan checks require running the health dashboard and/or validation scripts against the live database.

No schema or migration changes were made in this verification pass.
