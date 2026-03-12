# ERP Health Report

**Generated:** 2026-03-12 17:45:47  
**Overall:** PASS

---

## 1. Inventory Health

| Check | Result |
|-------|--------|
| product_variations stock column(s) | stock |
| stock_movements table | OK |
| inventory_balance | OK |
| inventory_settings | SKIP |
| negative_stock_setting | OK |

## 2. API / Database Readiness

| Component | Status | Details |
|------------|--------|--------|
| activity_logs | OK | performed_by checked |
| auth.users | OK | Table exists |
| contacts | OK | Walk-in count checked |
| document_sequences_global | OK | Table and RLS checked |
| inventory_balance | OK | Table exists |
| inventory_settings | SKIP | Table does not exist (negative stock may be in settings key) |
| journal_entries | OK | Table exists |
| ledger_master | OK | Table exists |
| negative_stock_setting | OK | Use settings key inventory_settings or allow_negative_stock |
| payments | OK | received_by checked |
| public.users | OK | Table and auth_user_id checked |
| sales | OK | RLS and created_by checked |
| settings | OK | Table exists |
| user_account_access | OK | Table exists |
| user_branches | OK | Table exists |

## 3. Purchase & Sales Schema

| Item | Value |
|------|-------|
| purchases.status type | USER-DEFINED (purchase_status) |
| schema_migrations count | 255 |

## 4. Mobile vs Web Differences

- **Variation stock:** Mobile uses `product_variations.stock` → `stock_quantity` → aggregate from `stock_movements`. No `current_stock` (column may not exist).
- **Purchase status:** Mobile sends only `status: 'final'` on Mark as Final. DB enum must include `final`. Run `SELECT unnest(enum_range(NULL::purchase_status));` to confirm.
- **Packing:** Mobile uses `packing_details` (total_boxes, total_pieces, total_meters) on purchase_items.

## 5. Performance Warnings

- Run `erp_full_health_check.sql` and review RLS/column checks above.
- Ensure indexes exist on `sales(company_id, status)`, `purchases(company_id)`, `stock_movements(reference_type, reference_id)`, `product_variations(product_id)`.

## 6. Missing Features / Follow-ups

- Re-run: `node scripts/erp-health-report.js` after schema or env changes.
