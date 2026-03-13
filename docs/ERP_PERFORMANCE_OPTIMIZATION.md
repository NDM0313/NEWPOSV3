# ERP Performance Optimization

**Project:** NEW POSV3 ERP  
**Date:** 2026-03-13  
**Phase:** 4 — Performance Optimization (Master Roadmap)

---

## 1. Goal

Improve **ERP speed and query performance**: slow dashboard loading, heavy queries, missing indexes, repeated permission checks.

---

## 2. Required indexes (applied)

Migration `migrations/erp_phase4_performance_indexes.sql` adds:

| Index | Table | Columns | Use |
|-------|--------|---------|-----|
| idx_stock_movements_company_product | stock_movements | (company_id, product_id) | Inventory by company + product |
| idx_stock_movements_company_variation | stock_movements | (company_id, variation_id) | Variation-level stock |
| idx_sales_company_created_at | sales | (company_id, created_at DESC) | Recent sales, dashboard |
| idx_purchases_company_created_at | purchases | (company_id, created_at DESC) | Recent purchases, dashboard |
| idx_journal_entries_company_created_at | journal_entries | (company_id, created_at DESC) | Ledger and report date filters |

Existing indexes (from other migrations) already cover: journal_entries (company, entry_date, reference), sales (company, invoice_date), purchases (company, po_date), stock_movements (company, product, created_at).

---

## 3. Query improvements (recommendations)

- **Aggregated views:** Consider materialized views or cached aggregates for dashboard KPIs (e.g. today’s sales, low stock count) if needed.
- **Dashboard caching:** Frontend can cache dashboard data with short TTL (e.g. globalSettingsService pattern); optional server-side cache for heavy RPCs.
- **Supabase RPC:** Optimize heavy report RPCs to use the new indexes (filter by company_id, then date/created_at).

---

## 4. Outputs

- This document: `docs/ERP_PERFORMANCE_OPTIMIZATION.md`
- Migration: `migrations/erp_phase4_performance_indexes.sql`
