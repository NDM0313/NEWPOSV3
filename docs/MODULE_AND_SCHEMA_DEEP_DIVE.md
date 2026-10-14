# NEW POSV3 / Din Collection ERP — Module and Schema Deep Dive

**Prepared:** 2026-08-24  
**Scope:** Operational architecture, database schema, PostgreSQL routines/triggers, TypeScript service mapping, Web/mobile parity, and RLS/permissions  
**Repository:** `C:\Users\ndm31\dev\Corusr\NEW POSV3`

> **Important:** This repository contains baseline schemas, extracted snapshots, dated production migrations, repair SQL, and compatibility migrations from several schema generations. No single SQL file is a definitive representation of the deployed database. This document distinguishes canonical architecture, compatibility paths, and unresolved schema conflicts. Production truth must ultimately be verified through `pg_catalog`, `pg_policies`, `pg_proc`, table constraints, and the applied-migration ledger.

---

## 1. Architecture Summary

NEW POSV3 is a multi-tenant, branch-scoped ERP using two React clients over one Supabase backend:

```text
Web: React + TypeScript + Vite
  |-- src/app/components
  |-- src/app/context
  `-- src/app/services
                 \
                  \ PostgREST + PostgreSQL RPC + Auth + Storage + Realtime
                  /
Mobile: React + TypeScript + Vite + Capacitor
  |-- erp-mobile-app/src/api
  |-- erp-mobile-app/src/lib
  `-- offline synchronization
                         |
                         v
Supabase PostgreSQL
  |-- Operational documents
  |-- Canonical journal-based GL
  |-- Movement-based inventory ledger
  |-- SQL transactional procedures
  |-- Triggers and derived caches
  `-- Company/branch/permission RLS
```

### 1.1 Canonical sources of truth

| Concern | Canonical source | Non-canonical/derived/compatibility sources |
|---|---|---|
| General ledger | `accounts`, `journal_entries`, `journal_entry_lines` | `chart_accounts`, `account_transactions`, `ledger_master`, `ledger_entries`, stored `balance`/`current_balance` fields |
| Inventory quantity | `stock_movements` | `inventory_balance`, `products.current_stock`, variation stock cache columns |
| Sales document | `sales`, primarily `sales_items` | `sale_items` compatibility fallback |
| Purchases | `purchases`, `purchase_items`, `purchase_charges` | Historical detail-column variants |
| Party master | `contacts` | Denormalized customer/supplier names on documents |
| Rental operations | `rentals`, `rental_items`, `rental_payments` | Linked journal/cache fields |
| Unified accounting views | Journal-derived unified RPCs | Legacy/shadow readers used for parity comparisons |

### 1.2 Core dependency chain

```text
Contacts ───────┬── Sales ───────┬── Payments ───────┐
                ├── Purchases ───┤                   │
Products ───────┼── Sale Items   ├── Stock Movements │
                ├── Purchase Items                   │
                `── Rental Items                     │
                                                      v
Accounts <──────────────────────────── Journal Entries
                                              |
                                              `── Journal Entry Lines
