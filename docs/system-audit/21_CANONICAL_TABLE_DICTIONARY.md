# 21 — Canonical Table Dictionary

**Last updated:** 2026-04-12
**App:** NEWPOSV3 (Din Couture ERP)
**Stack:** Next.js 14 + Supabase (PostgreSQL + RLS), TypeScript
**Scope:** Every live table in the `public` schema — columns, types, constraints, RLS stance, canonical role, and cross-references.

---

## How to read this document

Each table entry contains:

- **Canonical role** — what this table is the authoritative source of truth for.
- **Source of truth warning** — fields that look like balances but are caches (never use for financial reporting).
- **Key columns** — name, type, nullability, and purpose.
- **Constraints & indexes** — PK, FK, unique, partial indexes.
- **RLS policy summary** — who can read/write.
- **Primary service(s)** — which service files own this table.
- **Related tables** — upstream and downstream dependencies.

---

## Domain Groups

1. [Business / Tenant](#1-business--tenant)
2. [Users & Auth](#2-users--auth)
3. [Contacts / CRM](#3-contacts--crm)
4. [Products & Inventory](#4-products--inventory)
5. [Sales](#5-sales)
6. [Purchases](#6-purchases)
7. [Sale Returns](#7-sale-returns)
8. [Purchase Returns](#8-purchase-returns)
9. [Rentals](#9-rentals)
10. [Payments](#10-payments)
11. [Accounting / GL](#11-accounting--gl)
12. [Expenses](#12-expenses)
13. [Studio Production](#13-studio-production)
14. [Manufacturing](#14-manufacturing)
15. [Workers / Payroll](#15-workers--payroll)
16. [Shipments & Packing](#16-shipments--packing)
17. [Sequences & Numbering](#17-sequences--numbering)
18. [Settings & Config](#18-settings--config)
19. [Audit & Integrity](#19-audit--integrity)
20. [Legacy Tables (do not use)](#20-legacy-tables-do-not-use)

---

## 1. Business / Tenant

### `companies`

**Canonical role:** Single row per tenant. Root of all multi-tenant isolation. Every other business table has a `company_id` FK pointing here.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. `uuid_generate_v4()`. |
| `name` | VARCHAR(255) | NOT NULL | Display name of the business. |
| `logo_url` | TEXT | NULL | URL to company logo (storage bucket). |
| `email` | VARCHAR(255) | NULL | Primary business email. |
| `phone` | VARCHAR(50) | NULL | Primary phone. |
| `address` | TEXT | NULL | Street address. |
| `city` | VARCHAR(100) | NULL | City. |
| `state` | VARCHAR(100) | NULL | State / Province. |
| `country` | VARCHAR(100) | NULL | Defaults to `'Pakistan'`. |
| `postal_code` | VARCHAR(20) | NULL | Postal / ZIP code. |
| `tax_number` | VARCHAR(100) | NULL | NTN or VAT registration. |
| `currency` | VARCHAR(10) | NULL | Defaults to `'PKR'`. |
| `financial_year_start` | DATE | NULL | Defaults to `2024-01-01`. Fiscal year anchor for P&L periods. |
| `modules_config` | JSONB | NULL | Module toggles: `rentalModuleEnabled`, `studioModuleEnabled`, `accountingModuleEnabled`, `productionModuleEnabled`, `posModuleEnabled`, `combosEnabled`. Read by `SettingsProvider` to gate module access. |
| `is_active` | BOOLEAN | NOT NULL | Soft-delete flag. Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated by trigger. |

**Constraints:** PK on `id`. No cross-tenant RLS since this table IS the tenant root.
**Primary service:** `businessService.ts`, `settingsService.ts`, `globalSettingsService.ts`
**Notes:** `modules_config` is the canonical source for which modules are enabled. The legacy `modules_config` table (standalone) is redundant — prefer this JSONB column.

---

### `branches`

**Canonical role:** Physical locations under a company. Every transaction is scoped to a branch.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `name` | VARCHAR(255) | NOT NULL | Branch display name (e.g. "Main Branch (HQ)"). |
| `code` | VARCHAR(50) | NOT NULL | Short identifier (e.g. "HQ"). UNIQUE. |
| `email` | VARCHAR(255) | NULL | Branch email. |
| `phone` | VARCHAR(50) | NULL | Branch phone. |
| `address` | TEXT | NULL | Physical address. |
| `city` | VARCHAR(100) | NULL | City. |
| `manager_id` | UUID | NULL | FK → `users.id` (added post-schema). |
| `default_cash_account_id` | UUID | NULL | FK → `accounts.id`. The default Cash account for POS payments at this branch. |
| `default_bank_account_id` | UUID | NULL | FK → `accounts.id`. Default Bank account. |
| `default_pos_drawer_account_id` | UUID | NULL | FK → `accounts.id`. POS drawer/till account (may differ from general cash). |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. Inactive branches are hidden from UI dropdowns. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated by trigger. |

**Constraints:** PK `id`; UNIQUE `code`; FK `company_id`; FK `manager_id`.
**RLS:** Company-scoped. Users can only read branches belonging to their own `company_id`.
**Primary service:** `branchService.ts`
**Notes:** Branch count determines access mode. One active branch = AUTO mode (branch auto-assigned). Two or more = RESTRICTED mode (user must select via `GlobalFilterContext.branchId`). Branch creation triggers COA seed (`defaultAccountsService`) and Walk-in Customer creation.

---

### `feature_flags`

**Canonical role:** Per-company feature toggles for DB-backed (non-UI) features. Missing row = feature disabled.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `feature_key` | VARCHAR(100) | NOT NULL | Identifier string. Known values: `studio_production_v2`, `studio_production_v3`, `studio_customer_invoice_v1`. |
| `enabled` | BOOLEAN | NOT NULL | Defaults `false`. Safe rollback: set `false` to revert. |
| `description` | TEXT | NULL | Human-readable description. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated by trigger. |

**Constraints:** PK `id`; UNIQUE `(company_id, feature_key)`.
**RLS:** SELECT allowed for all authenticated users in the company. INSERT/UPDATE/DELETE restricted to `admin` and `owner` roles.
**Primary service:** `featureFlagsService.ts`

---

## 2. Users & Auth

### `users`

**Canonical role:** Application user profiles, linked to Supabase Auth (`auth.users`). Every action in the ERP is attributed to a `users.id`.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. Same UUID as `auth.users.id`. FK → `auth.users(id)` CASCADE. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `email` | VARCHAR(255) | NOT NULL | UNIQUE. Must match `auth.users.email`. |
| `full_name` | VARCHAR(255) | NOT NULL | Display name. |
| `phone` | VARCHAR(50) | NULL | Phone. |
| `role` | user_role | NOT NULL | Enum: `admin`, `manager`, `accountant`, `salesperson`, `inventory_clerk`, `viewer`. Defaults `viewer`. |
| `branch_id` | UUID | NULL | Default branch for this user (legacy column; superseded by `user_branches`). |
| `avatar_url` | TEXT | NULL | Profile image URL. |
| `default_commission_percent` | NUMERIC | NULL | Commission rate for this user (used in commission reports). |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `last_login` | TIMESTAMPTZ | NULL | Updated on auth events. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated by trigger. |

**Constraints:** PK `id`; UNIQUE `email`; FK `company_id`; FK `auth.users(id)`.
**RLS:** Complex. Users can read their own row. Admins/owners can read all rows in their company. INSERT restricted to `SECURITY DEFINER` function during signup. Write-access guarded by role. See `fix-rls-users-table-critical.sql` for the final policy.
**Primary service:** `userService.ts`
**Notes:** `users.role` is the primary role for RBAC. `role_permissions` table stores per-company overrides. The three-layer permission system (FeatureFlags / ModuleContext / PermissionEngine) all eventually resolve to this row.

---

### `user_branches`

**Canonical role:** Many-to-many join: which branches a user is permitted to access in RESTRICTED mode.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `user_id` | UUID | NOT NULL | FK → `users.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id` CASCADE. |
| `is_default` | BOOLEAN | NULL | Marks the user's preferred default branch. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; UNIQUE `(user_id, branch_id)`.
**RLS:** Admins can manage; users can read their own rows.
**Primary service:** `userService.ts`

---

### `role_permissions`

**Canonical role:** Per-company RBAC overrides. Maps `(company_id, role, permission_key)` → boolean. Missing row = use system default for that role.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `role` | TEXT | NOT NULL | Role name (matches `users.role`). |
| `permission_key` | TEXT | NOT NULL | Identifier for the permission (e.g. `can_view_reports`, `can_delete_sales`). |
| `granted` | BOOLEAN | NOT NULL | `true` = allowed; `false` = explicitly denied. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `(company_id, role, permission_key)`.
**RLS:** Company-scoped. Admins/owners can write; all authenticated users can read their company's rows.
**Primary service:** `permissionService.ts`, `permissionEngine.ts`

---

## 3. Contacts / CRM

### `contacts`

**Canonical role:** Master record for customers, suppliers, workers, and other parties. Every AR/AP balance, sale, purchase, and payment links back here.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. Also used as `workers.id` for worker-type contacts (same entity, same UUID). |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `type` | contact_type | NOT NULL | Enum: `customer`, `supplier`, `both`. Extended by `worker_role` column for worker contacts. |
| `name` | VARCHAR(255) | NOT NULL | Display name. |
| `email` | VARCHAR(255) | NULL | Email address. |
| `phone` | VARCHAR(50) | NULL | Primary phone. |
| `mobile` | VARCHAR(50) | NULL | Mobile / WhatsApp. |
| `cnic` | VARCHAR(50) | NULL | National ID (Pakistan). |
| `ntn` | VARCHAR(50) | NULL | Tax registration number. |
| `address` | TEXT | NULL | Street address. |
| `city` | VARCHAR(100) | NULL | City. |
| `state` | VARCHAR(100) | NULL | State/Province. |
| `country` | VARCHAR(100) | NULL | Defaults `Pakistan`. |
| `opening_balance` | DECIMAL(15,2) | NULL | Opening balance seed (at company setup). Do not use as live GL balance. |
| `current_balance` | DECIMAL(15,2) | NULL | **CACHE ONLY — DO NOT USE FOR GL REPORTING.** Denormalized AR/AP balance updated on payment events. Diverges when JEs are posted manually or payment allocation fails. Use `journal_entry_lines` net on account 1100 / 2000 subledger instead. |
| `credit_limit` | DECIMAL(15,2) | NULL | Maximum credit exposure for this customer. |
| `payment_terms` | INTEGER | NULL | Net days (e.g. 30 = Net 30). |
| `contact_group_id` | UUID | NULL | FK → `contact_groups.id`. Optional grouping/tag. |
| `is_walk_in` | BOOLEAN | NULL | `true` for the system-generated Walk-in Customer record. Exactly one per company (idempotent creation). |
| `worker_role` | VARCHAR(50) | NULL | Worker specialization for `type = 'worker'` contacts (e.g. `tailor`, `cutter`). |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated by trigger. |

**Constraints:** PK `id`; FK `company_id`; FK `contact_group_id`.
**Indexes:** `(company_id)`, `(type)`, `(name)`, `(company_id, is_active)`.
**RLS:** Company-scoped (users can only see contacts in their own company).
**Primary service:** `contactService.ts`, `publicContactService.ts`
**Source of truth warning:** `contacts.current_balance` must not be used as a financial figure. The canonical AR balance per contact is computed from `journal_entry_lines` WHERE account is the party subledger child of account 1100 (AR) or 2000 (AP). See doc 18 §5-6.

---

### `contact_groups`

**Canonical role:** Optional grouping/tag for contacts (e.g. VIP, Wholesale, Retail).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `name` | VARCHAR(255) | NOT NULL | Group label. |
| `description` | TEXT | NULL | Optional notes. |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; UNIQUE `(company_id, name)`.
**Primary service:** `contactGroupService.ts`

---

## 4. Products & Inventory

### `products`

**Canonical role:** Master product catalog. Every line item on a sale, purchase, or return references a product.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `category_id` | UUID | NULL | FK → `product_categories.id`. |
| `brand_id` | UUID | NULL | FK → `brands.id`. |
| `unit_id` | UUID | NULL | FK → `units.id`. |
| `name` | VARCHAR(255) | NOT NULL | Product display name. |
| `sku` | VARCHAR(100) | NOT NULL | Stock keeping unit. UNIQUE per company (enforced in app). |
| `barcode` | VARCHAR(100) | NULL | Barcode for scanning. |
| `description` | TEXT | NULL | Product description. |
| `cost_price` | DECIMAL(15,2) | NULL | Static purchase cost. **Used for COGS JE at point of sale — does not update on purchase receipts. Weighted average not implemented (P2-01 open bug).** |
| `retail_price` | DECIMAL(15,2) | NULL | Default selling price. |
| `wholesale_price` | DECIMAL(15,2) | NULL | Wholesale selling price. |
| `rental_price_daily` | DECIMAL(15,2) | NULL | Daily rental rate. |
| `current_stock` | DECIMAL(15,2) | NULL | **CACHE ONLY.** Running balance updated synchronously on stock events. Can diverge on partial transaction failure. Canonical qty = `SUM(stock_movements.quantity_change)` for this product. |
| `min_stock` | DECIMAL(15,2) | NULL | Minimum stock threshold for reorder alerts. |
| `max_stock` | DECIMAL(15,2) | NULL | Maximum stock capacity. |
| `reorder_point` | DECIMAL(15,2) | NULL | Reorder trigger quantity. |
| `has_variations` | BOOLEAN | NULL | When `true`, SKU-level variations exist in `product_variations`. |
| `image_url` | TEXT | NULL | Primary product image. |
| `gallery_urls` | JSONB | NULL | Array of additional image URLs. |
| `is_rentable` | BOOLEAN | NULL | Eligible for rental bookings. |
| `is_sellable` | BOOLEAN | NULL | Eligible for sale. Defaults `true`. |
| `is_purchasable` | BOOLEAN | NULL | Eligible for purchase orders. Defaults `true`. |
| `track_stock` | BOOLEAN | NULL | Whether stock movements are tracked. Defaults `true`. |
| `is_active` | BOOLEAN | NOT NULL | Soft-delete. Defaults `true`. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated by trigger. |

**Constraints:** PK `id`; FK `company_id`, `category_id`, `brand_id`, `unit_id`.
**Indexes:** `(company_id)`, `(category_id)`, `(sku)`.
**RLS:** Company-scoped.
**Primary service:** `productService.ts`
**Source of truth warning:** `current_stock` is a cache. Always use `SUM(stock_movements.quantity_change)` per `product_id` + `branch_id` for authoritative stock quantity.

---

### `product_variations`

**Canonical role:** SKU-level variants under a product (size, color, etc.). Each variation is independently trackable in stock.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `product_id` | UUID | NOT NULL | FK → `products.id` CASCADE. |
| `name` | VARCHAR(255) | NOT NULL | Human-readable variant label (e.g. "Size: Large, Color: Red"). |
| `sku` | VARCHAR(100) | NOT NULL | UNIQUE. Variation-level SKU. |
| `barcode` | VARCHAR(100) | NULL | Barcode. |
| `attributes` | JSONB | NOT NULL | Key-value pairs: `{"size": "Large", "color": "Red"}`. |
| `cost_price` | DECIMAL(15,2) | NULL | Overrides `products.cost_price` when set. |
| `retail_price` | DECIMAL(15,2) | NULL | Overrides `products.retail_price`. |
| `wholesale_price` | DECIMAL(15,2) | NULL | Overrides `products.wholesale_price`. |
| `current_stock` | DECIMAL(15,2) | NULL | Cache — same staleness caveat as `products.current_stock`. |
| `image_url` | TEXT | NULL | Variation-level image. |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `sku`; FK `product_id`.
**Indexes:** `(product_id)`.
**RLS:** Inherited via `product_id` → `products.company_id`.
**Primary service:** `productService.ts`

---

### `product_categories`

**Canonical role:** Category tree for products. Self-referential: `parent_id IS NULL` = top-level category; `parent_id IS NOT NULL` = sub-category.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `name` | VARCHAR(255) | NOT NULL | Category name. |
| `description` | TEXT | NULL | Optional description. |
| `parent_id` | UUID | NULL | FK → `product_categories.id` (self-referential). NULL = top-level. |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; FK `company_id`; FK `parent_id` (self).
**Primary service:** `productCategoryService.ts`

---

### `brands`

**Canonical role:** Product brand master (e.g. Nike, Local, Studio Brand).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `name` | VARCHAR(255) | NOT NULL | Brand name. UNIQUE per company. |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `(company_id, name)`.
**Primary service:** `brandService.ts`

---

### `units`

**Canonical role:** Unit of measure master per company (Piece, Meter, Yard, Kg).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `name` | VARCHAR(100) | NOT NULL | Unit name (e.g. "Piece"). UNIQUE per company. |
| `symbol` | VARCHAR(20) | NULL | Short symbol (e.g. "pcs", "m"). |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `sort_order` | INT | NULL | Display ordering. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `(company_id, name)`.
**Primary service:** `unitService.ts`

---

### `stock_movements`

**Canonical role:** Append-only ledger of every stock-in and stock-out event. **This is the canonical source of truth for stock quantity.** `SUM(quantity_change)` per `(product_id, variation_id, branch_id)` = current stock.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `product_id` | UUID | NOT NULL | FK → `products.id` CASCADE. |
| `variation_id` | UUID | NULL | FK → `product_variations.id`. NULL = base product. |
| `movement_type` | VARCHAR(50) | NOT NULL | Key values: `sale` (OUT), `sale_return` (IN), `sale_return_void` (OUT), `purchase` (IN), `purchase_return` (OUT), `purchase_return_void` (IN), `adjustment` (opening balance or manual — triggers GL sync), `opening` (legacy import — does NOT trigger GL sync; see P1-04), `rental_out` (OUT), `rental_in` (IN), `transfer_in`, `transfer_out`. |
| `quantity_change` | DECIMAL(15,2) | NOT NULL | Signed quantity: positive = stock in, negative = stock out. |
| `unit_cost` | DECIMAL(15,2) | NULL | Per-unit cost for this movement. For sale-type movements this is the selling price (retail inventory method), not COGS. For purchase-type movements this is the actual purchase cost. |
| `total_cost` | DECIMAL(15,2) | NULL | `quantity_change × unit_cost`. Negative for OUT movements. |
| `balance_qty` | DECIMAL(15,2) | NULL | Running balance AFTER this movement (snapshot, may be stale if recomputed later). |
| `reference_type` | VARCHAR(50) | NULL | Source document type: `sale`, `purchase`, `rental`, `adjustment`, `opening_balance`, etc. |
| `reference_id` | UUID | NULL | ID of the source document row. |
| `notes` | TEXT | NULL | Optional notes. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. Append-only; rows are never updated. |

**Constraints:** PK `id`; FK `company_id`, `branch_id`, `product_id`, `variation_id`.
**Indexes:** `(product_id)`, `(branch_id)`, `(company_id, movement_type)`, `(reference_type, reference_id)`.
**RLS:** Company-scoped.
**Primary service:** `inventoryService.ts`, `documentStockSyncService.ts`
**Critical notes:**
- `movement_type = 'opening'` (legacy import path) does NOT trigger GL sync. This is P1-04 in the audit: opening stock added via this path has no Inventory (1200) debit on the Balance Sheet.
- `movement_type = 'adjustment'` with `reference_type = 'opening_balance'` is the canonical opening stock path and triggers `syncOpeningJournalIfApplicable`.
- Never delete rows. Voids are recorded as opposite-sign movements.

---

### `inventory_balance`

**Canonical role:** Periodic snapshot table for fast inventory balance lookups. **Not the canonical source.** May be hours or days stale depending on batch update frequency.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. |
| `variation_id` | UUID | NULL | FK → `product_variations.id`. |
| `quantity` | DECIMAL(15,2) | NOT NULL | Snapshot quantity at last update. |
| `total_value` | DECIMAL(15,2) | NULL | Snapshot valuation at last update. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | When this snapshot was last written. |

**Constraints:** PK `id`; UNIQUE `(company_id, branch_id, product_id, variation_id)`.
**Source of truth warning:** Always prefer `SUM(stock_movements.quantity_change)` for quantity; prefer `journal_entry_lines` net on account 1200 for value. This table is only a performance shortcut.
**Primary service:** `inventoryService.ts`

---

## 5. Sales

### `sales`

**Canonical role:** Sale invoice header. Authoritative for document state (status, line items list, date, customer). **Not authoritative for GL balances.**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `invoice_no` | VARCHAR(50) | NOT NULL | UNIQUE document number (e.g. SL-0001). Set by `generate_document_number`. |
| `invoice_date` | DATE | NOT NULL | Invoice date. Defaults to current date. |
| `customer_id` | UUID | NOT NULL | FK → `contacts.id`. |
| `customer_name` | VARCHAR(255) | NOT NULL | Denormalized customer name at time of sale. |
| `status` | transaction_status | NOT NULL | Enum: `draft`, `quotation`, `order`, `final`, `cancelled`. Only `final` records are posted to GL. |
| `payment_status` | payment_status | NOT NULL | Enum: `paid`, `partial`, `unpaid`. |
| `sale_type` | VARCHAR(50) | NULL | `regular`, `studio`, `rental`. Used to differentiate POS, regular, and studio-linked sales. |
| `subtotal` | DECIMAL(15,2) | NOT NULL | Sum of line item totals before discount and tax. |
| `discount_percentage` | DECIMAL(5,2) | NULL | Invoice-level discount percentage. |
| `discount_amount` | DECIMAL(15,2) | NULL | Invoice-level discount amount. |
| `tax_percentage` | DECIMAL(5,2) | NULL | Tax percentage. |
| `tax_amount` | DECIMAL(15,2) | NULL | Tax amount. |
| `shipping_charges` | DECIMAL(15,2) | NULL | Shipping / freight charges. |
| `total` | DECIMAL(15,2) | NOT NULL | **CACHE.** Final invoice total. Used for dashboard KPIs as accepted operational shortcut. Not authoritative for GL revenue — use `journal_entry_lines` Cr on account 4100. |
| `paid_amount` | DECIMAL(15,2) | NULL | **CACHE.** Updated on payment recording. |
| `due_amount` | DECIMAL(15,2) | NULL | **CACHE.** `total - paid_amount`. Updated on payment events. Can diverge when payments are voided without recalculation. |
| `commission_amount` | DECIMAL(15,2) | NULL | **CACHE.** Commission captured at sale. GL not updated until batch post. |
| `delivery_date` | DATE | NULL | Expected delivery date. |
| `notes` | TEXT | NULL | Internal notes. |
| `terms_conditions` | TEXT | NULL | Terms printed on invoice. |
| `journal_entry_id` | UUID | NULL | Legacy FK to `journal_entries.id`. Not always set; do not use for JE lookup — use `journal_entries.reference_id = sales.id` instead. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated by trigger. |

**Constraints:** PK `id`; UNIQUE `invoice_no`; FK `company_id`, `branch_id`, `customer_id`.
**Indexes:** `(company_id)`, `(branch_id)`, `(customer_id)`, `(invoice_no)`, `(invoice_date)`, `(status)`.
**RLS:** Company-scoped.
**Primary service:** `saleService.ts`, `saleAccountingService.ts`
**Source of truth warnings:** `total`, `paid_amount`, `due_amount`, `commission_amount` are caches. Use GL queries for financial reporting.

---

### `sales_items` (canonical) / `sale_items` (legacy)

**Canonical role:** Line items on a sale. `sales_items` is the active table. `sale_items` is the legacy table — retained for backward compatibility but must not receive new inserts.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `sale_id` | UUID | NOT NULL | FK → `sales.id` CASCADE. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. |
| `variation_id` | UUID | NULL | FK → `product_variations.id`. |
| `product_name` | VARCHAR(255) | NOT NULL | Denormalized at time of sale. |
| `sku` | VARCHAR(100) | NULL | Denormalized SKU. |
| `quantity` | DECIMAL(15,2) | NOT NULL | Quantity sold. |
| `unit` | VARCHAR(50) | NULL | Unit of measure. |
| `unit_price` | DECIMAL(15,2) | NOT NULL | Per-unit selling price. |
| `discount_percentage` | DECIMAL(5,2) | NULL | Line-level discount %. |
| `discount_amount` | DECIMAL(15,2) | NULL | Line-level discount amount. |
| `tax_percentage` | DECIMAL(5,2) | NULL | Line-level tax %. |
| `tax_amount` | DECIMAL(15,2) | NULL | Line-level tax amount. |
| `total` | DECIMAL(15,2) | NOT NULL | Line total after discount and tax. |
| `packing_type` | VARCHAR(50) | NULL | Packing unit type (e.g. `box`, `piece`). |
| `packing_quantity` | DECIMAL(15,2) | NULL | Quantity per packing unit. |
| `packing_unit` | VARCHAR(50) | NULL | Label for packing unit. |
| `packing_details` | JSONB | NULL | Detailed packing breakdown (box contents). |
| `is_studio_product` | BOOLEAN | NULL | Flag for studio-linked line items. |
| `notes` | TEXT | NULL | Line notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; FK `sale_id`, `product_id`, `variation_id`.
**Indexes:** `(sale_id)`, `(product_id)`.
**Primary service:** `saleService.ts`
**Notes:** The `sale_return_items.sale_item_id` FK was historically defined against `sale_items` (legacy). P3-02 risk: FK violations for items in `sales_items`. Do not drop `sale_items` until FK is migrated.

---

### `sale_charges`

**Canonical role:** Additional header-level charges on a sale (shipping, handling, packing). Separate from `sales.shipping_charges` for itemized charge breakdown.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `sale_id` | UUID | NOT NULL | FK → `sales.id` CASCADE. |
| `charge_type` | VARCHAR(100) | NOT NULL | Label (e.g. `shipping`, `handling`). |
| `amount` | DECIMAL(15,2) | NOT NULL | Charge amount. |
| `notes` | TEXT | NULL | Optional notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `saleService.ts`

---

## 6. Purchases

### `purchases`

**Canonical role:** Purchase order / GRN header. Authoritative for document state. Not authoritative for GL AP balance.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `po_no` | VARCHAR(50) | NOT NULL | UNIQUE document number (e.g. PUR-0001). |
| `po_date` | DATE | NOT NULL | Purchase date. |
| `supplier_id` | UUID | NOT NULL | FK → `contacts.id`. |
| `supplier_name` | VARCHAR(255) | NOT NULL | Denormalized supplier name. |
| `status` | transaction_status | NOT NULL | Enum: `draft`, `order`, `received`, `posted`, `final`, `cancelled`. |
| `payment_status` | payment_status | NOT NULL | Enum: `paid`, `partial`, `unpaid`. |
| `subtotal` | DECIMAL(15,2) | NOT NULL | Sum of line totals before charges. |
| `discount_percentage` | DECIMAL(5,2) | NULL | Invoice-level discount %. |
| `discount_amount` | DECIMAL(15,2) | NULL | Invoice-level discount amount. |
| `tax_percentage` | DECIMAL(5,2) | NULL | Tax %. |
| `tax_amount` | DECIMAL(15,2) | NULL | Tax amount. |
| `shipping_charges` | DECIMAL(15,2) | NULL | Freight charges. |
| `total` | DECIMAL(15,2) | NOT NULL | **CACHE.** Invoice total. Used as dashboard shortcut for status IN (`received`, `posted`, `final`). Not authoritative for GL. |
| `paid_amount` | DECIMAL(15,2) | NULL | **CACHE.** Updated on supplier payment recording. |
| `due_amount` | DECIMAL(15,2) | NULL | **CACHE.** `total - paid_amount`. Can diverge. |
| `expected_delivery_date` | DATE | NULL | Expected GRN date. |
| `received_date` | DATE | NULL | Actual receipt date. |
| `notes` | TEXT | NULL | Internal notes. |
| `journal_entry_id` | UUID | NULL | Legacy JE reference. Use `journal_entries.reference_id` for lookups. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `po_no`; FK `company_id`, `branch_id`, `supplier_id`.
**Primary service:** `purchaseService.ts`, `purchaseAccountingService.ts`

---

### `purchase_items`

**Canonical role:** Line items on a purchase order / GRN.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `purchase_id` | UUID | NOT NULL | FK → `purchases.id` CASCADE. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. |
| `variation_id` | UUID | NULL | FK → `product_variations.id`. |
| `product_name` | VARCHAR(255) | NOT NULL | Denormalized. |
| `sku` | VARCHAR(100) | NULL | Denormalized SKU. |
| `quantity` | DECIMAL(15,2) | NOT NULL | Ordered quantity. |
| `received_quantity` | DECIMAL(15,2) | NULL | Actually received (for partial GRN). |
| `unit` | VARCHAR(50) | NULL | Unit of measure. |
| `unit_price` | DECIMAL(15,2) | NOT NULL | Per-unit purchase cost. |
| `discount_percentage` | DECIMAL(5,2) | NULL | Line discount %. |
| `discount_amount` | DECIMAL(15,2) | NULL | Line discount amount. |
| `tax_percentage` | DECIMAL(5,2) | NULL | Tax %. |
| `tax_amount` | DECIMAL(15,2) | NULL | Tax amount. |
| `total` | DECIMAL(15,2) | NOT NULL | Line total. |
| `packing_details` | JSONB | NULL | Packing structure (boxes, pieces). |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; FK `purchase_id`, `product_id`, `variation_id`.
**Primary service:** `purchaseService.ts`

---

### `purchase_charges`

**Canonical role:** Additional charges on a purchase header (freight, duties, handling).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `purchase_id` | UUID | NOT NULL | FK → `purchases.id` CASCADE. |
| `charge_type` | VARCHAR(100) | NOT NULL | Label (e.g. `freight`, `custom_duty`). |
| `amount` | DECIMAL(15,2) | NOT NULL | Charge amount. |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `purchaseService.ts`

---

## 7. Sale Returns

### `sale_returns`

**Canonical role:** Return-against-sale header. Authoritative for return document state.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `original_sale_id` | UUID | NULL | FK → `sales.id`. NULL for standalone returns not linked to an invoice. |
| `return_no` | VARCHAR(50) | NOT NULL | Return document number. |
| `return_date` | DATE | NOT NULL | Date of return. |
| `customer_id` | UUID | NULL | FK → `contacts.id`. |
| `customer_name` | VARCHAR(255) | NOT NULL | Denormalized customer name. |
| `status` | VARCHAR(50) | NOT NULL | `draft`, `final`, `void`. Only `final` records affect GL and stock. |
| `subtotal` | DECIMAL(15,2) | NOT NULL | Sum of return lines before discount. |
| `discount_amount` | DECIMAL(15,2) | NULL | Proportional discount applied to return (fixed: propagated from original sale's discount ratio). |
| `tax_amount` | DECIMAL(15,2) | NULL | Tax on return. |
| `total` | DECIMAL(15,2) | NOT NULL | Return total (credit to customer). |
| `reason` | TEXT | NULL | Return reason. |
| `notes` | TEXT | NULL | Internal notes. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; FK `company_id`, `branch_id`, `original_sale_id`, `customer_id`.
**Primary service:** `saleReturnService.ts`, `saleAccountingService.ts`
**Notes:** Quantity validation bug (draft pollution) was fixed in `saleReturnService.finalizeSaleReturn()` — only `status = 'final'` returns count toward consumed return quantity.

---

### `sale_return_items`

**Canonical role:** Line items on a sale return.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `sale_return_id` | UUID | NOT NULL | FK → `sale_returns.id` CASCADE. |
| `sale_item_id` | UUID | NULL | FK → `sale_items.id` (legacy table). Used to trace back to original sale line. P3-02 risk if item is in `sales_items`. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. |
| `variation_id` | UUID | NULL | FK → `product_variations.id`. |
| `product_name` | VARCHAR(255) | NOT NULL | Denormalized. |
| `sku` | VARCHAR(100) | NULL | Denormalized. |
| `quantity` | DECIMAL(15,2) | NOT NULL | Returned quantity. |
| `unit` | VARCHAR(50) | NULL | Unit. |
| `unit_price` | DECIMAL(15,2) | NOT NULL | Per-unit price (used for return credit calculation). |
| `total` | DECIMAL(15,2) | NOT NULL | Line return total. |
| `packing_details` | JSONB | NULL | Original sale packing structure. |
| `return_packing_details` | JSONB | NULL | Piece-level selection of what was physically returned. |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `saleReturnService.ts`

---

## 8. Purchase Returns

### `purchase_returns`

**Canonical role:** Return-against-purchase header. **P1-01 active bug: `finalizePurchaseReturn` does not post a GL journal entry.**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `original_purchase_id` | UUID | NULL | FK → `purchases.id`. NULL for standalone returns. |
| `return_no` | VARCHAR(50) | NOT NULL | Return document number. |
| `return_date` | DATE | NOT NULL | Date of return to supplier. |
| `supplier_id` | UUID | NULL | FK → `contacts.id`. |
| `supplier_name` | VARCHAR(255) | NOT NULL | Denormalized. |
| `status` | VARCHAR(50) | NOT NULL | `draft`, `final`. (Void path not confirmed; see P1-06 for draft pollution bug.) |
| `subtotal` | DECIMAL(15,2) | NOT NULL | Sum of return lines. |
| `discount_amount` | DECIMAL(15,2) | NULL | Discount. |
| `tax_amount` | DECIMAL(15,2) | NULL | Tax. |
| `total` | DECIMAL(15,2) | NOT NULL | Return total (debit to AP). |
| `reason` | TEXT | NULL | Return reason. |
| `notes` | TEXT | NULL | Notes. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; FK `company_id`, `branch_id`, `original_purchase_id`, `supplier_id`.
**Primary service:** `purchaseReturnService.ts`
**Open bugs:**
- **P1-01:** `finalizePurchaseReturn()` posts no JE. AP (2000) and Inventory (1200) are not cleared. Every finalized purchase return permanently overstates Balance Sheet AP and Inventory.
- **P1-06:** Draft pollution bug. Quantity validation counts items from all `purchase_return_items` including drafts, blocking valid returns.

---

### `purchase_return_items`

**Canonical role:** Line items on a purchase return.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `purchase_return_id` | UUID | NOT NULL | FK → `purchase_returns.id` CASCADE. |
| `purchase_item_id` | UUID | NULL | FK → `purchase_items.id`. Traces back to original purchase line. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. |
| `variation_id` | UUID | NULL | FK → `product_variations.id`. |
| `product_name` | VARCHAR(255) | NOT NULL | Denormalized. |
| `sku` | VARCHAR(100) | NULL | Denormalized. |
| `quantity` | DECIMAL(15,2) | NOT NULL | Returned quantity. |
| `unit` | VARCHAR(50) | NULL | Unit. |
| `unit_price` | DECIMAL(15,2) | NOT NULL | Per-unit cost. |
| `total` | DECIMAL(15,2) | NOT NULL | Line return total. |
| `packing_details` | JSONB | NULL | Packing structure. |
| `return_packing_details` | JSONB | NULL | Actual pieces returned. |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `purchaseReturnService.ts`

---

## 9. Rentals

### `rentals`

**Canonical role:** Rental booking header. Authoritative for rental document state and dates.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `rental_no` | VARCHAR(50) | NOT NULL | UNIQUE. Auto-set by trigger from `rental_no_seq`. Also stored as `booking_no` in older schema variant. |
| `customer_id` | UUID | NULL | FK → `contacts.id`. |
| `customer_name` | VARCHAR(255) | NOT NULL | Denormalized. |
| `status` | VARCHAR(50) | NOT NULL | `draft`, `rented`, `returned`, `overdue`, `cancelled`. |
| `start_date` | DATE | NOT NULL | Pickup date. |
| `expected_return_date` | DATE | NOT NULL | Scheduled return. |
| `actual_return_date` | DATE | NULL | Actual return date (set on return). |
| `total_amount` | DECIMAL(15,2) | NOT NULL | Total rental charges. |
| `paid_amount` | DECIMAL(15,2) | NOT NULL | **CACHE.** Updated on payment recording. |
| `due_amount` | DECIMAL(15,2) | NOT NULL | **CACHE.** Can diverge when payments are voided. Canonical: `total_amount - SUM(payments.amount WHERE reference_type='rental' AND reference_id=rentals.id AND voided_at IS NULL)`. |
| `security_deposit` | DECIMAL(15,2) | NULL | Deposit collected (liability until returned). |
| `notes` | TEXT | NULL | Notes. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `rental_no`; FK `company_id`, `branch_id`, `customer_id`.
**Primary service:** `rentalService.ts`, `rentalAvailabilityService.ts`
**Open issue (P2-05):** GL JE is not posted internally by `rentalService`. JE creation is delegated to `AccountingContext` in the UI layer. Any rental finalized via non-UI paths (batch import, test) has no GL entry.

---

### `rental_items`

**Canonical role:** Items included in a rental booking.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `rental_id` | UUID | NOT NULL | FK → `rentals.id` CASCADE. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. |
| `variation_id` | UUID | NULL | FK → `product_variations.id`. |
| `product_name` | VARCHAR(255) | NOT NULL | Denormalized. |
| `quantity` | DECIMAL(15,2) | NOT NULL | Rented quantity. |
| `rate_per_day` | DECIMAL(15,2) | NOT NULL | Daily rental rate. |
| `duration_days` | INTEGER | NOT NULL | Number of rental days. |
| `total` | DECIMAL(15,2) | NOT NULL | `rate_per_day × quantity × duration_days`. |
| `returned_quantity` | DECIMAL(15,2) | NULL | Quantity physically returned. |
| `condition_on_return` | VARCHAR(50) | NULL | `good`, `damaged`, `lost`. |
| `damage_amount` | DECIMAL(15,2) | NULL | Damage charges assessed. |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `rentalService.ts`

---

### `rental_payments`

**Canonical role:** Payment receipts against a rental booking.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `rental_id` | UUID | NOT NULL | FK → `rentals.id` CASCADE. |
| `amount` | DECIMAL(15,2) | NOT NULL | Amount paid. |
| `method` | VARCHAR(50) | NULL | Payment method (`cash`, `bank`, etc.). |
| `reference` | VARCHAR(255) | NULL | Cheque number or bank ref. |
| `payment_date` | DATE | NULL | Date of payment. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `rentalService.ts`

---

## 10. Payments

### `payments`

**Canonical role:** Receipts from customers and payments to suppliers. Authoritative for the Roznamcha (day book) view. NOT the canonical GL source — `journal_entries` is.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `payment_no` | VARCHAR(50) | NOT NULL | UNIQUE. Prefixed by type (e.g. `RCV-0001` for receipts, `PAY-0001` for payments). |
| `payment_date` | DATE | NOT NULL | Date of payment. |
| `payment_type` | VARCHAR(50) | NOT NULL | `received` (from customer) or `paid` (to supplier). |
| `contact_id` | UUID | NULL | FK → `contacts.id`. |
| `contact_name` | VARCHAR(255) | NULL | Denormalized party name. |
| `amount` | DECIMAL(15,2) | NOT NULL | Payment amount. This is the effective amount after any PF-14 adjustments. |
| `payment_method` | payment_method | NOT NULL | Enum: `cash`, `bank`, `card`, `wallet`, `cheque`, `other`. |
| `payment_account_id` | UUID | NOT NULL | FK → `accounts.id`. The Cash/Bank account debited or credited. |
| `reference_type` | VARCHAR(50) | NULL | Source document: `sale`, `purchase`, `rental`, `on_account`, `manual_receipt`, `manual_payment`. |
| `reference_id` | UUID | NULL | FK to source document ID. |
| `voided_at` | TIMESTAMPTZ | NULL | When the payment was voided. NULL = active. |
| `voided_by` | UUID | NULL | FK → `users.id`. |
| `notes` | TEXT | NULL | Notes. |
| `journal_entry_id` | UUID | NULL | FK → `journal_entries.id`. Links payment to its GL JE. Linkage may be missing for legacy payments (repaired by `20260340_historical_payment_je_linkage_repair`). |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `payment_no`; FK `company_id`, `branch_id`, `contact_id`, `payment_account_id`.
**Indexes:** `(company_id)`, `(contact_id)`, `(payment_date)`, `(reference_type, reference_id)`.
**RLS:** Company-scoped.
**Primary service:** `paymentLifecycleService.ts`, `addEntryV2Service.ts`, `supplierPaymentService.ts`
**PF-14 framework:** Payment edits and reversals are append-only. A "chain" = original payment JE + zero or more `payment_adjustment` JEs + optional `correction_reversal` JE. Only the tail of the chain can be edited or reversed. `paymentChainMutationGuard` enforces this. `paymentChainCompositeReversal` builds the reversal based on `payments.amount`.
**Open issue (P2-06):** If `journal_entries` insert fails after `payments` insert, the payment exists without a GL entry (orphan payment). Detection: `SELECT id FROM payments p WHERE voided_at IS NULL AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.payment_id = p.id AND je.is_void = false)`.

---

### `payment_allocations`

**Canonical role:** Links customer payments to specific invoices for AR/AP allocation. Authoritative for which payments are applied against which invoices.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `payment_id` | UUID | NOT NULL | FK → `payments.id`. |
| `sale_id` | UUID | NULL | FK → `sales.id`. The invoice being settled. |
| `purchase_id` | UUID | NULL | FK → `purchases.id`. The PO being settled. |
| `allocated_amount` | DECIMAL(15,2) | NOT NULL | Amount from this payment applied to this document. |
| `allocated_at` | TIMESTAMPTZ | NOT NULL | When the allocation was made. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; FK `company_id`, `payment_id`, `sale_id`, `purchase_id`.
**Primary service:** `paymentAllocationService.ts`
**Notes:** FIFO allocation epsilon (P2-03): `computeFifoAllocationPlan` skips invoices with `due_amount < 0.02`. Sub-cent residuals accumulate as ghost unapplied balances. Recommended fix: reduce epsilon to `0.001` and force-allocate residuals.

---

## 11. Accounting / GL

### `accounts`

**Canonical role:** Chart of accounts. Every GL transaction line references an account here. The COA tree is the backbone of all financial reporting.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `code` | VARCHAR(50) | NOT NULL | Account code (e.g. `1000`, `1100`, `4100`). Unique per company (enforced in app). |
| `name` | VARCHAR(255) | NOT NULL | Account name. |
| `type` | account_type | NOT NULL | Enum: `asset`, `liability`, `equity`, `revenue`, `expense`. |
| `subtype` | account_subtype | NULL | Finer classification: `cash`, `bank`, `accounts_receivable`, `accounts_payable`, `inventory`, etc. |
| `parent_id` | UUID | NULL | FK → `accounts.id` (self). Group hierarchy. NULL = top-level group. |
| `is_group` | BOOLEAN | NULL | `true` for group/header accounts that aggregate children. Group accounts cannot receive JE lines. |
| `linked_contact_id` | UUID | NULL | FK → `contacts.id`. Set on party subledger accounts (AR/AP child accounts per contact). This is how per-party ledger is maintained. |
| `opening_balance` | DECIMAL(15,2) | NULL | Opening balance seed entered at COA setup. **NOT the live GL balance.** |
| `balance` | DECIMAL(15,2) | NULL | **CACHE / SEED ONLY.** Same as `opening_balance` — not updated by journal activity. Never use for live GL balance. |
| `description` | TEXT | NULL | Account description. |
| `is_system` | BOOLEAN | NULL | System accounts cannot be deleted (e.g. Cash, AR, AP). |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Key account codes:**

| Code | Name | Normal Balance |
|------|------|----------------|
| `1000` | Cash in Hand | Debit |
| `1010` | Bank Account | Debit |
| `102x` | Mobile Wallets | Debit |
| `1100` | Accounts Receivable (Control) | Debit |
| `1180` | Worker Advance | Debit |
| `1200` | Inventory / Stock | Debit |
| `1300` | Worker Advances (alternate) | Debit |
| `2000` | Accounts Payable (Control) | Credit |
| `2010` | Worker Payable | Credit |
| `3000` | Opening Balance Equity | Credit |
| `4100` | Revenue / Sales | Credit |
| `5000` | Cost of Goods Sold | Debit |
| `5010` | Purchase Cost | Debit |
| `5100` | Production / Studio Cost | Debit |
| `5110` | Shipping / Fulfillment Cost | Debit |
| `5200` | Discount Allowed (operating expense) | Debit |
| `5300` | Extra Expense (operating expense) | Debit |

**Constraints:** PK `id`; FK `company_id`, `parent_id` (self), `linked_contact_id`.
**Indexes:** `(company_id)`, `(type)`, `(code)`.
**RLS:** Company-scoped. Operator and inventory roles can read accounts needed for payment/stock operations.
**Primary service:** `accountService.ts`, `defaultAccountsService.ts`, `chartAccountService.ts`
**Source of truth warning:** `accounts.balance` and `accounts.opening_balance` are NOT live GL balances. Live balance = `SUM(jel.debit) - SUM(jel.credit)` (or reversed for liability/equity/revenue) from `journal_entry_lines` WHERE `journal_entries.company_id = $1 AND journal_entries.is_void = false`.

---

### `journal_entries`

**Canonical role:** Journal entry header. Together with `journal_entry_lines`, this is the canonical source of truth for all financial figures. Never delete or modify posted entries — void them instead.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NULL | FK → `branches.id`. NULL for company-wide opening entries. |
| `entry_no` | VARCHAR(100) | NULL | Human-readable entry number. |
| `entry_date` | DATE | NOT NULL | The accounting date. Should match source document date. |
| `description` | TEXT | NOT NULL | Entry description. |
| `reference_type` | VARCHAR(50) | NULL | Source event type. Key values: `sale`, `purchase`, `sale_return`, `purchase_return`, `payment`, `expense`, `rental`, `studio_production_stage`, `opening_balance`, `opening_balance_contact_ar`, `opening_balance_contact_ap`, `payment_adjustment`, `correction_reversal`, `manual`. |
| `reference_id` | UUID | NULL | ID of the source document (sale.id, purchase.id, etc.). Used to find all JEs for a document via `WHERE reference_type = $type AND reference_id = $id`. |
| `payment_id` | UUID | NULL | FK → `payments.id`. Links a payment JE to its payments row. |
| `action_fingerprint` | TEXT | NULL | Idempotency key. Format: `'{event}:{company_id}:{doc_id}'`. Protected by unique partial index `idx_journal_entries_fingerprint_active` on `(company_id, action_fingerprint) WHERE action_fingerprint IS NOT NULL AND is_void IS NOT TRUE`. Prevents duplicate JEs on retry. |
| `is_void` | BOOLEAN | NOT NULL | `true` = excluded from all business reports. Defaults `false`. Voiding is the only safe way to reverse a posted JE. |
| `void_reason` | TEXT | NULL | Reason for void. |
| `voided_at` | TIMESTAMPTZ | NULL | When voided. |
| `voided_by` | UUID | NULL | FK → `users.id`. |
| `is_manual` | BOOLEAN | NULL | `true` for manually entered JEs (via Journal Entry page). Manual JEs can be edited/deleted only if they do not have a `reference_type` (source-owned protection). |
| `is_locked` | BOOLEAN | NULL | When `true`, even manual edits are blocked (year-end lock or admin lock). |
| `source_type` | VARCHAR(50) | NULL | Alias for `reference_type` used in some older code paths. |
| `source_id` | UUID | NULL | Alias for `reference_id`. |
| `is_posted` | BOOLEAN | NULL | Legacy posting flag. Not used in current flow — `is_void = false` is the active-entry gate. |
| `total_debit` | DECIMAL(15,2) | NULL | Sum of debit lines. For validation only; live total is `SUM(jel.debit)`. |
| `total_credit` | DECIMAL(15,2) | NULL | Sum of credit lines. For validation only. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; FK `company_id`, `branch_id`, `payment_id`; UNIQUE partial index on `(company_id, action_fingerprint) WHERE action_fingerprint IS NOT NULL AND is_void IS NOT TRUE`.
**Indexes:** `(company_id)`, `(entry_date)`, `(company_id, is_void) WHERE is_void = false`, `(reference_type, reference_id)`.
**RLS:** Company-scoped. `accountingCanonicalGuard.ts` adds application-layer protection: JEs with `source_type` set cannot be mutated from the manual JE UI.
**Primary service:** `accountingService.ts`, `saleAccountingService.ts`, `purchaseAccountingService.ts`, `expenseService.ts`, `documentPostingEngine.ts`

---

### `journal_entry_lines`

**Canonical role:** Individual debit/credit lines within a journal entry. **This is the most granular source of financial truth in the system.** All balance sheet and P&L figures are `SUM(debit)` and `SUM(credit)` aggregated from this table.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `journal_entry_id` | UUID | NOT NULL | FK → `journal_entries.id` CASCADE. |
| `account_id` | UUID | NOT NULL | FK → `accounts.id`. The affected GL account. |
| `account_name` | VARCHAR(255) | NULL | Denormalized account name at posting time. |
| `debit` | DECIMAL(15,2) | NOT NULL | Debit amount. Defaults `0`. |
| `credit` | DECIMAL(15,2) | NOT NULL | Credit amount. Defaults `0`. |
| `description` | TEXT | NULL | Line-level description. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; FK `journal_entry_id`, `account_id`. Schema-level CHECK `(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)` (enforced in base schema; may be relaxed in some migration paths to allow `0/0` lines for structural entries).
**Indexes:** `(journal_entry_id)`, `(account_id)`.
**RLS:** Inherited via `journal_entry_id` → `journal_entries.company_id`.
**Primary service:** `accountingService.ts`
**Critical usage:** Every financial query in the ERP must JOIN this table through `journal_entries` with `is_void = false`. The `accountingCanonicalGuard.assertGlTruthQueryTable` function is called at the top of any function that reads financial balances to document this intent.

---

## 12. Expenses

### `expenses`

**Canonical role:** Expense record header. Authoritative for expense document state. Not authoritative for GL expense totals.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `expense_no` | VARCHAR(50) | NOT NULL | UNIQUE document number. |
| `expense_date` | DATE | NOT NULL | Date of expense. |
| `category_id` | UUID | NULL | FK → `expense_categories.id`. |
| `description` | TEXT | NOT NULL | Expense description. |
| `amount` | DECIMAL(15,2) | NOT NULL | **CACHE.** Expense amount. Used as dashboard shortcut for `status = 'paid'`. Not authoritative for GL. |
| `vendor` | VARCHAR(255) | NULL | Vendor / payee name. |
| `vendor_name` | VARCHAR(255) | NULL | Alternate vendor name column (added in migration `20260355_expenses_vendor_name`). |
| `payment_method` | payment_method | NULL | Enum: `cash`, `bank`, etc. |
| `payment_account_id` | UUID | NULL | FK → `accounts.id`. Cash/Bank account debited. |
| `receipt_url` | TEXT | NULL | Uploaded receipt image. |
| `status` | VARCHAR(50) | NOT NULL | `pending`, `approved`, `paid`. GL JE is posted when `paid`. |
| `approved_by` | UUID | NULL | FK → `users.id`. |
| `approved_at` | TIMESTAMPTZ | NULL | Approval timestamp. |
| `journal_entry_id` | UUID | NULL | Legacy JE reference. |
| `created_by` | UUID | NULL | FK → `users.id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `expense_no`; FK `company_id`, `branch_id`, `category_id`, `payment_account_id`.
**Indexes:** `(company_id)`, `(expense_date)`, `(category_id)`.
**Primary service:** `expenseService.ts`
**Source of truth warning:** `expenses.amount` is an operational shortcut. GL expense = `SUM(jel.debit)` on expense accounts (code pattern `5xxx`) WHERE `journal_entries.reference_type = 'expense' AND is_void = false`.

---

### `expense_categories`

**Canonical role:** User-defined expense category list. Replaces the legacy enum `expense_category`.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `name` | VARCHAR(255) | NOT NULL | Category name. |
| `account_id` | UUID | NULL | FK → `accounts.id`. The expense GL account for this category. |
| `description` | TEXT | NULL | Notes. |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; FK `company_id`, `account_id`.
**Primary service:** `expenseCategoryService.ts`

---

## 13. Studio Production

### `studio_production_orders_v3` (current active version)

**Canonical role:** Studio production order header under the V3 schema. The active creation path for new studio orders.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NOT NULL | FK → `branches.id`. |
| `sale_id` | UUID | NOT NULL | FK → `sales.id`. Links to the customer sale invoice. |
| `production_no` | VARCHAR(50) | NOT NULL | UNIQUE document number. |
| `status` | TEXT | NOT NULL | `draft`, `in_progress`, `completed`, `cancelled`. |
| `production_cost` | DECIMAL(15,2) | NULL | **CACHE.** Aggregated production cost (sum of stage actual costs). Not in GL until JE is posted (P1-03 open bug). |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `(company_id, production_no)`.
**Primary service:** `studioProductionV3Service.ts`
**Open bugs:**
- **P1-03:** `completeStage()` updates `actual_cost` and `production_cost` but posts no JE. Worker Payable (2010) is not credited; Production Cost (5100) is not debited.
- **P2-04:** `ensureStudioProductionV3OrdersForCompany` creates V3 orders without checking for existing V2 orders — companies with both versions have duplicate orders with different cost data.

---

### `studio_production_stages_v3`

**Canonical role:** Individual production stages within a V3 order (dyer, stitching, handwork, embroidery, finishing, quality_check).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `order_id` | UUID | NOT NULL | FK → `studio_production_orders_v3.id` CASCADE. |
| `stage_type` | TEXT | NOT NULL | Enum: `dyer`, `stitching`, `handwork`, `embroidery`, `finishing`, `quality_check`. |
| `status` | TEXT | NOT NULL | `pending`, `assigned`, `in_progress`, `completed`. |
| `assigned_worker_id` | UUID | NULL | FK → `workers.id`. |
| `expected_cost` | DECIMAL(15,2) | NULL | Estimated cost. |
| `actual_cost` | DECIMAL(15,2) | NULL | Actual cost (set on completion). |
| `sort_order` | INT | NOT NULL | Stage sequence. |
| `completed_at` | TIMESTAMPTZ | NULL | When stage was marked complete. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Primary service:** `studioProductionV3Service.ts`

---

### `studio_production_cost_breakdown_v3`

**Canonical role:** Detailed cost line items per V3 production order.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `order_id` | UUID | NOT NULL | FK → `studio_production_orders_v3.id` CASCADE. |
| `cost_type` | TEXT | NOT NULL | Category of cost (e.g. `material`, `labor`, `overhead`). |
| `description` | TEXT | NULL | Cost description. |
| `amount` | DECIMAL(15,2) | NOT NULL | Cost amount. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `studioCostsService.ts`

---

### Legacy studio tables (retained, do not extend)

| Table | Status | Notes |
|-------|--------|-------|
| `studio_orders` | Legacy V1 | Original studio order schema. `workerPaymentService` still reads this for V1 companies. |
| `studio_order_items` | Legacy V1 | Items on V1 studio orders. |
| `job_cards` | Legacy V1 | Worker task assignment (V1). Replaced by V3 stages. |
| `studio_production_orders_v2` | Legacy V2 | V2 schema. `studioCustomerInvoiceService` is V2-only. |
| `studio_production_stages_v2` | Legacy V2 | V2 stages. |
| `studio_stage_assignments_v2` | Legacy V2 | Worker assignment per V2 stage. |
| `studio_stage_receipts_v2` | Legacy V2 | Cost receipt per V2 stage. |

**Do not drop any legacy studio table until:** (a) all in-progress V2 orders are migrated to V3; (b) `workerPaymentService` is decoupled from V1 tables; (c) `studioCustomerInvoiceService` is updated for V3.

---

## 14. Manufacturing

### `bill_of_materials`

**Canonical role:** BOM — finished product mapped to raw material inputs with quantity required.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. Finished product. |
| `material_id` | UUID | NOT NULL | FK → `products.id`. Raw material input. |
| `quantity_required` | NUMERIC(15,4) | NOT NULL | Material quantity per unit of finished product. |
| `unit_id` | UUID | NULL | FK → `units.id`. Unit for the material quantity. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `(product_id, material_id)`; FK `company_id`, `product_id`, `material_id`, `unit_id`.
**Primary service:** `bomService.ts`

---

### `production_orders`

**Canonical role:** Manufacturing production order — product, quantity, status, dates.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `branch_id` | UUID | NULL | FK → `branches.id`. |
| `product_id` | UUID | NOT NULL | FK → `products.id`. Product being manufactured. |
| `quantity` | NUMERIC(15,4) | NOT NULL | Planned production quantity. |
| `status` | TEXT | NOT NULL | `draft`, `in_progress`, `completed`, `cancelled`. |
| `start_date` | DATE | NULL | Planned start. |
| `end_date` | DATE | NULL | Planned end. |
| `order_number` | VARCHAR(50) | NULL | Document number. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Primary service:** `productionOrderService.ts`

---

### `production_steps`

**Canonical role:** Steps within a manufacturing production order (cutting, dyeing, stitching, handwork).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `production_order_id` | UUID | NOT NULL | FK → `production_orders.id` CASCADE. |
| `step_name` | TEXT | NOT NULL | Step label (e.g. `cutting`, `stitching`). |
| `sort_order` | INT | NOT NULL | Sequence. |
| `worker_id` | UUID | NULL | FK → `workers.id`. |
| `cost` | NUMERIC(15,2) | NULL | Step cost. |
| `status` | TEXT | NOT NULL | `pending`, `in_progress`, `completed`. |
| `completed_at` | TIMESTAMPTZ | NULL | When step completed. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Primary service:** `productionStepService.ts`

---

## 15. Workers / Payroll

### `workers`

**Canonical role:** Studio worker profiles. Worker contacts (type = `worker` in `contacts`) have the same UUID as their `workers` row — they are the same entity. A trigger on `contacts` syncs worker contacts to this table.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. Same UUID as `contacts.id` for worker-type contacts. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `name` | VARCHAR(255) | NOT NULL | Worker name. |
| `phone` | VARCHAR(50) | NULL | Phone. |
| `cnic` | VARCHAR(50) | NULL | National ID. |
| `address` | TEXT | NULL | Address. |
| `worker_type` | VARCHAR(50) | NULL | Specialization (e.g. `tailor`, `cutter`, `embroidery`). |
| `payment_type` | VARCHAR(50) | NULL | `per_piece`, `daily`, `monthly`. |
| `rate` | DECIMAL(15,2) | NULL | Base rate. |
| `current_balance` | DECIMAL(15,2) | NULL | **CACHE.** Outstanding advance/payable balance. Not authoritative — use `journal_entry_lines` net on account 1300 (Worker Advance) or 2010 (Worker Payable). |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; FK `company_id`.
**Primary service:** `employeeService.ts`, `workerPaymentService.ts`, `workerAdvanceService.ts`
**Notes:** Worker advance GL account is code `1180` (Worker Advance asset). Worker payable is code `2010` (Worker Payable). These accounts must exist for worker payment flows to succeed. Missing accounts = hard error (P1-05).

---

### `worker_ledger_entries`

**Canonical role:** Operational cost entries per worker per studio stage. Separate from customer payments and GL.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `worker_id` | UUID | NOT NULL | FK → `workers.id`. |
| `amount` | NUMERIC(15,2) | NOT NULL | Cost amount for this entry. |
| `reference_type` | VARCHAR(50) | NOT NULL | Source event (e.g. `studio_stage`, `advance`, `payment`). |
| `reference_id` | UUID | NOT NULL | ID of source record. |
| `entry_type` | VARCHAR(50) | NULL | `debit` or `credit` from worker's perspective. |
| `status` | VARCHAR(50) | NULL | `pending`, `paid`. |
| `document_no` | VARCHAR(100) | NULL | Document number for this entry. |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Constraints:** PK `id`; FK `company_id`, `worker_id`.
**Indexes:** `(company_id)`, `(worker_id)`, `(reference_type, reference_id)`.
**Primary service:** `workerAdvanceService.ts`, `workerPaymentService.ts`

---

### `worker_payments` (V1 legacy)

**Canonical role:** Payments made to workers in the V1 studio workflow (linked to `studio_tasks`). Retained because `workerPaymentService` imports from this table.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `studio_task_id` | UUID | NOT NULL | FK → `studio_tasks.id` (V1 legacy table). |
| `amount` | NUMERIC(15,2) | NOT NULL | Amount paid. |
| `paid_by` | UUID | NULL | FK → `users.id`. |
| `paid_at` | TIMESTAMPTZ | NOT NULL | When paid. |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `workerPaymentService.ts`
**Note:** This table depends on the V1 `studio_tasks` table. Do not drop until `workerPaymentService` is decoupled.

---

### `employees`

**Canonical role:** Payroll employee records. Linked to `users` (staff who are also on payroll).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `user_id` | UUID | NOT NULL | FK → `users.id` CASCADE. UNIQUE. |
| `basic_salary` | NUMERIC | NOT NULL | Monthly base salary. |
| `commission_rate` | NUMERIC | NULL | Commission % on sales. |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `employeeService.ts`

---

## 16. Shipments & Packing

### `packing_lists`

**Canonical role:** Wholesale packing list generated from a sale. One packing list per sale.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `sale_id` | UUID | NOT NULL | FK → `sales.id` CASCADE. |
| `branch_id` | UUID | NULL | FK → `branches.id`. |
| `status` | VARCHAR(50) | NOT NULL | `draft`, `confirmed`, `shipped`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |
| `created_by` | UUID | NULL | FK → `users.id`. |

**Primary service:** `packingListService.ts`

---

### `packing_list_items`

**Canonical role:** Line items on a packing list (product, pieces, cartons, weight).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `packing_list_id` | UUID | NOT NULL | FK → `packing_lists.id` CASCADE. |
| `product_id` | UUID | NULL | FK → `products.id`. |
| `product_name` | VARCHAR(500) | NULL | Denormalized (for print). |
| `sku` | VARCHAR(255) | NULL | Denormalized SKU. |
| `pieces` | NUMERIC(15,2) | NOT NULL | Piece count. |
| `cartons` | NUMERIC(15,2) | NOT NULL | Carton count. |
| `weight` | VARCHAR(100) | NULL | Weight (e.g. "12.5 kg"). |
| `sort_order` | INT | NULL | Display sequence. |

**Primary service:** `packingListService.ts`

---

### `couriers`

**Canonical role:** Courier company master.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `name` | VARCHAR(255) | NOT NULL | Courier name. |
| `contact_phone` | VARCHAR(50) | NULL | Contact phone. |
| `is_active` | BOOLEAN | NOT NULL | Defaults `true`. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `courierService.ts`

---

### `courier_shipments`

**Canonical role:** Shipment record linking a packing list to a courier with tracking info and cost.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `packing_list_id` | UUID | NOT NULL | FK → `packing_lists.id` CASCADE. |
| `courier_id` | UUID | NULL | FK → `couriers.id`. |
| `tracking_number` | VARCHAR(255) | NULL | Courier tracking number. |
| `shipment_cost` | NUMERIC(15,2) | NOT NULL | Freight cost. Defaults `0`. |
| `status` | VARCHAR(50) | NOT NULL | `pending`, `booked`, `dispatched`, `delivered`. |
| `notes` | TEXT | NULL | Notes. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |
| `created_by` | UUID | NULL | FK → `users.id`. |

**Primary service:** `courierShipmentService.ts`, `shipmentAccountingService.ts`

---

## 17. Sequences & Numbering

### `erp_document_sequences` (canonical)

**Canonical role:** Current active document numbering engine. Per-company, per-branch, per-document-type sequence with year-reset and branch-scoping support.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `branch_id` | UUID | NOT NULL | FK (or sentinel UUID for global sequences). |
| `document_type` | TEXT | NOT NULL | Document type key: `sale`, `purchase`, `payment`, `expense`, `return`, etc. |
| `prefix` | VARCHAR(20) | NOT NULL | Prefix string (e.g. `SL-`, `PUR-`). |
| `year` | INTEGER | NOT NULL | Fiscal year. `0` = no year reset (non-resetting sequences). |
| `last_number` | INTEGER | NOT NULL | Last assigned number. Next = `last_number + 1`. |
| `padding` | INTEGER | NOT NULL | Zero-pad width. Defaults `4` (SL-0001). |
| `year_reset` | BOOLEAN | NULL | When `true`, sequence resets each year. Defaults `true`. |
| `branch_based` | BOOLEAN | NULL | When `true`, each branch has its own sequence. Defaults `false`. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated on each increment. |

**Constraints:** PK `id`; UNIQUE `(company_id, branch_id, document_type, year)`.
**Primary function:** `generate_document_number(company_id, branch_id, document_type, include_year)` — returns next formatted document number atomically.
**Primary service:** `documentNumberService.ts`, `settingsService.ts`, `numberingMaintenanceService.ts`

---

### `document_sequences_global` (fallback legacy)

**Canonical role:** Legacy global (company-wide, no branch) sequence table. Used by companies created before per-branch sequences were introduced, and by older modules (credit notes, refunds, returns) not yet migrated to `erp_document_sequences`.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `company_id` | UUID | NOT NULL | Part of PK. FK → `companies.id`. |
| `document_type` | TEXT | NOT NULL | Part of PK. |
| `current_number` | BIGINT | NOT NULL | Last assigned number. |
| `updated_at` | TIMESTAMPTZ | NULL | When last incremented. |

**Constraints:** PK `(company_id, document_type)`.
**Primary function:** `get_next_document_number_global(company_id, type)` — returns formatted number (e.g. `SL-0001`).
**Note:** The comment in `erp_legacy_table_comments.sql` marks `document_sequences` (the third legacy table) as not to be dropped. `document_sequences_global` is the operational fallback — it is live.

---

### `document_sequences` (deprecated, retain for credit notes / returns)

**Canonical role:** Original sequence table from base schema. Marked legacy in `erp_legacy_table_comments.sql`. Some modules (credit notes, refunds, returns) still use this.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `branch_id` | UUID | NULL | FK → `branches.id`. |
| `document_type` | VARCHAR(50) | NOT NULL | Document type key. |
| `prefix` | VARCHAR(20) | NOT NULL | Prefix. |
| `current_number` | INTEGER | NOT NULL | Last assigned. Defaults `0`. |
| `padding` | INTEGER | NOT NULL | Zero-pad width. Defaults `4`. |
| `updated_at` | TIMESTAMPTZ | NULL | Last update. |

**Constraints:** PK `id`; UNIQUE `(company_id, branch_id, document_type)`.
**Do not drop** until all dependents are migrated to `erp_document_sequences`.

---

## 18. Settings & Config

### `settings`

**Canonical role:** Generic key-value settings store for company-level configuration (JSONB values for flexible schema evolution).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id` CASCADE. |
| `key` | VARCHAR(255) | NOT NULL | Setting key (e.g. `pos_settings`, `sales_settings`, `numbering_rules`). |
| `value` | JSONB | NOT NULL | Setting value (structured JSONB). |
| `category` | VARCHAR(100) | NULL | Grouping label (`general`, `accounting`, `sales`, etc.). |
| `description` | TEXT | NULL | Human-readable description. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated. |

**Constraints:** PK `id`; UNIQUE `(company_id, key)`.
**RLS:** Company-scoped.
**Primary service:** `settingsService.ts`
**Notes:** `SettingsProvider` reads all settings once per session and distributes via `useSettings()`. All modules should read from context, not query this table directly.

---

### `modules_config` (deprecated)

The original standalone modules config table. Superseded by `companies.modules_config` JSONB column. Retained to avoid breaking legacy reads. Do not write new module toggles here.

---

## 19. Audit & Integrity

### `audit_logs`

**Canonical role:** Record of sensitive data mutations (INSERT, UPDATE, DELETE) across key business tables.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `user_id` | UUID | NULL | FK → `users.id`. |
| `table_name` | VARCHAR(100) | NOT NULL | Table where change occurred. |
| `record_id` | UUID | NOT NULL | PK of the changed row. |
| `action` | VARCHAR(50) | NOT NULL | `INSERT`, `UPDATE`, `DELETE`. |
| `old_data` | JSONB | NULL | Row state before change (for UPDATE and DELETE). |
| `new_data` | JSONB | NULL | Row state after change (for INSERT and UPDATE). |
| `ip_address` | INET | NULL | Client IP. |
| `user_agent` | TEXT | NULL | Browser user agent. |
| `created_at` | TIMESTAMPTZ | NOT NULL | When the audit event occurred. |

**Primary service:** `auditLogService.ts`

---

### `journal_party_contact_mapping`

**Canonical role:** AR/AP reconciliation support table. Maps party contact IDs to their GL account (subledger) IDs for fast reconciliation queries.

Created by migration `20260330_ar_ap_repair_workflows.sql`. Used by `arApReconciliationCenterService.ts` and related reconciliation services.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NOT NULL | PK. |
| `company_id` | UUID | NOT NULL | FK → `companies.id`. |
| `contact_id` | UUID | NOT NULL | FK → `contacts.id`. |
| `account_id` | UUID | NOT NULL | FK → `accounts.id`. The party subledger GL account. |
| `party_type` | VARCHAR(20) | NOT NULL | `customer` (AR) or `supplier` (AP). |
| `created_at` | TIMESTAMPTZ | NOT NULL | Auto-set. |

**Primary service:** `arApReconciliationCenterService.ts`, `partySubledgerAccountService.ts`

---

### Backup tables (PF-14.5B — do not drop)

| Table | Purpose |
|-------|---------|
| `backup_pf145_journal_entries` | Pre-void / pre-cleanup backup of `journal_entries` rows. Audit trail. |
| `backup_pf145_journal_entry_lines` | Corresponding line backup. |

These tables are write-once audit backups. Never drop them.

---

## 20. Legacy Tables (do not use)

The following tables are formally deprecated. New code must not read from or write to these tables. They are retained solely to avoid breaking legacy FKs or batch-migration scripts.

| Table | Deprecated In Favour Of | Comments |
|-------|------------------------|----------|
| `sale_items` | `sales_items` | Legacy sale line items. `sale_return_items.sale_item_id` FK still points here. Do not drop until FK is migrated. See P3-02. |
| `chart_accounts` | `accounts` + `journal_entries` + `journal_entry_lines` | Original chart of accounts. Not used by active posting path. Comment: `'LEGACY: Posting uses accounts + journal_entries + journal_entry_lines. Not used by app. Do not drop.'` |
| `ledger_master` | `accounts` | Legacy subledger. In `LEGACY_TABLE_BLOCKLIST`. |
| `ledger_entries` | `journal_entry_lines` | Legacy ledger lines. Blocked. |
| `backup_cr` | n/a | Legacy backup table from a prior migration. Audit only. |
| `modules_config` (table) | `companies.modules_config` (column) | Standalone table superseded by JSONB column. |
| `employee_ledger` | `worker_ledger_entries` + `journal_entry_lines` | Legacy employee ledger. Linked to `employees` (payroll). Not used in active Studio V3 flow. |

The `accountingCanonicalGuard` service enforces `LEGACY_TABLE_BLOCKLIST`. Any GL query that reads these tables is flagged with a warning and blocked in production GL computation paths.

---

## Quick Reference: Canonical Balance Formulas

| Balance | Formula | Notes |
|---------|---------|-------|
| Cash in Hand | `SUM(jel.debit) - SUM(jel.credit)` on account code `1000` | All-time, `is_void = false` |
| Bank Balance | Same on `type = 'bank'` accounts | Aggregates all bank accounts |
| AR (per customer) | `SUM(jel.debit) - SUM(jel.credit)` on child account where `linked_contact_id = $customerId` | Subledger of account 1100 |
| AP (per supplier) | `SUM(jel.credit) - SUM(jel.debit)` on child account where `linked_contact_id = $supplierId` | Subledger of account 2000 |
| Inventory Value | `SUM(jel.debit) - SUM(jel.credit)` on account code `1200` | Not `inventory_balance.total_value` |
| Revenue | `SUM(jel.credit) - SUM(jel.debit)` on account code `4100` | Date-filtered |
| COGS | `SUM(jel.debit) - SUM(jel.credit)` on codes `5000`, `5010`, `5100`, `5110` | |
| Operating Expense | `SUM(jel.debit) - SUM(jel.credit)` on codes `5200`, `5300`, and other 5xxx not in COGS set | |
| Stock Quantity | `SUM(sm.quantity_change)` per `(product_id, variation_id, branch_id)` | Not `products.current_stock` |
| Opening Equity | `SUM(jel.credit) - SUM(jel.debit)` on account code `3000` | Seed + all P&L net since opening |

All queries above must JOIN `journal_entries` and filter `is_void = false`. Branch filter: include JEs where `branch_id IS NULL` (company-wide) OR `branch_id = $targetBranch`.

---

## Enforcement Mechanisms

| Mechanism | Location | What It Does |
|-----------|----------|-------------|
| `assertGlTruthQueryTable` | `accountingCanonicalGuard.ts` | Called at the top of any GL-reading function. Documents that `journal_entry_lines` is the source. |
| `warnIfUsingStoredBalanceAsTruth` | `AccountingContext.tsx` | Warns when `accounts.balance` is read as a live GL balance. |
| `LEGACY_TABLE_BLOCKLIST` | `accountingCanonicalGuard.ts` | Array of deprecated table names. Any query reading them is flagged. |
| `idx_journal_entries_fingerprint_active` | DB index | Unique partial index on `(company_id, action_fingerprint) WHERE fingerprint IS NOT NULL AND is_void IS NOT TRUE`. Prevents duplicate JEs from retries. |
| `paymentChainMutationGuard` | `paymentChainMutationGuard.ts` | Blocks edits to non-tail payments in a PF-14 chain. |
| `accountingCanonicalGuard.ts` (source-owned protection) | `accountingCanonicalGuard.ts` | JEs with `source_type` set cannot be mutated from the manual JE page. |

---

_Document produced by static analysis of 117 service files, 258+ migrations, and the canonical `supabase-extract/schema.sql`. Last updated: 2026-04-12._
