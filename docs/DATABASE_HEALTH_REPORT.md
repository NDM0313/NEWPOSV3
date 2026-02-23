# Database Health Report — GO-LIVE READINESS

**Generated:** 2025-02-23  
**Scope:** NEWPOSV3 ERP — Supabase PostgreSQL (self-hosted on VPS)

---

## 1. Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Foreign Key Integrity | ✅ Pass | 78+ FKs with appropriate ON DELETE actions |
| Indexes | ✅ Pass | Company/branch/date indexes on transaction tables |
| Unique Constraints | ⚠️ Review | Some tables lack UNIQUE on invoice_no/po_no per company |
| Enum Consistency | ✅ Pass | sale_status, purchase_status, payment_status aligned |
| RLS Policies | ✅ Pass | Company-scoped with has_branch_access() |
| Audit Fields | ⚠️ Partial | Some line-item tables missing updated_at |
| Soft Delete | ⚠️ Mixed | Status-based + cancelled_at columns; no unified deleted_at |

---

## 2. Foreign Key Integrity

### Core Tables
| Table | FK | ON DELETE | Status |
|-------|-----|-----------|--------|
| branches | company_id → companies | CASCADE | ✅ |
| users | company_id → companies | CASCADE | ✅ |
| contacts | company_id → companies | CASCADE | ✅ |
| products | company_id, category_id | CASCADE, SET NULL | ✅ |
| sales | company_id, branch_id, customer_id, created_by | CASCADE, RESTRICT, SET NULL | ✅ |
| purchases | company_id, branch_id, supplier_id, created_by | CASCADE, RESTRICT, SET NULL | ✅ |
| sale_items | sale_id, product_id, variation_id | CASCADE, RESTRICT, SET NULL | ✅ |
| purchase_items | purchase_id, product_id, variation_id | CASCADE, RESTRICT, SET NULL | ✅ |
| stock_movements | company_id, branch_id, product_id, variation_id | CASCADE, SET NULL, RESTRICT | ✅ |
| journal_entries | company_id, branch_id, created_by | CASCADE, SET NULL | ✅ |
| journal_entry_lines | journal_entry_id, account_id | CASCADE, RESTRICT | ✅ |
| payments | company_id, branch_id, payment_account_id, created_by | CASCADE, SET NULL | ✅ |
| accounts | company_id | CASCADE | ✅ |

### Orphan Risk
- **journal_entry_lines**: CASCADE on journal_entry_id — no orphans if parent deleted.
- **payments**: reference_type + reference_id link to sales/purchases; no FK. Orphan payments possible if sale/purchase hard-deleted. **Recommendation:** Add application-level validation or soft-delete only.
- **stock_movements**: reference_type + reference_id; no FK to sales/purchases. Orphan movements possible. **Recommendation:** Document as intentional (audit trail preserved).

---

## 3. Missing Indexes

| Table | Recommended Index | Status |
|-------|-------------------|--------|
| sales | (company_id, invoice_no) UNIQUE | ⚠️ No UNIQUE — duplicate invoice numbers possible |
| purchases | (company_id, po_no) UNIQUE | ⚠️ No UNIQUE — duplicate PO numbers possible |
| journal_entries | (company_id, entry_no) | Check existing |
| payments | (reference_type, reference_id) | Exists |
| stock_movements | (reference_type, reference_id) | Exists |

**Critical:** Invoice/PO numbering is application-managed (document_sequences, RPC). No DB-level UNIQUE on invoice_no/po_no per company+branch. Race conditions could produce duplicates. **Recommendation:** Add UNIQUE(company_id, branch_id, invoice_no) for sales; UNIQUE(company_id, branch_id, po_no) for purchases if numbering is per-branch.

---

## 4. Duplicate Sequences

- **UUID primary keys:** All tables use `uuid_generate_v4()` — no sequence conflicts.
- **Document numbering:** `document_sequences` table + application logic. No PostgreSQL sequences for invoice/PO numbers.
- **Status:** No duplicate sequences detected.

---

## 5. Missing Unique Constraints

| Table | Column(s) | Status |
|-------|-----------|--------|
| companies | (email) | ⚠️ Email not UNIQUE — multiple companies can share email |
| branches | (company_id, code) | Exists in 03 schema |
| users | (company_id, email) | Per-company unique |
| accounts | (company_id, code) | ✅ UNIQUE |
| products | (company_id, sku) | ✅ UNIQUE |
| sales | (company_id, branch_id, invoice_no) | ❌ Missing |
| purchases | (company_id, branch_id, po_no) | ❌ Missing |

---

## 6. Enum Fields Consistency

| Enum | Values | Used By |
|------|--------|---------|
| sale_status | draft, quotation, order, final, cancelled | sales |
| purchase_status | draft, ordered, received, final, cancelled | purchases |
| payment_status | paid, partial, unpaid | sales, purchases |
| payment_method | cash, bank, card, wallet, cheque, other | payments |
| user_role | admin, manager, accountant, salesperson, inventory_clerk, viewer | users |

**Status:** Consistent across schema. No conflicting enum values.

---

## 7. Status Fields Across Sales/Purchases

