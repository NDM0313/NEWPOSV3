# Backend Integration Architecture – Production Release Freeze

**Role:** Senior Full-Stack Architect  
**Scope:** Mobile ERP Frontend (React + TypeScript) ↔ Backend (Supabase / Node.js)  
**Goal:** Freeze API contract, auth, data model, and state strategy before production release.

---

## Current Stack Note

The frontend currently uses **Supabase** as the backend (PostgREST + Auth). This document treats:

- **Resources** = Supabase tables (e.g. `sales`, `purchases`).
- **Actions** = CRUD via PostgREST or **RPCs** (custom PostgreSQL functions).

If you introduce a **Node.js BFF** later, the same resource/action list can be implemented as REST endpoints; the contract below is backend-agnostic.

---

# PART 1 – API CONTRACT VALIDATION

## Endpoint Naming & RESTful Pattern

- **Table access:** `GET/POST/PATCH/DELETE /rest/v1/<table>` with filters (e.g. `company_id`, `branch_id`).  
- **RPCs:** `POST /rest/v1/rpc/<function_name>`.  
- **Naming:** Table names are **plural**, **snake_case** (e.g. `sales`, `sale_items`, `purchase_items`).  
- **IDs:** UUID primary keys; foreign keys: `company_id`, `branch_id`, `customer_id`, etc.

## 1.1 Sales Module

| Resource / RPC | Method | Purpose | Request/Response |
|----------------|--------|---------|-------------------|
| `sales` | GET | List sales (company, branch, filters) | Query: `company_id`, `branch_id`, `invoice_date`, `payment_status`. Response: array of sale + optional `sale_items` / `sales_items`. |
| `sales` | GET by id | Single sale with items | Select: `*, sale_items(*, product, variation)` or `sales_items(...)`. |
| `sales` | POST | Create sale | Body: sale row; then `sale_items` or `sales_items` insert. |
| `sales` | PATCH | Update sale | Body: partial sale. |
| `sales` | DELETE | Delete sale (draft only) | - |
| `sale_items` / `sales_items` | GET | Items by sale_id | - |
| `sale_items` / `sales_items` | POST | Insert line items | - |
| `sale_returns` | GET/POST/PATCH | Returns | company_id, sale_id, status. |
| `payments` | GET/POST/PATCH/DELETE | Sale payments | reference_type='sale', reference_id=sale_id. |
| **RPC** `delete_payment_with_reverse` | POST | Delete payment + reverse JE | payment_id, etc. |
| **RPC** `create_discount_journal_entry` | POST | Discount JE | (SalesContext) |
| **RPC** `create_commission_journal_entry` | POST | Commission JE | (SalesContext) |
| **RPC** `create_extra_expense_journal_entry` | POST | Extra expense JE | (SalesContext) |

**Consistency:** All sale-related tables use `company_id`; list endpoints filter by `company_id` (and optionally `branch_id`). No redundant “get sale by invoice_no” if “get by id” exists; use single source (id).

---

## 1.2 Purchase Module

| Resource / RPC | Method | Purpose | Request/Response |
|----------------|--------|---------|------------------|
| `purchases` | GET | List purchases | company_id, branch_id, status. |
| `purchases` | GET by id | Single purchase with items | - |
| `purchases` | POST | Create purchase | + purchase_items insert. |
| `purchases` | PATCH | Update purchase | - |
| `purchases` | DELETE | Delete (restricted by permission) | - |
| `purchase_items` | GET/POST | Items by purchase_id | - |
| `purchase_returns` | GET/POST/PATCH | Returns | - |
| `purchase_return_items` | GET/POST | Return line items | - |
| `payments` | GET/POST | Purchase payments | reference_type='purchase'. |
| **RPC** `delete_payment` | POST | Delete purchase payment | (purchaseService) |

**Consistency:** Same RESTful pattern as sales; `po_no`, `po_date`; status enum: draft, ordered, received, final.

---

## 1.3 Rental Module

