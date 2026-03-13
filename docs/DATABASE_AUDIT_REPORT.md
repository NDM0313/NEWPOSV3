# ERP Database Audit Report

**Project:** NEW POSV3 ERP  
**Audit Type:** Read-only (no schema changes, no drops, no renames)  
**Date:** 2026-03-13  
**Source:** Schema snapshot, migrations, triggers snapshot, and codebase analysis

---

## 1. Executive Summary

This audit documents the complete PostgreSQL database structure for the ERP project. The database contains **116 tables** (public schema) plus views and Supabase platform objects. Core transactional flows (sales, purchases, inventory, accounting, studio production, rentals) are well represented with company_id/branch_id scoping. Several **versioned or legacy structures** exist (studio v2/v3 tables, chart_accounts vs accounts, sales_items vs sale_items). **studio_orders** has been dropped in favor of **studio_productions** + **studio_production_stages**. Accounting is centered on **journal_entries** and **journal_entry_lines**, with **accounts** as the chart; **ledger_master** / **ledger_entries** and **chart_accounts** / **account_transactions** appear to be alternate or legacy accounting paths. No modifications were made; this is documentation only.

---

## 2. Total Table Count

| Scope | Count |
|-------|--------|
| **Public schema tables** (from db_schema_snapshot) | 116 |
| **Views** (from migration grep) | 5+ (sales_with_shipping, courier_ledger, courier_summary, shipment_ledger, erp_health_dashboard) |
| **Supabase / system** | auth.users, storage.objects, storage.buckets, realtime.subscription, etc. (not in snapshot table_list) |

*Row counts and live constraint lists were not collected (read-only audit without executing COUNT or information_schema queries against a live DB).*

---

## 3. Core ERP Tables

These tables form the backbone of the ERP and are referenced by both web and mobile app and by migrations/triggers.

| Table | Purpose | company_id | branch_id | created_at/updated_at | Notes |
|-------|---------|------------|-----------|------------------------|-------|
| **companies** | Tenant root | — | — | yes | Primary entity for multi-tenant |
| **branches** | Locations per company | yes | — | yes | Default branch, default accounts |
| **users** | ERP users (linked to auth) | yes | — | yes | user_branches links to branches |
| **user_branches** | User–branch assignment | — | yes | yes | |
| **contacts** | Customers, suppliers, workers | yes | — | yes | type: customer/supplier/both |
| **roles** | Role definitions | yes | — | yes | |
| **product_categories** | Product grouping | yes | — | yes | parent_id self-FK |
| **products** | Product master | yes | — | yes | category_id, brand_id, unit_id |
| **product_variations** | Variants per product | — (via product) | — | yes | product_id FK |
| **sales** | Sales/invoices | yes | yes | yes | customer_id, status, payment_status |
| **sale_items** | Invoice line items | — (via sale) | — | created_at | sale_id, product_id, variation_id |
| **purchases** | Purchase orders | yes | yes | yes | supplier_id |
| **purchase_items** | PO line items | — (via purchase) | — | created_at | purchase_id |
| **stock_movements** | Inventory movements (source of truth) | yes | yes | yes | product_id, variation_id, reference_type/id |
| **accounts** | Chart of accounts (ERP) | yes | — | — | code, type, used by journal lines |
| **journal_entries** | Double-entry headers | yes | yes | yes | reference_type, reference_id |
| **journal_entry_lines** | Double-entry lines | — (via entry) | — | created_at | journal_entry_id, account_id, debit, credit |
| **payments** | Payment transactions | yes | — | yes | reference_type, reference_id (sale/purchase) |
| **expenses** | Expense transactions | yes | — | yes | category, account, payment_account_id |
| **settings** | Key-value settings | yes | — | — | category, key, value |
| **modules_config** | Enabled modules per company | yes | — | — | |
| **document_sequences** | Number sequences (legacy?) | — | yes | — | |
| **erp_document_sequences** | ERP numbering | yes | branch_id | — | |

---

## 4. Module-Wise Table Mapping

### Sales
- **sales**, **sale_items** (core)
- **sales_items** (overlap with sale_items; see Duplicate section)
- **sale_charges** (sale-level charges)
- **sale_returns**, **sale_return_items**
- **quotations**, **quotation_items**
- **credit_notes**, **refunds**
- **document_sequences** / **erp_document_sequences** (invoice numbering)

### Purchases
- **purchases**, **purchase_items** (core)
- **purchase_charges**
- **purchase_returns**, **purchase_return_items**

### Inventory
- **stock_movements** (source of truth)
- **inventory_balance** (derived/cache; may be updated by triggers)
- **products**, **product_variations**
- **product_categories**, **brands**, **units**
- **product_combos**, **product_combo_items**

### Accounting
- **accounts** (main chart used by app and journal_entry_lines)
- **journal_entries**, **journal_entry_lines**
- **payments** (linked to journal via reference)
- **expenses** (journal integration via RPC)
- **chart_accounts**, **account_transactions**, **accounting_audit_logs**, **accounting_settings**, **automation_rules** (16_chart_of_accounts; may be alternate or legacy accounting)
- **ledger_master**, **ledger_entries** (supplier/user ledgers; separate from journal)