```

---

## 2. Schema Sources and Interpretation

Principal schema sources inspected:

- `supabase-extract/migrations/02_clean_erp_schema.sql`
- `supabase-extract/migrations/03_frontend_driven_schema.sql`
- `supabase-extract/schema.sql`
- `supabase-extract/CLEAN_COMPLETE_SCHEMA.sql`
- `docs/db_schema_snapshot.json` (2026-03-12 snapshot; 116 public tables)
- `docs/DATABASE_AUDIT_REPORT.md`
- Root `migrations/` production evolution chain
- `supabase/migrations/`

The extracted snapshot confirms overlapping models, including `accounts` and `chart_accounts`, `sale_items` and `sales_items`, journal tables, operational ledger tables, and derived inventory tables.

---

# Part I — Core Database Schema

## 3. Accounts and Chart of Accounts

### 3.1 Canonical `accounts`

| Column | Effective type(s) | Null/default | Keys and semantics |
|---|---|---|---|
| `id` | `uuid` | NOT NULL; generated UUID | Primary key |
| `company_id` | `uuid` | NOT NULL | FK `companies(id) ON DELETE CASCADE` |
| `code` | `varchar(50)` | NOT NULL | Unique per company |
| `name` | `varchar(255)` | NOT NULL | Account display name |
| `type` | `account_type` enum or `varchar(50)` | NOT NULL | Asset/liability/equity/income/expense classification; generation-dependent type |
| `subtype` | `account_subtype` enum | Required in clean schema | More specific classification; absent in some frontend-driven definitions |
| `parent_id` | `uuid` | NULL | Self-FK `accounts(id) ON DELETE SET NULL` |
| `opening_balance` | `decimal(15,2)` | DEFAULT 0 | Seed/opening value; not canonical ongoing balance |
| `current_balance` | `decimal(15,2)` | DEFAULT 0 | Cache/convenience field; not GL truth |
| `balance` | `decimal(15,2)` | DEFAULT 0 | Older name; conflicts with `current_balance` |
| `description` | `text` | NULL | Added by `17_accounts_description.sql` |
| `is_system` | `boolean` | DEFAULT false | System-account protection |
| `is_active` | `boolean` | DEFAULT true | Active flag |
| `is_group` | `boolean` | NOT NULL DEFAULT false | Header/group account; added by `20260347_account_is_group_coa_headers.sql` |
| `linked_contact_id` | `uuid` | NULL | FK `contacts(id) ON DELETE SET NULL`; party subledger association |
| `created_at` | `timestamptz` | DEFAULT now() | Audit timestamp |
| `updated_at` | `timestamptz` | DEFAULT now() | Maintained timestamp |

Important constraints/indexes:

- PK on `id`
- `UNIQUE(company_id, code)`
- FKs to company, parent account, and linked contact
- Company, type, code, and linked-contact indexes
- Branch defaults can reference accounts through `default_cash_account_id`, `default_bank_account_id`, and `default_pos_drawer_account_id`

### 3.2 Party subledgers

`accounts.linked_contact_id` creates contact-specific child accounts under control accounts. Key conventions include:

- `1100` — Accounts Receivable control
- `2000` — Accounts Payable control
- Contact-specific AR/AP/worker payable accounts beneath controls

Posting directly to a party control account is guarded by `_is_account_control_code`, `_resolve_je_party_contact_id`, and `trg_reject_control_party_jel` in later migrations.

### 3.3 Conflicting `chart_accounts`

`chart_accounts` was introduced by `supabase-extract/migrations/16_chart_of_accounts.sql` with global `code`, `category`, `sub_category`, `nature`, `modules[]`, tax metadata, and `auth.users` audit links. It has no `company_id` in its original definition and feeds `account_transactions`.

This migration also used `CREATE TABLE IF NOT EXISTS` for journal tables. Where application journal tables already existed, it did not replace their FK from `accounts` to `chart_accounts`. Therefore:

> `accounts` is the canonical company-scoped chart; `chart_accounts`/`account_transactions` are alternate or legacy structures and must not be used as GL truth.

---

## 4. Journal Entries

### 4.1 `journal_entries`

| Column | Effective type | Null/default | Keys and semantics |
|---|---|---|---|
| `id` | `uuid` | NOT NULL; generated | PK |
| `company_id` | `uuid` | NOT NULL | FK `companies(id) ON DELETE CASCADE` |
| `branch_id` | `uuid` | Nullable/required by generation | FK `branches(id)`; delete action varies |
| `entry_no` | `varchar(50/100)` | Historically required; later lifecycle-dependent | JE sequence identifier |
| `document_no` | `varchar(100)` | NULL | Added for FT/JV/document numbering |
| `entry_date` | `date` | NOT NULL; often current date | Accounting date |
| `description` | `text` | NULL or required by generation | Narration |
| `reference_type` | `varchar(50)` | NULL | Polymorphic source type (`sale`, `purchase`, `payment`, etc.) |
| `reference_id` | `uuid` | NULL | Polymorphic source ID; no universal FK |
| `payment_id` | `uuid` | NULL | Separates payment JEs from document JEs |
| `economic_event_id` | `uuid` | NULL | Stable accounting-event/reversal chain |
| `total_debit` | `decimal(15,2)` | NOT NULL in clean schema | Header total |
| `total_credit` | `decimal(15,2)` | NOT NULL in clean schema | Header total |
| `is_posted` | `boolean` | DEFAULT false | Posting state |
| `posted_at` | `timestamptz` | NULL | Posting timestamp |
| `is_manual` | `boolean` | DEFAULT false | Manual JE marker |
| `is_void` | `boolean` | Usually DEFAULT false | Soft-void lifecycle |
| `void_reason` | `text` | NULL | Void/reversal explanation |
| `attachments` | `jsonb` | NULL | Added by attachment migration |
| `created_by` | `uuid` | NULL | User/auth linkage varies by schema generation |
| `created_at` | `timestamptz` | DEFAULT now() | Audit timestamp |
| `updated_at` | `timestamptz` | DEFAULT now() | Audit timestamp |

Key constraints:

- `CHECK(total_debit = total_credit)` in baseline/clean definitions
- Later line-mutation trigger refreshes header totals
- Partial unique indexes enforce one active canonical document JE per sale/purchase
- Indexes on company/date, source reference, payment ID, and economic event

### 4.2 `journal_entry_lines`

| Column | Type | Null/default | Keys and semantics |
|---|---|---|---|
| `id` | `uuid` | NOT NULL; generated | PK |
| `journal_entry_id` | `uuid` | NOT NULL | FK `journal_entries(id) ON DELETE CASCADE` |
| `account_id` | `uuid` | NOT NULL | Canonical FK `accounts(id) ON DELETE RESTRICT` |
| `account_name` | `varchar(255)` | Required in clean schema | Denormalized name |
| `line_number` | `integer` | Alternate schema only | Not consistent in canonical application generation |
| `debit` | `decimal(15,2)` | DEFAULT 0 | Debit amount |
| `credit` | `decimal(15,2)` | DEFAULT 0 | Credit amount |
| `description` | `text` | NULL | Line narration |
| `created_at` | `timestamptz` | DEFAULT now() | Audit timestamp |

Canonical line constraint:

```sql
CHECK (
  (debit > 0 AND credit = 0)
  OR
  (debit = 0 AND credit > 0)
)
```

Journal lines are the amount-level accounting truth. Header totals are derived/synchronized, and stored account/contact balance columns are not authoritative.

---

## 5. Sales

### 5.1 `sales`

| Column group | Columns and effective types | Notes |
|---|---|---|
| Identity/scope | `id uuid`, `company_id uuid`, `branch_id uuid` | Company and branch FKs |
| Lifecycle numbers | `invoice_no varchar`, `draft_no varchar`, `quotation_no varchar`, `order_no varchar` | Invoice/PO numbers became nullable for pre-final stages; populated values use scoped partial uniqueness |
| Date | `invoice_date date/timestamptz`, `delivery_date date`, `deadline date` | Date type varies in snapshots/migrations |
| Party | `customer_id uuid`, `customer_name varchar`, `contact_number varchar` | Contact FK can be nullable in frontend-driven generations; names are snapshots |
| Classification | `type sale_type`, `sale_type varchar`, `status transaction_status/sale_status`, `payment_status`, `shipping_status` | Parallel historical naming exists |
| Amounts | `subtotal`, `discount_percentage`, `discount_amount`, `tax_percentage`, `tax_amount`, `expenses`, `shipping_charges`, `shipment_charges`, `extra_expenses`, `studio_charges`, `total`, `paid_amount`, `due_amount`, `return_due` | Usually `decimal/numeric(15,2)`; naming evolved |
| Payment | `payment_method varchar` | Operational payment summary; actual payments are separate rows |
| Studio/source | `is_studio boolean`, `show_studio_breakdown boolean`, `source varchar`, `source_id uuid` | Studio and originating-workflow metadata |
| Conversion | `converted boolean NOT NULL DEFAULT false`, `converted_to_document_id uuid` | Self-FK `sales(id) ON DELETE SET NULL` |
| Cancellation | `cancelled_at`, `cancelled_by`, `cancel_reason` | Soft cancellation lifecycle |
| Accounting/docs | `journal_entry_id uuid`, `attachments jsonb`, `notes text`, `terms_conditions text` | JE link is not consistently FK-constrained |
| Audit | `created_by uuid`, `created_at`, `updated_at` | Creator is auto-filled/protected by triggers in later migrations |

Key constraints/evolution:

- PK `id`
- Company, branch, and customer FKs
- Initial global `invoice_no` uniqueness evolved to company/branch uniqueness
- Lifecycle migration then made `invoice_no` nullable and applied partial uniqueness only when populated
- Canonical JE partial uniqueness prevents duplicate active sale document JEs

### 5.2 `sales_items` vs `sale_items`

The intended/current service preference is `sales_items`; older schema baselines define `sale_items`. Both exist in the extracted snapshot.

Common detail columns:

| Column | Type/meaning |
|---|---|
| `id uuid` | PK |
| `sale_id uuid` | FK `sales(id) ON DELETE CASCADE` |
| `product_id uuid` | FK `products(id) ON DELETE RESTRICT` |
| `variation_id uuid` | FK `product_variations(id) ON DELETE SET NULL` |
| `product_name varchar`, `sku varchar` | Denormalized product identity |
| `quantity decimal(15,2)`, `unit varchar` | Quantity/unit |
| `unit_price decimal(15,2)` | Price |
| `discount_percentage`, `discount_amount` | Discount |
| `tax_percentage`, `tax_amount` | Tax |
| `total decimal(15,2)` | Line total |
| `packing_type`, `packing_quantity`, `packing_unit`, `packing_details jsonb` | Packing support |
| `customization_details jsonb` | Bespoke support |
| `is_studio_product boolean` | Studio classification |
| `notes text`, `created_at timestamptz` | Metadata |

Canonical client behavior is normally:

1. Read/write `sales_items`.
2. Fall back to `sale_items` only on missing-relation error (`42P01`).

This fallback is not implemented uniformly in every accounting helper; it remains a migration/deployment risk.

---

## 6. Purchases

### 6.1 `purchases`

| Column group | Columns and effective types | Notes |
|---|---|---|
| Identity/scope | `id uuid`, `company_id uuid`, `branch_id uuid` | Company/branch FKs |
| Numbers | `po_no varchar`, `draft_no varchar`, `order_no varchar` | Same lifecycle evolution as sales |
| Date | `po_date date/timestamptz`, `expected_delivery_date date`, `received_date date` | Operational dates |
| Party | `supplier_id uuid`, `supplier_name varchar`, `contact_number varchar` | Supplier FK and denormalized snapshot |
| State | `status transaction_status/purchase_status`, `payment_status`, `payment_method varchar` | Draft/order/received/final/cancelled variants |
| Amounts | `subtotal`, `discount_percentage`, `discount_amount`, `tax_percentage`, `tax_amount`, `shipping_charges`, `shipping_cost`, `total`, `paid_amount`, `due_amount` | Shipping naming differs by generation |
| FX | Currency, rate, foreign amount, settlement and import metadata added by 2026-08 migrations | Feature-gated by DB guards |
| Conversion/cancel | `converted`, `converted_to_document_id`, `cancelled_at`, `cancelled_by`, `cancel_reason` | Self-FK conversion lifecycle |
| Accounting/docs | `journal_entry_id`, `attachments jsonb`, `notes` | Accounting/document metadata |
| Audit | `created_by`, `created_at`, `updated_at` | User/timestamps |

Constraints:

- PK and company/branch/supplier FKs
- Initial global `po_no` uniqueness evolved into company/branch uniqueness
- Lifecycle-aware partial unique index applies only to non-null PO numbers
- Canonical JE uniqueness protects purchase document posting

### 6.2 `purchase_items`

| Column | Effective type/meaning |
|---|---|
| `id uuid` | PK |
| `purchase_id uuid` | FK `purchases(id) ON DELETE CASCADE` |
| `product_id uuid` | FK `products(id) ON DELETE RESTRICT` |
| `variation_id uuid` | FK `product_variations(id) ON DELETE SET NULL` |
| `product_name varchar`, `sku varchar` | Denormalized identity |
| `quantity decimal(15,2)` | Ordered quantity |
| `received_quantity` / `received_qty decimal(15,2)` | Conflicting historical names |
| `unit varchar` | Unit |
| `unit_price decimal(15,2)` | Cost |
| `discount_percentage`, `discount`, `discount_amount` | Historical variants |
| `tax_percentage`, `tax`, `tax_amount` | Historical variants |
| `total decimal(15,2)` | Line total |
| Packing columns and `packing_details jsonb` | Packing support |
| `notes`, `created_at` | Metadata |

`purchase_charges` supplements line/header values for freight, labor, clearance, courier, and capitalized costs.

---

## 7. Products and Inventory

### 7.1 `products`

| Column group | Columns | Semantics |
|---|---|---|
| Identity/scope | `id uuid`, `company_id uuid` | PK and company FK |
| Classification | `category_id uuid`, `brand_id uuid`, `unit_id uuid`, legacy `unit varchar` | Product taxonomy and normalized unit |
| Identity | `name varchar`, `sku varchar`, `barcode varchar`, `description text` | `UNIQUE(company_id, sku)` |
| Prices | `cost_price`, `retail_price`, `wholesale_price`, rental daily/weekly/monthly rates | Numeric prices |
| Stock caches | `current_stock`, `min_stock`, `max_stock`, `reorder_point` | `current_stock` is not canonical quantity truth |
| Behavior | `has_variations`, `is_combo_product`, `product_type`, `source_type`, `is_dyeable`, `is_rentable`, `is_sellable`, `is_purchasable`, `track_stock`, `is_active` | Capability/status flags |
| Media | `image_url`, `gallery_urls jsonb`, `image_urls jsonb` | Historical naming overlap |
| Audit | `created_by`, `created_at`, `updated_at` | User/timestamps |

### 7.2 `product_variations`

Important columns are `id`, `product_id`, `name`, `sku`, `barcode`, `attributes jsonb`, cost/retail/wholesale price fields, `price`, `current_stock`/`stock`, image, active flag, and timestamps.

Conflicts:

- `price` vs `retail_price`
- `stock` vs `current_stock`
- Both stock fields are secondary to `stock_movements`

### 7.3 `stock_movements`

| Column | Effective type | Semantics |
|---|---|---|
| `id uuid` | PK | Movement ID |
| `company_id uuid`, `branch_id uuid` | Tenant/scope | Company and branch FKs |
| `product_id uuid`, `variation_id uuid` | Item | Product/variation FKs |
| `type stock_movement_type` / `movement_type varchar(50)` | Classification | Historical naming conflict |
| `quantity decimal(15,2)` | Signed movement | Positive IN, negative OUT in canonical reconciliation paths |
| `unit_cost`, `total_cost` | Valuation | Financial value |
| `balance_qty`, `before_qty`, `after_qty` | Derived snapshots | Not replacements for movement sum |
| `box_change`, `piece_change`, `unit` | Packing/unit effects | Extended inventory handling |
| `reference_type`, `reference_id` | Source | Polymorphic document association |
| `source_location`, `destination_location` | Transfer scope | Branch FKs |
| `notes`, `created_by`, timestamps | Audit | Metadata |

Canonical stock formula:

```text
SUM(stock_movements.quantity)
GROUP BY company_id, branch_id, product_id, variation_id
```

### 7.4 `inventory_balance`

Derived/cache columns include `company_id`, `branch_id`, `product_id`, `qty`, `boxes`, `pieces`, `unit`, and `updated_at`. `sync_inventory_balance_from_movement()` updates this cache after movement inserts.

Application policy is to use `stock_movements` first and consult `inventory_balance` only as a compatibility fallback where a company has no movement history.

---

## 8. Contacts

### 8.1 `contacts`

| Column group | Columns | Semantics |
|---|---|---|
| Identity/scope | `id uuid`, `company_id uuid`, optional `branch_id uuid` | Shared party master |
| Type | `type contact_type` | Customer, supplier, both, later worker |
| Identity | `name`, `code`, `email`, `phone`, `mobile`, `cnic`, `ntn`, `tax_number` | No core universal uniqueness on name/phone/email |
| Address | `address`, `city`, `state`, `country`, `postal_code` | Contact location |
| Balances | `opening_balance`, `supplier_opening_balance`, `current_balance`, `credit_limit`, `payment_terms` | Stored fields are operational/cache inputs, not GL truth |
| Organization | `group_id`, `contact_person`, `business_name` | Contact grouping/business data |
| Worker | `worker_role`, `worker_default_rate` | Worker-contact synchronization |
| Lead/public | `lead_source`, `referral_code`, `created_from`, `lead_status`, `assigned_to`, `device_info` | Public registration pipeline |
| Defaults/status | `is_default`, `is_active` | Walk-in/default protection and lifecycle |
| Audit | `created_by`, `created_at`, `updated_at` | Audit fields |

Contact relationships:

- `sales.customer_id`
- `purchases.supplier_id`
- `rentals.customer_id`
- `accounts.linked_contact_id`
- payment party/reference routing
- worker synchronization

Default-contact triggers seed/protect walk-in customers. Worker triggers mirror worker contacts to `workers`.

---

## 9. Rentals

### 9.1 `rentals`

| Column group | Columns | Semantics |
|---|---|---|
| Identity/scope | `id`, `company_id`, `branch_id` | PK and tenant/branch FKs |
| Number/date | `booking_no`/`rental_no`, `booking_date` | Numbering evolved to global/company/branch engines |
| Customer | `customer_id`, `customer_name` | Contact FK and snapshot |
| Lifecycle | `status`, `pickup_date`, `return_date`, `actual_return_date`, `duration_days` | Booking/pickup/active/returned/overdue/closed/cancelled |
| Amounts | `rental_charges`, `security_deposit`, `late_fee`, `damage_charges`, `discount_amount`, `total_amount`, `paid_amount`, `refund_amount` | Rental financial summary |
| Accounting | `journal_entry_id` | Linked accounting event |
| Commission | `salesman_id`, `commission_amount`, `commission_percent`, `commission_eligible_amount`, `commission_status`, `commission_batch_id` | Salesman commission lifecycle |
| Documents/audit | `attachments jsonb`, `notes`, `created_by`, timestamps | Metadata |

RLS is enabled/forced in relevant migrations and at minimum company-scoped; later permission scope depends on active policy generation.

### 9.2 `rental_items`

Core columns: `id`, `rental_id`, `product_id`, `variation_id`, product snapshot, `quantity`, `rate_per_day`, `duration_days`, `total`, `returned_quantity`, `condition_on_return`, `damage_amount`, `notes`, and `created_at`.

### 9.3 `rental_payments`

Later migrations add:

- `journal_entry_id` FK to `journal_entries` with `ON DELETE SET NULL`
- `payment_account_id` FK to `accounts` with `ON DELETE SET NULL`
- `voided_at`

Rental accounting includes customer AR subledger routing, rental payment posting, and devaluation journal RPCs.

---

# Part II — PostgreSQL RPC and Trigger Inventory

## 10. Inventory Method and Scope

All substantive routines are under root `migrations/`. The sole file found under `supabase/migrations/`—`20260508112229_restore_company_backup_rpc_transactional.sql`—is empty. Repeated `CREATE OR REPLACE FUNCTION` definitions are consolidated by logical signature below; dated replacement chains are identified where operationally important.

The following inventory includes public RPCs, trigger functions, security helpers, report functions, internal posting helpers, repair functions, and feature-domain procedures. Rollup bundles duplicate historical definitions and are not considered newer than later dated migrations.

## 11. Identity, Company, Branch, and Permission Routines

| Function/RPC family | Purpose |
|---|---|
| `get_user_company_id()` | Resolve normal or platform-selected company; latest platform-aware definition is in `20260720190000_platform_company_session_switch.sql` |
| `get_effective_company_id()` | Effective tenant context |
| `get_user_role()`, `get_user_role_normalized()` | Role lookup and normalization |
| `is_owner_or_admin()`, `is_admin_or_owner()` | Privileged-role predicates |
| `is_platform_company_operator()` | Platform operator detection |
| `has_permission(module, action)` | Canonical role/action matrix lookup |
| `has_module_permission(...)` | Older compatibility helper |
| `has_branch_access(uuid)` | Branch assignment check |
| `get_user_branch_id()` | Default/first branch resolution |
| `get_effective_user_branch(p_user_id)` | Effective branch lookup; security-definer target-ID concern documented later |
| `get_company_default_branch_id(company)` | Company default branch |
| `get_public_user_id(...)`, `get_user_public_id()` | Auth/public profile ID mapping |
| `ensure_my_default_branch()` | Self-service default assignment |
| `set_user_branches(...)` | Owner/admin branch assignment replacement |
| `set_user_account_access(...)` | Account-access assignment replacement |
| `list_platform_companies()` | Platform company listing |
| `set_platform_active_company(...)`, `clear_platform_active_company()`, `get_platform_active_company()` | Platform session switching |
| `generate_user_code(company)` | Company user-code allocation |

Associated triggers:

- `trigger_set_user_code_on_insert`
- `auto_assign_default_branch_on_user_insert`
- `auto_assign_default_branch_on_auth_link`
- `trigger_owner_protection`
- `set_*_created_by` on sales, purchases, payments, expenses, and journal entries
- immutable/protected creator triggers on sales and contacts

## 12. Company Defaults, Contacts, and Workers

Routines:

- `create_company_defaults()`
- `create_default_walkin_customer_for_company()`
- `create_default_walking_customer_for_branch()`
- `prevent_delete_default_customer()` / `contacts_protect_default_customer()`
- `backfill_default_walkin_customers()`
- `assign_contact_reference_number(contact)`
- `register_public_contact_v2(...)`
- `approve_public_contact_lead(contact)`
- `sync_worker_contact_to_workers()`
- `delete_worker_on_contact_delete()`
- `ensure_party_subledgers_for_contact(contact)`
- `_party_slug_from_contact(...)`
- `_ensure_ar_subaccount_for_contact(...)`
- `_ensure_ap_subaccount_for_contact(...)`
- `_ensure_worker_payable_subaccount(...)`

Triggers seed defaults after company/branch creation, prevent default-contact deletion, and synchronize worker contact mutations to worker records.

## 13. Numbering and Document Header RPCs

Numbering family:

- `erp_numbering_global_branch_sentinel()`
- `erp_document_default_prefix(document_type)`
- `generate_document_number(...)`
- `get_next_document_number_global(...)`
- legacy `get_next_document_number(...)`
- `erp_numbering_resolve_counter(...)`
- `erp_parse_voucher_numeric_suffix(...)`
- `erp_observed_max_document_suffix(...)`
- `erp_effective_sequence_max(...)`
- `sync_erp_document_sequences_to_effective_max(...)`
- `erp_numbering_uses_unified_voucher_counter(...)`
- `_sync_erp_sequence_after_duplicate(...)`
- `_sync_payment_sequence_after_duplicate(...)`
- `_sync_customer_receipt_sequence_after_duplicate(...)`
- `_sync_worker_payment_sequence_after_duplicate(...)`
- `merge_supplier_payment_sequence_forward()`
- `merge_supplier_payment_sequence_for_company(company)`
- `log_deleted_document_number(...)`
- `set_sale_invoice_number()`
- `set_rental_no()`

Document RPCs:

- `create_sale_document_header(...)`
- `create_purchase_document_header(...)`
- `create_expense_document(...)`
- `create_rental_booking(...)`
- `app_document_conversion_schema()`
- `generate_invoice_document(sale)`

Triggers `trigger_set_sale_invoice_number` and `trigger_set_rental_no` allocate numbers before inserts in applicable deployments.

## 14. Sales, Purchases, Stock, Returns, and Product RPCs

### 14.1 Canonical transaction routines

- `update_sale_with_items(...)` — atomically replaces sale details, recomputes totals, supports customization and bespoke links
- `update_purchase_with_items(...)` — replaces purchase details and derives payment state
- `record_sale_with_accounting(sale)` — canonical sale document JE
- `record_purchase_with_accounting(purchase)` — canonical purchase document JE
- `record_expense_with_accounting(expense)` — expense JE plus payment-row synchronization
- `_ensure_system_account(...)`, `ensure_sales_revenue_account(...)`, `ensure_erp_accounts(...)` — account bootstrap
- `cancel_sale_full_void(...)`
- `cancel_purchase_full_void(...)`
- `finalize_sale_return(...)`
- `recalc_sale_payment_totals(sale)`
- `recalc_purchase_payment_totals(purchase)`
- `set_sale_deadline(...)`

### 14.2 Inventory routines

- `handle_purchase_final_stock_movement()` — idempotent purchase IN movements
- `handle_sale_final_stock_movement()` — idempotent sale OUT movements; later bespoke-aware
- `ensure_sale_stock_movements(sale)` — repair/parity RPC
- `sync_inventory_balance_from_movement()` — derived cache updater
- `post_stock_adjustment_to_accounting()` — adjustment JE posting with cost fallback
- `get_company_negative_stock_allowed(company)` — business setting lookup
- Legacy `update_stock_on_purchase()` and `update_stock_on_sale()` are compatibility stubs, not canonical stock engines

### 14.3 Return/product routines

- `trg_sale_return_cap_guard()`
- sale/purchase return recalculation trigger functions
- `_sync_product_variation_attributes_json()`
- `get_combo_items(combo)`
- `is_combo_product(product, company)`
- `get_combo_id_for_product(product, company)`
- `update_product_combos_updated_at()`
- `get_product_image_signed_url(...)`

Primary triggers:

- `purchase_final_stock_movement_trigger`
- `sale_final_stock_movement_trigger`
- `trigger_sync_inventory_balance_from_movement`
- `trigger_post_stock_adjustment_to_accounting`
- sale/purchase return guard and recalculation triggers
- variation-attribute synchronization triggers
- product-combo timestamp trigger
- legacy purchase-total trigger

## 15. Payment and Journal Synchronization Routines

### 15.1 Payment RPCs

- `record_payment_with_accounting(...)` — canonical unified payment engine; latest chain blocks non-final sale payment and supports worker stages, contact subledgers, rentals, on-account payments, numbering, and atomic GL posting
- `record_customer_payment(...)` — customer receipt convenience path
- `payment_has_active_journal_for_company(payment)`
- `auto_create_payment_journal_entry()` — direct-insert trigger path; skips when canonical RPC owns GL posting
- Historical `create_payment_journal_entry(...)`
- payment allocation recalculation functions
- `extract_bank_trace_from_notes(...)`
- `format_short_payment_narration_before_insert()`
- `sync_payment_short_narration_to_journal_entry()`
- `sync_payment_notes_to_journal_on_update()`
- `_map_account_to_payment_method_enum(...)`
- `_ensure_expense_payment_row(...)`

### 15.2 Journal integrity functions

- `refresh_journal_entry_totals_from_lines()`
- `check_journal_entries_balance()`
- `_is_account_control_code(...)`
- `_resolve_je_party_contact_id(...)`
- `trg_reject_control_party_jel()`

### 15.3 Duplicate-posting suppression

`record_payment_with_accounting` sets a transaction-local configuration flag before inserting the payment. The payment `AFTER INSERT` trigger checks this flag and skips its own JE creation. This prevents the RPC and trigger from creating duplicate payment journals.

Triggers cover payment allocations, sale/purchase paid-total refresh, payment narration, JE narration synchronization, JE header-total refresh, and party-control-account guards.

## 16. AR/AP, Ledgers, Dashboards, and Reporting RPCs

### Party and contact accounting

- `get_contact_party_gl_balances(...)`
- `get_customer_ar_gl_ledger_for_contact(...)`
- `get_supplier_ap_gl_ledger_for_contact(...)`
- `get_contact_balances_summary(...)`
- `get_customer_ledger_sales(...)`
- `get_customer_ledger_payments(...)`
- `_gl_party_id_from_payment_row(...)`
- `_gl_resolve_party_id_for_journal_entry(...)`
- `_gl_ledger_line_display_description(...)`
- `get_control_unmapped_party_gl_buckets(...)`
- `count_unmapped_ar_ap_journal_entries(...)`
- `count_unmapped_ar_ap_journal_entries_split(...)`
- `ar_ap_integrity_lab_snapshot(...)`
- `ensure_ar_ap_reconciliation_suspense_account(...)`
- reconciliation workflow upsert/review routines
- `ar_ap_receivables_variance_breakdown(...)`
- `get_customers_suppliers_report(...)`

### Unified journal-derived reads

- `_unified_ledger_assert_caller_access(...)`
- `_unified_ledger_basis_includes_row(...)`
- `_unified_ledger_strict_branch_includes_row(...)`
- `_unified_ledger_is_liquidity_account(...)`
- `get_unified_party_ledger(...)`
- `get_unified_account_ledger(...)`
- `get_unified_cash_bank_ledger(...)`
- `get_unified_trial_balance(...)`
- `get_unified_contact_party_gl_balances(...)`
- `get_single_core_ledger_systemwide_diagnostics()`

### Dashboard/report routines

- `get_financial_dashboard_metrics(...)`
- `get_dashboard_metrics(...)`
- `get_dashboard_v2_snapshot(...)`
- `get_low_stock_products(...)`
- `get_account_balances_as_of(...)`
- `get_erp_health_dashboard()`
- `get_erp_health_dashboard_permission_checks()`
- integrity counts for final sales and posted purchases missing canonical JEs

Unified RPCs are read projections over journal truth. They do not define another ledger.

## 17. Studio, Manufacturing, and Bespoke RPCs

Studio routines include sale charge summaries, stage listings, sale charge synchronization, worker assignment/send/receive/finalize/payment/reopen operations, note appenders, and manufacturing timestamp helpers. Key names include:

- `get_sale_studio_charges`, batch and summary variants
- `get_sale_studio_cost_from_tasks`
- `get_studio_stages_for_sale`
- `sync_sale_studio_charges_for_sale`
- `sync_studio_order_total_cost`
- `rpc_assign_worker_to_stage`
- `rpc_send_to_worker`
- `rpc_receive_work`
- `rpc_receive_stage_and_finalize`
- `rpc_confirm_stage_payment`
- `rpc_reopen_stage`
- send/receive note fragment helpers

Bespoke routines:

- `seed_bespoke_generic_products`
- `set_company_customization_enabled`
- `seed_business_settings_for_company`
- `complete_bespoke_work_order`
- `update_bespoke_work_order`
- `reopen_bespoke_work_order`
- `cancel_bespoke_work_order_stock`
- `cancel_bespoke_work_order`
- `snapshot_bespoke_work_order_anchors`
- `relink_bespoke_work_orders_for_sale`
- timestamp trigger function

These functions coordinate sale-item parent links, child-material consumption, finished-parent stock, stage payments, and studio charge synchronization.

## 18. Rental, Courier, Shipment, and Activity RPCs

- `record_rental_expense_devaluation_journal(...)`
- `get_or_create_courier_payable_account(...)`
- `post_sale_shipment_journal(...)`
- `sync_sale_shipment_charges(sale)`
- shipment synchronization trigger function
- `log_sale_action(...)`
- `log_share(...)`
- `log_print(...)`
- `log_sale_activity()`
- `log_activity(...)`

Shipment triggers synchronize sale charges after shipment mutation. Rental/courier routines post through canonical accounts and journal tables.

## 19. Backup, Reset, Settings, and Repair RPCs

Administrative routines:

- `export_company_backup_rpc(company)`
- `restore_company_backup_rpc(company, backup, confirmation)`
- `_company_reset_resolve_options(options)`
- `preview_company_transaction_reset(...)`
- `execute_company_transaction_reset(...)`
- feature flag and salary-setting timestamp functions
- `backfill_salary_settings_from_employees(...)`

Controlled repair functions include:

- `amounts_close(...)`
- `developer_repair_relink_payment_je(...)`
- FNV/hash and canonical JSON helpers
- `create_gl_correction_journal(...)`
- rental 1100 leakage detection/dry-run/correction helpers

These mutate canonical tables only under diagnostic, hash, confirmation, or repair workflows and are not normal posting entry points.

## 20. Import FX Routine Family

The newest large routine family is organized into:

1. Feature/currency gates and write triggers
2. Path 21 FX currency purchase and settlement
3. Import FX case W1/W2/W2.1 planning and assignment
4. W3/W3.1 advance, acquisition, custody routing, and reversal

Representative functions:

- Currency normalization and company feature/currency checks
- `assert_can_disable_import_fx`
- purchase/payment/settlement write-guard trigger functions
- TT-agent wallet classification
- `record_fx_currency_purchase_on_credit`
- `apply_fx_currency_purchase_settlement`
- active-settlement recomputation/inactivation
- idempotent client-operation claim/finalize/release
- case company/branch access helpers
- `create_import_fx_case`, `update_import_fx_case_draft`, stage confirmation/cancellation/list/get/link/attachment/assignment RPCs
- W2/W2.1 funding, party, arrangement, and agent-validation helpers
- W3 clearing/source/lock/status helpers
- `post_import_fx_agent_advance`
- `post_import_fx_usd_acquisition`
- routing/custody variant
- advance/acquisition reversal RPCs

Latest overload cleanup is performed by `20260815140000_import_fx_vps_migrate_chain_repair.sql`; W3.1 custody definitions are in the `20260815150100` and `20260815150200` migrations.

---

# Part III — TypeScript Service Layer Mapping

## 21. Canonical Accounting Services

| Web service | Tables/RPCs | Architectural role |
|---|---|---|
| `accountingCanonicalGuard.ts` | Declares `accounts`, `journal_entries`, `journal_entry_lines`; rejects duplicate/legacy stores | Canonical policy guard |
| `documentPostingEngine.ts` | Reads sales/purchases/charges and active JEs; delegates posting/rebuild/reversal | Single document-accounting orchestrator |
| `saleAccountingService.ts` | Reads sales items/products/movements/accounts; writes JE headers/lines | Canonical sale revenue, AR, COGS, inventory, charges posting |
| `purchaseAccountingService.ts` | Reads purchases/accounts/JEs; writes JE headers/lines | Canonical inventory/AP/capitalized-charge posting and reversal |
| `recordPaymentWithAccountingRpc.ts` | Calls `record_payment_with_accounting` | Preferred atomic payment + GL write path |
| `expenseService.ts` | `expenses`; `create_expense_document`, `record_expense_with_accounting` | Expense source and accounting posting |
| `openingBalanceJournalService.ts` | `stock_movements`, accounts, journals | Opening stock quantity-to-GL bridge |
| `stockAdjustmentJournalService.ts` | Movement and journal tables | Manual adjustment GL bridge |
| `accountingService.ts` | Canonical journal tables plus party-ledger RPCs | Core accounting access with some compatibility fallbacks |
| `accountingReportsService.ts` | Canonical journal tables; `get_account_balances_as_of`; sale-line compatibility | GL reporting |

### 21.1 Canonical sale path

```text
saleService
  |-- writes sales + sales_items
  |-- creates/updates payment through canonical payment RPC
  |-- coordinates stock movements
  `-- documentPostingEngine.postSaleDocumentAccounting
          `-- saleAccountingService
                  `-- accounts + journal_entries + journal_entry_lines
```