| Resource / RPC | Method | Purpose | Request/Response |
|----------------|--------|---------|-------------------|
| `rentals` | GET | List rentals | company_id, branch_id, status, date filters. |
| `rentals` | GET by id | Single rental with items | - |
| `rentals` | POST | Create rental | + rental_items insert. |
| `rentals` | PATCH | Update (booking, pickup, return, cancel) | status: booked, picked_up, active, returned, overdue, closed, cancelled. |
| `rentals` | DELETE | Delete rental | - |
| `rental_items` | GET/POST/PATCH/DELETE | Line items | rental_id. |
| `rental_payments` | GET/POST/DELETE | Payments | rental_id. |
| **RPC** `get_customer_ledger_rentals` | POST | Ledger: rentals for customer | p_company_id, p_customer_id, p_from_date, p_to_date. |

**Consistency:** Status lifecycle: booked → picked_up / active → returned → closed; overdue and cancelled are explicit.

---

## 1.4 Studio Module

| Resource / RPC | Method | Purpose | Request/Response |
|----------------|--------|---------|-------------------|
| `sales` | GET | Studio sales (filter by type/source) | Invoice tied to studio order. |
| `studio_orders` | GET/POST/PATCH | Studio orders | company_id, customer_id. |
| `studio_productions` | GET/POST/PATCH/DELETE | Productions linked to sale | sale_id. |
| `studio_production_stages` | GET/POST/PATCH | Pipeline stages per production | production_id, stage_type, status. |
| `studio_production_logs` | POST | Log entries | - |
| `workers` | GET/POST/PATCH | Workers | company_id. |
| `worker_ledger_entries` | GET/POST | Worker costs | worker_id, production/stage. |
| `studio_cost_categories` / costs | GET | Cost categories | (studioCostsService) |

**Consistency:** Pipeline = productions → stages; stages have status and optional worker/cost; stored in DB (no client-only state).

---

## 1.5 Accounts (Accounting) Module

| Resource / RPC | Method | Purpose | Request/Response |
|----------------|--------|---------|-------------------|
| `accounts` | GET/POST/PATCH/DELETE | Chart of accounts | company_id, branch_id. |
| `journal_entries` | GET/POST/PATCH | Journal entries | company_id, entry_no, entry_date. |
| `journal_entry_lines` | GET/POST | JE lines | journal_entry_id, account_id, debit, credit. |
| **RPC** `get_customer_ledger_sales` | POST | Ledger sales | p_company_id, p_customer_id, p_from_date, p_to_date. |
| **RPC** `get_customer_ledger_payments` | POST | Ledger payments | p_company_id, p_sale_ids, p_from_date, p_to_date. |
| **RPC** `get_customer_ledger_rentals` | POST | Ledger rentals | p_company_id, p_customer_id, p_from_date, p_to_date. |
| `ledger_master` / `ledger_entries` | GET/POST | Supplier/user ledger (if used) | (ledgerService) |
| `worker_ledger_entries` | GET/POST | Worker ledger | - |

**Consistency:** All ledger RPCs take company_id and optional date range; return tabular data for frontend to build running balance.

---

## 1.6 Products Module

| Resource / RPC | Method | Purpose | Request/Response |
|---------------|--------|---------|------------------|
| `products` | GET/POST/PATCH/DELETE | Products | company_id, is_active. |
| `product_categories` | GET/POST/PATCH | Categories | company_id. |
| `product_variations` | GET/POST/PATCH | Variations | product_id, company_id. |
| `brands` | GET/POST | Brands | (brandService) |
| `units` | GET/POST | Units | (unitService) |
| `stock_movements` | GET/POST | Inventory movements | company_id, product_id, variation_id. |
| `inventory` / stock views | GET | Current stock | By product/variation/branch if applicable. |

**Consistency:** Products have `company_id`; variations and categories are company-scoped; no duplicate “get product by sku” if “get by id” is primary.

---

## 1.7 Reports Module

Reports are **derived** from existing resources (sales, purchases, payments, expenses, journal_entries). No dedicated “reports” table required.

