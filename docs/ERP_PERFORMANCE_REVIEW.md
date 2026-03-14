# ERP Performance Review (Safe Cleanup Plan)

**Goal:** Ensure heavy tables have indexes for **company_id + date**, **company_id + created_at**, and **reference_type + reference_id** where applicable. **No schema changes in this phase** — analysis and recommendations only.

---

## 1. Heavy tables in scope

- sales  
- purchases  
- stock_movements  
- journal_entries  
- payments  

---

## 2. sales

### 2.1 Existing indexes (from migrations)

| Index | Definition | Source |
|-------|------------|--------|
| idx_sales_company | sales(company_id) | sales_products_rls_role_based.sql |
| idx_sales_branch | sales(branch_id) | sales_products_rls_role_based.sql |
| idx_sales_company_date | sales(company_id, invoice_date or date) | shipping_accounting_full_integration.sql, final_web_erp_performance_indexes.sql |
| idx_sales_company_created_at | sales(company_id, created_at) | erp_phase4_performance_indexes.sql |
| idx_sales_customer_id | sales(customer_id) | shipping_accounting_full_integration.sql |

### 2.2 Recommended coverage

| Pattern | Status |
|---------|--------|
| company_id + date (invoice_date) | **Present** (idx_sales_company_date) |
| company_id + created_at | **Present** (idx_sales_company_created_at) |
| reference_type + reference_id | N/A (sales is the reference target, not the referrer) |

**Conclusion:** sales is well covered. No change required.

---

## 3. purchases

### 3.1 Existing indexes

| Index | Definition | Source |
|-------|------------|--------|
| idx_purchases_company_created_at | purchases(company_id, created_at) | erp_phase4_performance_indexes.sql |

### 3.2 Recommended coverage

| Pattern | Status |
|---------|--------|
| company_id + date (po_date / order_date) | **Check** — no idx found for (company_id, po_date). Add **idx_purchases_company_po_date** if reports filter by date. |
| company_id + created_at | **Present** |
| reference_type + reference_id | N/A |

**Recommendation:** Add index for date-based listing/reports when confirmed needed:  
`CREATE INDEX IF NOT EXISTS idx_purchases_company_po_date ON purchases(company_id, po_date);`  
(or the actual date column name used in app: po_date, order_date, etc.). Defer until column name is confirmed and workload verified.

---

## 4. stock_movements

### 4.1 Existing indexes

| Index | Definition | Source |
|-------|------------|--------|
| idx_stock_movements_company_product | stock_movements(company_id, product_id) | erp_phase4_performance_indexes.sql |
| idx_stock_movements_company_variation | stock_movements(company_id, variation_id) | erp_phase4_performance_indexes.sql |

Other indexes may exist (e.g. company_id + created_at, reference) in additional migrations.

### 4.2 Recommended coverage

| Pattern | Status |
|---------|--------|
| company_id + date / created_at | **Check** — add **idx_stock_movements_company_created_at** if listing/filtering by time. |
| reference_type + reference_id | **Check** — add **idx_stock_movements_reference** if lookups by reference (sale_id, purchase_id) are common. |

**Recommendation:** Add when needed:  
- `CREATE INDEX IF NOT EXISTS idx_stock_movements_company_created_at ON stock_movements(company_id, created_at);`  
- `CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);`  
(Only after confirming column names and query patterns.)

---

## 5. journal_entries

### 5.1 Existing indexes

| Index | Definition | Source |
|-------|------------|--------|
| idx_journal_entries_company_id | journal_entries(company_id) | journal_entry_lines_performance_indexes.sql |
| idx_journal_entries_reference | journal_entries(reference_type, reference_id) | journal_entry_lines_performance_indexes.sql, shipping_accounting_full_integration.sql |
| idx_journal_entries_company_reftype | journal_entries(company_id, reference_type) | journal_entry_lines_performance_indexes.sql |
| idx_journal_entries_branch_id | journal_entries(branch_id) | journal_entry_lines_performance_indexes.sql |
| idx_journal_entries_entry_date | journal_entries(entry_date) | journal_entry_lines_performance_indexes.sql |
| idx_journal_entries_company_entry_date | journal_entries(company_id, entry_date) | journal_entry_lines_performance_indexes.sql, report_performance_indexes.sql |
| idx_journal_entries_company_created_at | journal_entries(company_id, created_at) | erp_phase4_performance_indexes.sql |
| idx_journal_entries_company_reference_type | journal_entries(company_id, reference_type) | shipping_accounting_performance_indexes.sql |
| idx_journal_entries_company_date | journal_entries(company_id, entry_date) | shipping_accounting_full_integration.sql |
| idx_journal_entries_company_branch_entry_date | journal_entries(company_id, branch_id, entry_date) | report_performance_indexes.sql |

### 5.2 Recommended coverage

| Pattern | Status |
|---------|--------|
| company_id + date (entry_date) | **Present** |
| company_id + created_at | **Present** |
| reference_type + reference_id | **Present** |

**Conclusion:** journal_entries is well covered. No change required.

---

## 6. payments

### 6.1 Existing indexes

No index found in migrations for **payments(company_id, payment_date)** or **payments(company_id, created_at)** or **payments(reference_type, reference_id)**. (Rental/worker payment indexes exist on other tables.)

### 6.2 Recommended coverage

| Pattern | Status |
|---------|--------|
| company_id + date (payment_date) | **Missing** — add **idx_payments_company_payment_date** |
| company_id + created_at | **Missing** — add **idx_payments_company_created_at** |
| reference_type + reference_id | **Missing** — add **idx_payments_reference** for lookups by sale_id/purchase_id |

**Recommendation (when applying):**

```sql
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_payment_date ON payments(company_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_company_created_at ON payments(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
```

Verify column names (payment_date vs date, etc.) in actual schema before running.

---

## 7. journal_entry_lines

| Index | Definition | Source |
|-------|------------|--------|
| idx_journal_entry_lines_journal_entry_id | journal_entry_lines(journal_entry_id) | report_performance_indexes.sql, journal_entry_lines_performance_indexes.sql |
| idx_journal_entry_lines_account_id | journal_entry_lines(account_id) | report_performance_indexes.sql, journal_entry_lines_performance_indexes.sql |

**Conclusion:** Join columns are indexed. No further change required for this review.

---

## 8. Summary

| Table | company_id + date | company_id + created_at | reference_type + reference_id | Action |
|-------|-------------------|--------------------------|-------------------------------|--------|
| sales | OK | OK | N/A | None |
| purchases | Check (po_date) | OK | N/A | Optional: idx_purchases_company_po_date |
| stock_movements | Check | Optional | Optional | Optional: company_created_at, reference |
| journal_entries | OK | OK | OK | None |
| payments | **Missing** | **Missing** | **Missing** | **Add** idx_payments_company_payment_date, idx_payments_company_created_at, idx_payments_reference (after verifying columns) |

**No schema changes in this phase** — apply index additions in a separate migration after confirming column names and workload.

---

*This document is part of the safe cleanup plan. No schema or data was modified.*