### Studio Production
- **studio_productions** (linked to sales via sale_id)
- **studio_production_stages** (stages per production; worker, cost, status)
- **studio_production_logs**
- **studio_production_cost_breakdown_v3** (view or table)
- **workers**, **worker_ledger_entries**, **worker_payments**
- **studio_tasks** (legacy? trigger still references)
- **studio_production_orders_v2**, **studio_production_stages_v2**, **studio_stage_assignments_v2**, **studio_stage_receipts_v2**
- **studio_production_orders_v3**, **studio_production_stages_v3**
- *Dropped:* **studio_orders**, **studio_order_items** (per drop_studio_orders_legacy)

### Rentals
- **rentals**, **rental_items**, **rental_payments**

### Reporting / Analytics
- **erp_health_dashboard** (view)
- Report logic uses **sales**, **sale_items**, **purchases**, **journal_entries**, **stock_movements** (no dedicated report tables)

### Permissions & RBAC
- **roles**, **role_permissions**
- **user_branches**
- **user_account_access** (account-level access)

### Mobile & Sync
- **settings** (mobile_sync_status, mobile_printer, etc.)
- **feature_flags**
- No separate “mobile” tables; same core tables used by mobile app

### Shipping & Courier
- **sale_shipments**
- **couriers**
- **courier_shipments**
- **shipment_history**, **shipment_ledger** (views)
- **packing_lists**, **packing_list_items**
- **bulk_invoices**, **bulk_invoice_packing_lists**, **bulk_invoice_items**

### Automation
- **automation_rules** (accounting)
- **feature_flags**

### Manufacturing (optional module)
- **bill_of_materials**, **production_orders**, **production_steps**

### Invoicing / Templates
- **invoice_templates**
- **fiscal_calendar**

### Other
- **employees**, **employee_ledger** (payroll module)
- **job_cards** (studio legacy?)
- **contact_groups**
- **expense_categories**
- **print_logs**, **share_logs**
- **audit_logs**, **activity_logs**

---

## 5. System Tables

| Table / Object | Type | Notes |
|----------------|------|--------|
| **schema_migrations** | Table | Migration runner tracking (run-migrations.js) |
| **migration_history** | Table | Custom migration history (if used) |
| **erp_production_mode** | Table | Production mode flag |
| **public_contact_rate_limit** | Table | Rate limiting for public registration |
| **public_registration_config** | Table | Public signup config |
| **buckets** | Table | Supabase storage (storage.buckets) |
| **objects** | Table | Supabase storage (storage.objects) |
| **subscription** | Table | Realtime (realtime.subscription) |
| **auth.users** | — | Supabase Auth (not in public table_list) |

---

## 6. Possibly Unused / Legacy Tables

| Table | Reason |
|-------|--------|
| **studio_production_orders_v2**, **studio_production_stages_v2**, **studio_stage_assignments_v2**, **studio_stage_receipts_v2** | Versioned; v3 and base studio_productions/stages are used in app |
| **studio_production_orders_v3**, **studio_production_stages_v3**, **studio_production_cost_breakdown_v3** | Versioned; app uses **studio_productions** and **studio_production_stages** (no version suffix) |
| **studio_tasks** | Triggers reference it; studio flow may have moved to stages |
| **chart_accounts**, **account_transactions** | From 16_chart_of_accounts; app uses **accounts** + **journal_entries** / **journal_entry_lines** |
| **sales_items** | Duplicate/overlap with **sale_items** (see below) |
| **ledger_master**, **ledger_entries** | Used for supplier/user ledgers in ledgerService; distinct from journal_entries; may be legacy if fully replaced by journal |
| **document_sequences** | May be superseded by **erp_document_sequences** (both used in code) |
| **document_sequences_global** | Global sequences; usage unclear |
| **employees**, **employee_ledger** | Payroll; may be optional module |
| **job_cards** | Referenced with studio; may be legacy |
| **invoice_templates** (duplicate create in migrations) | Created in multiple migrations; single table |
| **numbering_rules** (in supabase-schema) | May not exist in current schema; alternative numbering |

*Dropped (no longer in DB if migration applied):* **studio_orders**, **studio_order_items**

---

## 7. Duplicate or Overlapping Structures

### sales_items vs sale_items
- **sale_items**: Created in 03_frontend_driven_schema; has triggers (trigger_calculate_sale_totals). Primary key, sale_id, product_id, etc.
- **sales_items**: Present in **table_list**; code often tries **sales_items** first then falls back to **sale_items** (e.g. packingListService, SaleContext, saleReturnService). Suggests **sales_items** may be the preferred name in some layers and **sale_items** the actual table with triggers. Both exist; application uses both names. **Recommendation:** Confirm in DB which one is the canonical table and which is view/synonym; standardize naming in code.