| Logical API | Source | Purpose |
|-------------|--------|---------|
| Sales summary | `sales` aggregated | By date, branch, payment_status. |
| Purchase summary | `purchases` aggregated | By date, branch. |
| Expense summary | `expenses` aggregated | By date, category. |
| Trial balance / P&L | `journal_entries` + `journal_entry_lines` + `accounts` | By date range, company. |
| Customer ledger | RPCs `get_customer_ledger_*` + payments | Already defined in Accounts. |

**Consistency:** No redundant report endpoints; use same tables/RPCs with filters and aggregations.

---

## 1.8 Settings Module

| Resource / RPC | Method | Purpose | Request/Response |
|----------------|--------|---------|-------------------|
| `companies` | GET by id / PATCH | Company profile | name, currency, financial_year_start, timezone, date_format, decimal_precision, printer_mode, default_printer_name, print_receipt_auto. |
| `branches` | GET/POST/PATCH | Branches | company_id, default_*, fiscal_year_start/end. |
| `settings` | GET/POST/PATCH | Key-value settings | company_id, key, value (JSONB). |
| `document_sequences` | GET/POST/PATCH | Document number sequences | company_id, branch_id, document_type. |
| `users` | GET/POST/PATCH | Users | company_id, role, permissions. |
| `roles` | GET/POST/PATCH | Roles | company_id, permissions JSONB. |

**Consistency:** Single `companies` row per tenant; settings key-value for POS, sales, purchase, etc.

---

## API Contract Summary

| Item | Status |
|------|--------|
| Endpoint naming | ✅ Plural snake_case tables; RPCs verb/noun. |
| RESTful pattern | ✅ GET list/detail, POST create, PATCH update, DELETE where applicable. |
| Request/response | ✅ Documented above per module; all scoped by company_id (and branch_id where relevant). |
| Redundant endpoints | ✅ None required; single source (id) for entities. |

---

# PART 2 – AUTHENTICATION FLOW

## 2.1 JWT Token Handling

- **Provider:** Supabase Auth.
- **Access token:** JWT in session; sent automatically by Supabase client as `Authorization: Bearer <access_token>` on every request.
- **Usage:** Frontend uses `supabase.auth.getSession()` and `supabase.auth.getUser()`; no manual header attachment for Supabase PostgREST.

If you add a **Node.js API**, forward the same `Authorization: Bearer <access_token>` and validate JWT (e.g. Supabase JWT secret or your own issuer).

## 2.2 Refresh Token Mechanism

- **Handling:** Supabase client uses `autoRefreshToken: true` (see `src/lib/supabase.ts`). Refresh is done by the client when access token expires.
- **Session persistence:** `persistSession: true` (localStorage).
- **Define:** Refresh token is stored and sent to Supabase Auth; new access token is written to session. No custom refresh endpoint required when using Supabase only.

For a **Node BFF**, either:
- Keep using Supabase client on frontend and pass through to Supabase where needed, or  
- Implement a BFF endpoint that accepts refresh token and returns new access token (and optionally new refresh token) per your auth provider.

## 2.3 Role & Permissions (Backend Validation)

- **Source of truth:** `users` table (company_id, role); optional `permissions` JSONB or `roles` table.
- **Backend:** RLS policies use `get_user_role()` and `has_module_permission(module_name, permission_type)` (see `supabase-extract/rls-policies.sql`). So backend validates role/permissions on every table access.
- **Frontend:** `checkPermission(permissions, module, action)` and `useCheckPermission()` for UI only; **backend must enforce** via RLS (or equivalent in Node.js middleware).

**Definition:**  
- **Token expiration:** Access token expiry as per Supabase (e.g. 1 hour); refresh before expiry.  
- **On 401:** Frontend should call `getSession()` / refresh; on failure, redirect to login.

---

# PART 3 – DATA MODEL ALIGNMENT

## 3.1 Frontend Types vs Backend DB Schema