| Field | Sales | Purchases | Aligned |
|-------|-------|-----------|--------|
| status | draft→quotation→order→final, cancelled | draft→ordered→received→final, cancelled | ✅ |
| payment_status | paid, partial, unpaid | paid, partial, unpaid | ✅ |
| cancelled_at | Yes (migration 46) | Yes (migration 46) | ✅ |
| cancelled_by | Yes | Yes | ✅ |
| cancel_reason | Yes | Yes | ✅ |

---

## 8. Financial Year Linkage

- **companies.financial_year_start:** DATE column (03_frontend_driven_schema). Used for reporting.
- **No financial_year_id** on transactions. Date-based filtering used (invoice_date, entry_date within fiscal range).
- **Status:** Financial year is company-level config; transactions use dates. No FK to fiscal period table.

---

## 9. Branch Linkage

| Table | branch_id | ON DELETE | Nullable |
|-------|-----------|-----------|----------|
| sales | Yes | RESTRICT | No |
| purchases | Yes | RESTRICT | No |
| stock_movements | Yes | SET NULL | Yes |
| journal_entries | Yes | SET NULL | Yes |
| payments | Yes | SET NULL | Yes |
| expenses | Yes | SET NULL | Yes |

**company_id enforcement:** All transaction tables have company_id NOT NULL. ✅

---

## 10. RLS Policies Correctness

- **Pattern:** `company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())`
- **Branch filter:** `has_branch_access(branch_id)` for branch-scoped tables.
- **Helper functions:** `get_user_company_id()`, `get_user_role()`, `has_module_permission()`, `has_branch_access()`.
- **Status:** RLS enabled on all public tables. Policies use company scoping. ✅

---

## 11. Soft Delete vs Hard Delete Consistency

| Pattern | Tables | Notes |
|---------|--------|-------|
| status = 'cancelled' | sales, purchases | Soft cancel |
| cancelled_at, cancelled_by, cancel_reason | sales, purchases | Audit trail |
| is_active = false | companies, branches, users, contacts, products, accounts | Soft disable |
| Hard delete | sale_items, purchase_items (CASCADE) | Line items deleted with parent |
| Draft delete | sales, purchases (status=draft) | Hard delete allowed |

**Inconsistency:** No unified `deleted_at` column. Mix of status-based and is_active. Document for operators.

---

## 12. Audit Fields (created_at, updated_at)

| Table | created_at | updated_at | Trigger |
|-------|------------|------------|---------|
| companies, branches, users | ✅ | ✅ | update_updated_at_column |
| sales, purchases, expenses | ✅ | ✅ | ✅ |
| journal_entries, accounts | ✅ | ✅ | ✅ |
| stock_movements | ✅ | ❌ | — |
| payments | ✅ | ❌ | — |
| journal_entry_lines | ✅ | ❌ | — |
| sale_items, purchase_items | ✅ | ❌ | — |

**Recommendation:** Add updated_at to stock_movements, payments for audit completeness. Low priority for go-live.

---

## 13. Data Integrity Checks (Pre-Truncate)

**Run these queries before truncate to verify:**

```sql
-- 1. Unbalanced journal entries (should return 0)
SELECT je.id, je.entry_no, 
  SUM(jel.debit) as total_debit, SUM(jel.credit) as total_credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
GROUP BY je.id, je.entry_no
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01;

-- 2. Orphan journal entries (reference deleted)
-- Manual check: journal_entries where reference_type='sale' and reference_id not in sales

-- 3. Orphan stock movements
-- reference_type + reference_id — no FK; acceptable for audit

-- 4. Orphan payments
SELECT p.id, p.reference_type, p.reference_id FROM payments p
LEFT JOIN sales s ON p.reference_type='sale' AND p.reference_id::uuid = s.id
LEFT JOIN purchases pu ON p.reference_type='purchase' AND p.reference_id::uuid = pu.id
WHERE (p.reference_type='sale' AND s.id IS NULL) OR (p.reference_type='purchase' AND pu.id IS NULL);

-- 5. Duplicate invoice numbers (per company/branch)
SELECT company_id, branch_id, invoice_no, COUNT(*) 
FROM sales GROUP BY company_id, branch_id, invoice_no HAVING COUNT(*) > 1;

-- 6. Duplicate PO numbers
SELECT company_id, branch_id, po_no, COUNT(*) 
FROM purchases GROUP BY company_id, branch_id, po_no HAVING COUNT(*) > 1;
```

---

## 14. Recommendations Summary

| Priority | Item | Action |
|----------|------|--------|
| High | Duplicate invoice/PO prevention | Add UNIQUE(company_id, branch_id, invoice_no) on sales; same for purchases |
| Medium | Orphan payments | Document behavior; consider soft-delete only for sales/purchases |
| Low | updated_at on stock_movements, payments | Add in future migration |
| Low | Unified deleted_at | Consider for future schema v2 |

---

## 15. Verdict

**Database structure is GO-LIVE READY** with noted caveats. Critical business logic (double-entry, FKs, RLS) is sound. Duplicate invoice risk is application-managed; add DB constraint if numbering is stable.