Rebuild soft-voids active canonical sale document JEs and posts a fresh document JE. Payment JEs are intentionally excluded through `payment_id IS NULL` and separate reference semantics. Cancellation preserves audit history by creating a reversal rather than deleting original journals.

### 21.2 Canonical purchase path

```text
purchaseService
  |-- writes purchases + purchase_items + purchase_charges
  |-- coordinates stock movements
  `-- documentPostingEngine.postPurchaseDocumentAccounting
          `-- purchaseAccountingService
                  `-- accounts + journal_entries + journal_entry_lines
```

Purchase cancellation creates debit/credit-swapped reversal lines against the original active document JE.

### 21.3 Canonical payment path

```text
recordPaymentWithAccountingRpc
  `-- RPC record_payment_with_accounting
      |-- payment row
      |-- document/contact/worker/rental routing
      |-- reference number
      |-- JE header + lines
      `-- local trigger-suppression flag
```

A direct eligible payment insert can still invoke the legacy-compatible auto-JE trigger. The application-preferred route is the RPC because it is atomic and suppresses duplicate trigger posting.

## 22. Inventory and Operational Services

| Service | Primary mapping | Role |
|---|---|---|
| `inventoryService.ts` | `stock_movements`; fallback `inventory_balance`; products/variations/units | Canonical stock reader/writer |
| `documentStockSyncService.ts` | Sales/purchase details and `stock_movements` | Detects and inserts corrective movements |
| `saleService.ts` | `sales`, `sales_items`, fallback `sale_items`, stock/payment/accounting orchestration | Operational sale writer |
| `purchaseService.ts` | `purchases`, `purchase_items`, `purchase_charges`, `stock_movements` | Operational purchase writer |
| `productService.ts` | Products, variations, movements; `get_low_stock_products` | Product master and inventory presentation |
| `saleReturnService.ts` | Sale returns, return lines, stock, accounting RPCs | Return lifecycle |
| `purchaseReturnService.ts` | Purchase returns, stock/accounting paths | Return lifecycle |
| `rentalService.ts` | Rentals/items/payments, stock, `create_rental_booking` | Rental lifecycle |

Opening stock writes a `stock_movements` row with `reference_type='opening_balance'`, then creates its financial journal through `openingBalanceJournalService`. Quantity and financial value remain separate but linked canonical ledgers.

## 23. Unified vs Legacy Read Paths

`unifiedLedgerService.ts` calls:

- `get_unified_party_ledger`
- `get_unified_account_ledger`
- `get_unified_cash_bank_ledger`
- `get_unified_trial_balance`

Main loaders call with `shadowForce: false`; preview/tie-out loaders use `shadowForce: true`. Kill switches and feature flags decide whether unified output is used in production or only compared in shadow mode.

Unified main services include account statements, party ledgers, cash flow, trial balance, balance sheet/P&L, Roznamcha, and Ledger Statement Center V2. Legacy-shadow services retain old loaders only for comparison.

> Unified is a read architecture over canonical journal rows—not a competing write model.

### 23.1 Compatibility reads

- `sales_items` preferred; `sale_items` fallback
- `stock_movements` preferred; `inventory_balance` only when no movements exist
- Reporting RPC preferred; canonical journal-side client calculation can be fallback
- Stored `balance/current_balance` fields are UI/cache/reconciliation values
- Legacy duplicate subledgers are explicitly rejected by `accountingCanonicalGuard`

### 23.2 Repair paths

Integrity, developer-repair, GL-correction, payment lifecycle, and duplicate-repair services may directly mutate canonical JE rows. They are controlled maintenance paths, not ordinary business-posting alternatives.

---

# Part IV — Web and Mobile Parity

## 24. Shared Backend, Separate Client Implementations

Web uses `src/app/services`; mobile uses `erp-mobile-app/src/api`. They share Supabase tables/RPC contracts but do not share the same TypeScript service package. Direct Supabase calls also exist in Web contexts/components and mobile libraries/components, so neither service directory is a complete data-access boundary.

| Domain | Web | Mobile | Parity |
|---|---|---|---|
| Sales/POS | `saleService`, accounting/posting services, `SalesContext` | `api/sales.ts`, edit accounting and mutation APIs | Same records; separate edit/cancel/offline orchestration |
| Purchases | `purchaseService`, purchase accounting/return services | `api/purchases.ts`, edit accounting, sync | Broad parity; independently implemented |
| Expenses | `expenseService`, `ExpenseContext` | `api/expenses.ts`, accounting patches | Shared RPCs; mobile has compatibility/retry paths |
| Payments | Shared payment dialogs/services | `api/accounts.ts`, courier/transaction APIs | Same canonical RPC; different UI permission semantics |
| Accounting | Full reports, diagnostics, integrity/repair | accounts, balances, unified reports, Roznamcha | Same journal model; Web much broader |
| Contacts | `contactService`, ledger services | contacts/customer ledger/balance RPC APIs | Strong backend parity |
| Products/stock | product/inventory/transfer/report services | products/inventory/stock-fetch/variation APIs | Strong schema parity; branch-null presentation differs |
| Rentals | broad rental/accounting/availability services | rentals and rental accounting APIs | Same lifecycle; Web more mature |
| Studio | Multiple V1/V2/V3 services | studio and stock lifecycle APIs | Partial parity across multiple table generations |
| Reports | Extensive accounting/dashboard/report services | dashboard metrics and unified reports | Shared key RPCs; Web deeper |
| Users/branches | user/branch/permission administration | users/employees/branches/permissions | Same backend; mobile has dual-ID compatibility/cache |
| Settings/numbering | settings and modules services | settings, numbering, device settings | Core parity; device controls mobile-only |
| Import FX | Full active workflow | No equivalent full operator suite identified | Web-dominant/new feature |

### 24.1 Explicit shared RPC contracts

Both clients use or mirror contracts such as:

- `create_business_transaction`
- `create_expense_document`
- `record_payment_with_accounting`
- `generate_document_number`
- `get_next_document_number_global`
- `get_contact_balances_summary`
- `get_financial_dashboard_metrics`
- `get_dashboard_metrics`
- `get_effective_user_branch`
- platform-company session RPCs
- bespoke work-order lifecycle RPCs

### 24.2 Web-dominant capabilities

- Accounting integrity labs and repair
- Reconciliation and developer diagnostics
- Deep financial reports
- Multiple Studio generations
- Full permission-matrix administration
- Import FX operator workflows
- Backup/restore and company-reset tooling

### 24.3 Mobile-specific capabilities

- Offline sales/purchase/expense/payment/journal synchronization
- Session branch caching
- Printer/scanner/barcode/device settings
- Mobile attachment helpers
- Mobile permission feature flags

Offline replay increases the importance of idempotent server RPCs. Direct multi-step client writes are more vulnerable to partial retries than single transactional RPCs.

---

# Part V — RLS and Permission Architecture

## 25. Company Isolation

Canonical policy predicate:

```sql
company_id = get_user_company_id()
```

The latest `get_user_company_id()` respects a platform operator’s selected company session, otherwise resolves the caller through `public.users.auth_user_id` with compatibility fallback.

Both clients also commonly send `.eq('company_id', companyId)` or pass `p_company_id`; this is defense in depth, not a replacement for RLS.

### 25.1 Company-level gap: global `role_permissions`

`role_permissions` uses:

```text
PRIMARY KEY(role, module, action)
```

It has no `company_id`. Authenticated users can read the matrix; owner/admin can mutate it. Therefore a tenant owner/admin change affects the same role globally across all companies. The architecture must choose one explicit model:

1. Platform-controlled global matrix, not tenant-writable; or
2. Tenant-scoped matrix keyed by `(company_id, role, module, action)`.

The current hybrid is a cross-tenant configuration risk.

## 26. Branch Isolation

The intended newer identity model is:

```text
user_branches.user_id = auth.users.id = auth.uid()
```

Older migrations sometimes join `user_branches.user_id` to `public.users.id`. Some RPCs support both forms. Because helper functions may be created only if absent or replaced under different migration sequences, the deployed helper definitions must be inspected.

Common branch predicate:

```sql
branch_id IS NULL
OR EXISTS (
  SELECT 1
  FROM user_branches ub
  WHERE ub.user_id = auth.uid()
    AND ub.branch_id = row.branch_id
)
```

Null branch is normally treated as company-wide/legacy. Web stock scoping follows this. Mobile includes null rows in single-branch scope but can exclude them in multi-accessible-branch scope, causing list/count parity differences.

### 26.1 Effective-branch RPC concern

`get_effective_user_branch(p_user_id)` is `SECURITY DEFINER`, executable by authenticated users, and accepts a supplied target identity. The inspected definition does not strictly enforce that the target is the caller. It should resolve `auth.uid()` internally or restrict arbitrary target lookups to same-company owner/admin/platform roles.

### 26.2 Branch metadata vs assignment

The branch SELECT policy can expose all branch metadata within a company. Clients must not interpret “RLS-visible branch” as “assigned operational branch.” Mobile helpers that merge visible branch IDs into accessible IDs must remain restricted to company-wide roles.

## 27. Role and Action Permissions

Database role normalization:

- owner → owner
- admin → admin
- manager/accountant → manager
- other operational roles → user

The action vocabulary includes:

- `sales`
- `pos`
- singular `purchase`
- `studio`
- `rentals`
- `payments`
- `ledger`
- `inventory`
- `contacts`
- `reports`
- `users`
- `settings`

`has_permission(module, action)` is fail-closed for missing rows and grants owner/admin bypass.

Visibility actions are:

- `view_company`
- `view_branch`
- `view_own`

Later generic policies prioritize company, then branch, then own scope to avoid ambiguous overlap.

### 27.1 Web permission behavior

Web reads raw rows but derives coarse booleans and caches them for up to 24 hours. Confirmed granularity loss includes Studio, rentals, payments, and ledger/accounting actions. This can show controls that a specific action does not allow or hide controls that it does.

Permission changes from another client/SQL session may remain stale unless cache invalidation runs. Bulk matrix updates are multiple independent upserts and can leave partial global state on failure.

### 27.2 Mobile permission behavior

Mobile retains more raw action details and generally fails closed to an empty matrix on fetch errors, but the error is hidden. A device-local feature flag can disable Permission V2 and activate a legacy state that behaves like broad owner/admin UI access. RLS still protects correctly secured database objects, but exposed controls become dangerous wherever RLS is incomplete. Production fallback should fail closed.

## 28. Domain Policy Summary

| Domain | Typical active intent | Key caveat |
|---|---|---|
| Sales | Company + company/branch/own SELECT + action checks for create/edit/delete | Multiple historical policy names may coexist and combine permissively |
| Purchases | Scoped SELECT in later migration | Older company-wide CRUD policies may remain active |
| Rentals | Company/scope policies | Write actions may not consistently call `has_permission` |
| Expenses | Company/scope policies | Company-wide write generations exist |
| Payments | Permission and scope rewrites | ID-only client updates rely heavily on correct deployed RLS |
| Contacts | Several strict/role/scope policy generations | True branch isolation may be impossible where active schema lacks meaningful branch assignment |
| Accounts | Company-wide for privileged roles; `user_account_access` for others | Separate from `ledger` permission matrix; UI and DB visibility can disagree |
| Stock movements | Effective company + owner/admin or assigned/null branch | Multiple INSERT policies can OR together |
| Studio | Separate surfaces for orders, productions, V2/V3 tables, and studio sales | Protection of one Studio table does not protect all generations |
| Bespoke work orders | Company-only SELECT/INSERT/UPDATE in inspected migration | No branch or action enforcement; DELETE is fail-closed |

### 28.1 PostgreSQL policy accumulation risk

PostgreSQL permissive policies combine with OR semantics. Migrations in this repository repeatedly replace policy logic under different names. Dropping one policy name does not remove other permissive policies. The live database must be audited through `pg_policies`; migration source alone cannot prove effective access.

### 28.2 Own-scope null creator risk

Some own-scope policies allow `created_by IS NULL OR created_by = auth.uid()`. This exposes legacy/system rows to every own-scope user in the company. Null creators should be backfilled, admin-only, or governed by an explicit system-row rule.

---

# Part VI — Canonical Write/Read Decision Matrix

## 29. Accounting

| Operation | Use | Do not treat as truth |
|---|---|---|
| Sale document post/rebuild/reverse | `documentPostingEngine` → sale accounting / canonical posting RPC | Direct balance mutations or duplicate sale subledgers |
| Purchase document post/rebuild/reverse | `documentPostingEngine` → purchase accounting / canonical posting RPC | `chart_accounts`/`account_transactions` |
| Payment | `record_payment_with_accounting` | Independent payment insert plus separate client JE unless explicitly controlled |
| Expense | `create_expense_document` + `record_expense_with_accounting` | Stored contact/account balance fields |
| Account/party ledger read | Unified journal RPC when enabled; canonical journal fallback | Legacy ledger tables as GL truth |
| Trial balance/P&L/BS | Journal lines and canonical report/unified RPCs | Operational totals alone |
| Correction | Controlled integrity/repair RPC/service | Editing historical balances directly |

## 30. Inventory

| Operation | Canonical path |
|---|---|
| Current quantity | Sum `stock_movements.quantity` by scope/item/variation |
| Sale finalization | Idempotent OUT movement trigger/RPC/service |
| Purchase receipt/finalization | Idempotent IN movement trigger/RPC/service |
| Cancellation | Compensating movement preserving history |
| Opening stock | Opening-balance movement, then financial JE sync |
| Adjustment | Movement plus stock-adjustment JE trigger/service |
| Cache | `inventory_balance`, derived from movement inserts |

---

# Part VII — Planning Risks and Verification Checklist

## 31. Highest-Priority Risks

1. `sales_items` vs `sale_items` divergence.
2. `accounts` vs `chart_accounts` and other duplicate ledgers.
3. Multiple incompatible journal definitions in historical schemas.
4. Global tenant-writable `role_permissions`.
5. Historical auth-ID vs public-user-ID branch assignment conflict.
6. Security-definer effective-branch RPC accepting arbitrary user ID.
7. Multiple permissive RLS policies surviving under different names.
8. Company-only write policies on purchases/rentals/expenses/bespoke paths.
9. Mobile Permission V2 legacy fallback elevating UI state.
10. Web permission action collapsing and 24-hour stale cache.
11. Direct Supabase calls outside nominal Web/mobile service boundaries.
12. Offline replay against non-idempotent multi-step writes.
13. Stored balance/stock fields being mistaken for journal/movement truth.
14. Migration source differing from live deployed catalog.

## 32. Mandatory Live-Database Verification

Before deep accounting, inventory, permission, or migration work, query the live database for:

- `information_schema.columns`
- `pg_constraint`
- `pg_indexes`
- `pg_proc` and `pg_get_functiondef`
- `pg_trigger` and `pg_get_triggerdef`
- `pg_policies`
- table/function grants
- function owner and `SECURITY DEFINER` status
- applied migration-history table
- actual presence and row counts of `sales_items` and `sale_items`
- duplicate active document JEs
- trigger bindings for sale/purchase stock and payment auto-posting
- deployed definitions of company/branch identity helpers

## 33. Change-Impact Procedure

For any new task:

1. Identify the operational document and exact lifecycle transition.
2. Trace Web component/context → TypeScript service → table/RPC.
3. Trace the equivalent mobile API/offline handler.
4. Verify effective live table columns, constraints, RPC body, and triggers.
5. Confirm tenant, branch, role/action, and own-scope enforcement.
6. For financial changes, trace document JE, payment JE, reversal, void, edit/rebuild, and reporting behavior separately.
7. For stock changes, trace original and compensating movements, variation/branch scope, and derived cache updates.
8. Prefer an idempotent transactional RPC for multi-table/offline-sensitive writes.
9. Avoid legacy stores and stored balance fields as authoritative inputs.
10. Run parity and integrity checks after the focused change.

---

## 34. Final Technical Position

The system’s intended modern architecture is coherent when reduced to four rules:

1. **Operational documents describe business events.**
2. **`journal_entries` plus `journal_entry_lines` are financial truth.**
3. **`stock_movements` is inventory quantity truth.**
4. **Unified services are journal-derived readers, not alternative writers.**

The largest complexity comes from historical schema generations, compatibility fallbacks, many incremental function replacements, and fragmented RLS evolution. Future planning should treat the dated migration chain and static source as architectural evidence, but treat the live PostgreSQL catalog as the final authority.