| Area | Frontend (types/services) | Backend (DB) | Match |
|------|----------------------------|--------------|------|
| Company | name, currency, financial_year_start, timezone, date_format, decimal_precision | companies: currency, financial_year_start (03, 02); timezone/date_format/decimal_precision may be in settings or companies | ⚠️ Ensure companies has timezone, date_format, decimal_precision or consistent settings keys |
| Sale | Sale + sale_items / sales_items; payment_status, invoice_no, invoice_date | sales + sale_items/sales_items; enums match | ✅ |
| Purchase | Purchase + purchase_items; status enum | purchases + purchase_items; transaction_status / purchase_status | ✅ |
| Rental | status: booked, picked_up, active, returned, overdue, closed, cancelled | rental_status enum (schema: booked, active, returned, overdue, cancelled; CLEAN has picked_up, closed) | ⚠️ Align enum in DB with frontend (add picked_up, closed if missing) |
| Studio | studio_productions, studio_production_stages, workers, worker_ledger_entries | Tables exist; stages have status, type | ✅ |
| Product | Product + variations, category_id, unit_id, brand_id | products, product_variations, product_categories, units, brands | ✅ |
| Payment | reference_type, reference_id, amount, payment_date | payments table | ✅ |

## 3.2 Currency, Fiscal Year, Timezone

| Field | Frontend | Backend | Action |
|-------|----------|---------|--------|
| Currency | company.currency (e.g. PKR) | companies.currency | ✅ |
| Fiscal year start | company.financial_year_start / fiscalYearStart | companies.financial_year_start | ✅ |
| Timezone | company.timezone (e.g. Asia/Karachi) | companies.timezone or settings | Add companies.timezone if missing |
| Date/time format | date_format, time_format | companies or settings | Ensure one source of truth |

## 3.3 Studio Pipeline Stages

- **Stored in DB:** `studio_production_stages` (production_id, stage_type, status, notes, worker_id, cost, etc.).  
- **Frontend:** Fetches stages by production; no client-only pipeline state.  
- **Alignment:** Stage types and statuses should match enums/constants used in frontend (e.g. Cutting, Stitching, …).

## 3.4 Rental Lifecycle Statuses

- **Backend enum:** `rental_status`: booked, (picked_up), active, returned, overdue, (closed), cancelled.  
- **Frontend:** Uses same values for state (e.g. ViewRentalDetailsDrawer, rentalService).  
- **Action:** Ensure DB enum includes all frontend-used statuses (picked_up, closed if used).

---

# PART 4 – STATE MANAGEMENT STRATEGY

## 4.1 Global State

| State | Where | Purpose |
|-------|--------|---------|
| Auth (user, session) | SupabaseContext | Session, user, companyId, userRole, branchId, defaultBranchId. |
| Company settings | SettingsContext | Company profile (currency, timezone, etc.), branches, POS/sales/purchase settings, permissions. |
| Supabase client | SupabaseContext / lib/supabase | Single instance for all API calls. |

## 4.2 Module-Level State

| Module | Context / Location | Purpose |
|--------|--------------------|---------|
| Sales | SalesContext | Sale list, selected sale, create/update/delete, payments. |
| Purchases | PurchaseContext | Purchase list, create/update. |
| Rentals | RentalContext | Rental list, booking, pickup, return. |
| Studio | ProductionContext + components | Productions, stages, costs. |
| Accounting | AccountingContext | Journal entries, accounts, ledger data. |
| Products | Local + productService | Product list, form state. |
| Reports | Local + services | Report filters, aggregated data. |
| Settings | SettingsContext | Company, branches, settings keys. |

## 4.3 Cache Strategy

- **Auth/session:** Cached in memory (SupabaseContext); refreshed on auth state change.  
- **Company/settings:** Loaded once per company in SettingsContext; refresh on explicit action or company switch.  
- **Lists (sales, purchases, etc.):** Fetched on mount or when filters change; optional invalidation after create/update/delete.  
- **No global Redux/store:** Context + service layer is the cache boundary.

## 4.4 Error Handling Pattern

- **API errors:** Use `handleApiError(context, error, fallbackMessage)` (errorUtils) and/or `showErrorToast(error, message)` (errorToast).  
- **Silent failures:** Avoid empty catch; use `logger.warn` or toast.  
- **Global UI:** ErrorBoundary wraps app; critical errors surface to user.