### Chart of accounts: accounts vs chart_accounts
- **accounts**: Used by journal_entry_lines, payments, expenses, branches (default_cash_account_id, etc.). Core ERP chart.
- **chart_accounts**: In 16_chart_of_accounts with parent_account_id, account_transactions, accounting_audit_logs. **Recommendation:** Clarify whether chart_accounts is legacy, alternate, or integrated; if unused, consider documenting as deprecated.

### Ledger: journal_entries vs ledger_master / ledger_entries
- **journal_entries** + **journal_entry_lines**: Main double-entry; sales, purchases, payments, expenses post here.
- **ledger_master** + **ledger_entries**: Used by ledgerService for supplier and user ledgers; customer ledger uses sales/payments (customerLedgerApi). **Recommendation:** Keep as-is if supplier/user ledgers are intentionally separate from journal; otherwise plan migration to journal-based ledger.

### Document numbering: document_sequences vs erp_document_sequences
- Both referenced in settingsService and numberingMaintenanceService. **erp_document_sequences** is company/branch scoped; **document_sequences** may be older. **Recommendation:** Unify or clearly assign which is canonical per document type.

---

## 8. Accounting Table Review

### Structure
- **accounts**: company_id, code, name, type; referenced by journal_entry_lines, expenses (payment_account_id), branches (default accounts).
- **journal_entries**: company_id, branch_id, entry_date, description, reference_type, reference_id (sale, purchase, payment, expense, refund, stock_adjustment).
- **journal_entry_lines**: journal_entry_id, account_id, debit, credit, description. No total_debit/total_credit on header in base schema; some migrations add them.
- **payments**: reference_type, reference_id; triggers create journal entries (trigger_auto_create_payment_journal, etc.).
- **expenses**: RPC/expense flow creates journal entries (09_expense_transaction, refundService).
- Sales: **trigger_auto_post_sale_to_accounting** on sales; also SalesContext creates journal entry on finalize.
- Purchases: Journal entries created from PurchaseContext and/or RPC.
- Stock adjustments: **stock_adjustment_journal_entries** migration creates JEs for movement_type = 'adjustment'.

### Integrity
- **check_journal_entries_balance()** (function) returns unbalanced entries; no DB trigger enforcing balance (to allow multi-line inserts).
- **journal_entry_lines** has triggers: trigger_update_account_balance (INSERT/UPDATE/DELETE).
- **chart_accounts** / **account_transactions** (16_chart_of_accounts) are a separate tree; **journal_entry_lines** reference **accounts**, not chart_accounts. So primary accounting path is **accounts** + **journal_entries** + **journal_entry_lines**.

### Indexes (from migrations)
- journal_entries: company_id, entry_date, (reference_type, reference_id), (company_id, created_at)
- journal_entry_lines: journal_entry_id, account_id
- report_performance_indexes, journal_entry_lines_performance_indexes add further composites.

### Conclusion
Accounting is centered on **accounts**, **journal_entries**, and **journal_entry_lines**. Sales, purchases, payments, expenses, refunds, and stock adjustments are wired to post journal entries. **chart_accounts** and **account_transactions** appear to be an alternate or legacy path and are not the main path in app code.

---

## 9. Performance / Index Observations

- **stock_movements**: Indexes on (company_id, product_id), (company_id, variation_id), (company_id, created_at), reference; appropriate for inventory and reporting.
- **sales**: (company_id, invoice_date), (company_id, created_at), invoice_no, customer_id, branch_id.
- **purchases**: (company_id, created_at), po_no, supplier_id, branch_id.
- **journal_entries**: (company_id, entry_date), (reference_type, reference_id), (company_id, created_at).
- **payments**: reference_type, reference_id, company_id, payment_date.
- **contacts**: company_id, type; RLS and module policies add complexity.
- **studio_production_stages**: production_id, status; workflow triggers add load.

Recommendation: Ensure all high-volume transactional tables (sales, purchases, stock_movements, journal_entries, payments) have composite indexes matching filters (company_id + date, company_id + reference). Phase 4 migration (erp_phase4_performance_indexes) adds several of these.

---

## 10. Recommended Next Cleanup Plan

1. **Confirm sales_items vs sale_items**: Run `\d sales_items` and `\d sale_items` (or information_schema) to see which is table/view; then standardize app to one name and document the other as alias/deprecated.
2. **Clarify chart_accounts vs accounts**: If chart_accounts is unused by app, mark as deprecated and plan read-only or eventual drop after backup; if used by reports, document the two accounting paths.
3. **Studio versioned tables**: If v2/v3 studio tables are unused, consider marking deprecated and archiving; keep only **studio_productions** and **studio_production_stages** as canonical.
4. **document_sequences vs erp_document_sequences**: Decide single source of truth per document type and migrate callers; then deprecate the other.
5. **ledger_master / ledger_entries**: If all ledgers can be derived from journal_entries + reference_type, consider consolidating; otherwise keep and document as “non-journal ledgers”.
6. **Row counts and orphans**: Run a one-time script (read-only) to count rows per table and list tables with zero rows or no incoming FK references; feed into cleanup list.
7. **Index audit**: Compare current indexes (information_schema or pg_indexes) to migration files and add any missing composites for company_id + date and reference lookups.

---

*End of report. No schema changes were made.*