---

# PART 5 – INTEGRATION CHECKLIST

## 5.1 API Readiness Status

| Module | Tables/RPCs Used | Status |
|--------|-------------------|--------|
| Sales | sales, sale_items/sales_items, sale_returns, payments + 4 RPCs | ✅ In use |
| Purchase | purchases, purchase_items, purchase_returns, payments + delete_payment RPC | ✅ In use |
| Rental | rentals, rental_items, rental_payments + get_customer_ledger_rentals | ✅ In use |
| Studio | studio_orders, studio_productions, studio_production_stages, studio_production_logs, workers, worker_ledger_entries | ✅ In use |
| Accounts | accounts, journal_entries, journal_entry_lines + 3 ledger RPCs, ledger_master, ledger_entries | ✅ In use |
| Products | products, product_categories, product_variations, brands, units, stock_movements | ✅ In use |
| Reports | Derived from above | ✅ No extra endpoints |
| Settings | companies, branches, settings, document_sequences, users, roles | ✅ In use |

**Overall:** Backend (Supabase) is in use and sufficient for current frontend. No missing **tables** for core flows.

## 5.2 Missing Endpoints / Gaps

| Item | Severity | Action |
|------|----------|--------|
| `get_customer_ledger_rentals` RPC | High if ledger shows rentals | Ensure RPC exists in DB (customerLedgerApi + accountingService use it). |
| Companies: timezone, date_format, decimal_precision | Medium | Add columns to `companies` or agree settings keys; frontend expects them for company profile. |
| Rental status enum (picked_up, closed) | Low | Align DB enum with frontend lifecycle. |
| Node.js BFF | N/A | Only if you add a separate API layer; then implement same resource list as REST. |

## 5.3 Data Model Mismatches

| Mismatch | Fix |
|----------|-----|
| companies.timezone / date_format / decimal_precision | Add to companies or document which settings keys hold them. |
| rental_status enum | Add picked_up, closed to enum if used by frontend. |
| sale_items vs sales_items | Frontend supports both; ensure DB has one canonical name and RLS/triggers match. |

## 5.4 Required Backend Adjustments

1. **Companies table:** Add (if missing) `timezone`, `date_format`, `decimal_precision` (or standardize on settings keys).  
2. **RPCs:** Deploy `get_customer_ledger_sales`, `get_customer_ledger_payments`, `get_customer_ledger_rentals` (and optional `get_user_company_id`) with correct signatures.  
3. **RLS:** Ensure all tables enforce company_id (and branch_id where needed) and use `has_module_permission` for role-based access.  
4. **Rental status:** Extend `rental_status` enum if frontend uses picked_up, closed.

## 5.5 Integration Order (Module by Module)

Recommended order for final validation and release freeze:

1. **Auth & Settings** – Login, session refresh, company + branch + settings load.  
2. **Products** – Categories, units, brands, products, variations, stock.  
3. **Contacts** – Customers, suppliers (for sales/purchases/ledger).  
4. **Purchases** – Create/list/update; payments; returns.  
5. **Sales** – Create/list/update; payments; returns; ledger RPCs.  
6. **Rentals** – Book, pickup, return, payments; ledger rentals RPC.  
7. **Studio** – Productions, stages, workers, costs.  
8. **Accounts** – Chart of accounts, journal entries, ledger (customer/supplier/user/worker).  
9. **Reports** – Verify aggregates and trial balance/P&L from existing data.  
10. **Settings (full)** – Users, roles, document sequences, company profile, printer config.

---

# Document Control

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial freeze: API contract, auth, data model, state, checklist. |

**Modified files (this document):**  
- `BACKEND_INTEGRATION_ARCHITECTURE.md` (new).

**Summary:**  
- **Security:** RLS + role/permission validation on backend; JWT + refresh via Supabase.  
- **Performance:** Context-based state; no redundant endpoints; lazy loading on frontend (see Phase 3).  
- **Production readiness:** Contract is defined; align DB (companies columns, rental enum, RPCs) and then freeze.
