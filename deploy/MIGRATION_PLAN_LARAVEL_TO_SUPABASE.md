# Migration Plan: Laravel ERP (MySQL) → Supabase Postgres ERP

**Do NOT import into production yet.** Staging only.

---

## 1. Discovery Checklist

### 1.1 MySQL Tables to Inventory

Run on Laravel MySQL:

```sql
-- List all tables
SHOW TABLES;

-- Row counts per table
SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY table_rows DESC;
```

### 1.2 Key Entities (Expected Laravel Tables)

| Entity | Likely MySQL Table(s) | Target Postgres |
|--------|-----------------------|-----------------|
| Customers | customers, contacts, clients | contacts (type=customer) |
| Suppliers | suppliers, vendors, contacts | contacts (type=supplier) |
| Workers | workers, employees, contacts | contacts (type=worker) |
| Products | products, items | products | products |
| Categories | product_categories, categories | product_categories |
| Purchases | purchases, purchase_orders, po | purchases + purchase_items |
| Sales | sales, invoices, orders | sales + sale_items |
| Rentals | rentals, bookings | rentals |
| Expenses | expenses | expenses |
| Payments | payments, transactions | payments |
| Ledgers | ledger_entries, journal_entries | journal_entries, ledger_entries |
| Accounts | accounts, chart_of_accounts | accounts |
| Companies | companies, tenants | companies |
| Branches | branches, locations | branches |
| Users | users | users (links to auth.users) |

### 1.3 Discovery Script (MySQL)

```bash
# Save as discover_mysql.sh
mysql -u USER -p DATABASE -e "
SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY table_rows DESC;
"
```

---

## 2. Export Strategy from MySQL

### 2.1 CSV Export (per table, recommended for staging)

```bash
# Create export dir
mkdir -p /tmp/mysql_export
cd /tmp/mysql_export

# Export each table
mysql -u USER -p DATABASE -e "
SELECT * FROM customers INTO OUTFILE '/tmp/mysql_export/customers.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\n';
"
# Note: INTO OUTFILE requires FILE privilege. Alternative: use mysql client with -e and redirect.

# Alternative: use mysql client with CSV output
mysql -u USER -p DATABASE -B -e "SELECT * FROM customers" | sed 's/\t/","/g;s/^/"/;s/$/"/;s/\n//g' > customers.csv
```

### 2.2 mysqldump (full schema + data)

```bash
# Schema only
mysqldump -u USER -p --no-data DATABASE > schema_only.sql

# Data only (for selective restore)
mysqldump -u USER -p --no-create-info DATABASE customers suppliers products > masters_data.sql

# Full dump (backup, not for direct Postgres import)
mysqldump -u USER -p DATABASE > full_backup.sql
```

### 2.3 Recommended: per-table CSV with headers

```bash
#!/bin/bash
# export_mysql.sh
DB_USER=root
DB_NAME=laravel_erp
OUT_DIR=/tmp/mysql_export
mkdir -p $OUT_DIR

for table in customers suppliers products purchases sales expenses payments; do
  mysql -u $DB_USER -p $DB_NAME -e "
    SELECT * FROM $table
  " | sed 's/\t/","/g;s/^/"/;s/$/"/' > $OUT_DIR/${table}.csv
  echo "Exported $table: $(wc -l < $OUT_DIR/${table}.csv) rows"
done
```

---

## 3. Mapping Doc Template

### 3.1 Column Mapping

| Old (MySQL) | New (Postgres) | Notes |
|-------------|----------------|-------|
| customers.id | contacts.id | Generate UUID |
| customers.name | contacts.name | |
| customers.email | contacts.email | |
| customers.phone | contacts.phone | |
| customers.balance | contacts.current_balance | |
| — | contacts.type | Always 'customer' |
| — | contacts.company_id | From target company |
| suppliers.id | contacts.id | Generate UUID |
| — | contacts.type | Always 'supplier' |
| products.id | products.id | Generate UUID |
| products.price | products.retail_price | |
| products.cost | products.cost_price | |
| purchases.id | purchases.id | Generate UUID |
| purchases.vendor_id | purchases.supplier_id | Map old ID → new UUID |
| purchases.total_amount | purchases.total | |
| purchases.status | purchases.status | See enum mapping |
| sales.id | sales.id | Generate UUID |
| sales.customer_id | sales.customer_id | Map old ID → new UUID |
| sales.invoice_no | sales.invoice_no | |
| sales.total | sales.total | |
| expenses.id | expenses.id | Generate UUID |
| expenses.amount | expenses.amount | |
| expenses.status | expenses.status | See enum mapping |
| payments.id | payments.id | Generate UUID |
| payments.amount | payments.amount | |

### 3.2 Enum / Status Mapping

| Old (MySQL) | New (Postgres) |
|-------------|----------------|
| purchase status: pending, approved, received | draft, ordered, received, final |
| sale status: pending, completed, cancelled | draft, quotation, completed, cancelled |
| payment status: paid, unpaid, partial | paid, unpaid, partial |
| expense status: pending, approved, rejected | pending, approved, rejected, paid |
| contact type: customer, supplier | customer, supplier, both, worker |

### 3.3 Template File

Create `deploy/migration_mapping.csv`:

```csv
old_table,old_column,new_table,new_column,transform,notes
customers,id,contacts,id,uuid_generate_v4(),
customers,name,contacts,name,,
customers,email,contacts,email,,
customers,phone,contacts,phone,,
customers,,contacts,type,literal:customer,
customers,,contacts,company_id,param:company_id,
suppliers,id,contacts,id,uuid_generate_v4(),
...
```

---

## 4. Staging Import Approach

### 4.1 Schema

```sql
-- Create staging schema (no RLS, no triggers)
CREATE SCHEMA IF NOT EXISTS staging;

-- Staging tables mirror target structure but with old_id columns for mapping
CREATE TABLE staging.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  old_id INT,
  company_id UUID,
  type VARCHAR(20),
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  ...
);
```

### 4.2 Import Order (FK dependencies)

1. companies
2. branches
3. users (link to auth.users)
4. contacts (customers + suppliers + workers)
5. product_categories
6. products
7. product_variations
8. accounts
9. purchases
10. purchase_items
11. sales
12. sale_items
13. rentals
14. expenses
15. payments
16. journal_entries / ledger_entries

### 4.3 Validate Totals

```sql
-- Staging vs source counts
SELECT 'contacts' AS tbl, count(*) FROM staging.contacts
UNION ALL SELECT 'products', count(*) FROM staging.products
UNION ALL SELECT 'purchases', count(*) FROM staging.purchases
UNION ALL SELECT 'sales', count(*) FROM staging.sales
UNION ALL SELECT 'expenses', count(*) FROM staging.expenses
UNION ALL SELECT 'payments', count(*) FROM staging.payments;

-- Sum checks
SELECT sum(total) FROM staging.purchases;
SELECT sum(total) FROM staging.sales;
SELECT sum(amount) FROM staging.payments;
```

### 4.4 Promote to Production

```sql
-- Only after validation
INSERT INTO public.contacts SELECT * FROM staging.contacts WHERE validated = true;
-- Repeat for each table
```

---

## 5. Risk Controls

### 5.1 UUID Generation

- **Strategy:** Generate new UUIDs for all rows. Do not preserve MySQL auto-increment IDs.
- **ID mapping:** Use `staging.old_id_to_uuid` mapping table for FK resolution during import.

```sql
CREATE TABLE staging.id_mapping (
  old_table VARCHAR(50),
  old_id BIGINT,
  new_uuid UUID PRIMARY KEY
);
```

### 5.2 Foreign Key Ordering

- Import parents before children.
- Resolve `supplier_id`, `customer_id`, `product_id` via mapping table.

### 5.3 Dedupe Rules

- **Contacts:** Dedupe by (name, phone) or (email) within company.
- **Products:** Dedupe by (sku, company_id) or (name, company_id).
- **Document numbers:** Preserve or regenerate? Recommend: regenerate with new sequences to avoid conflicts.

### 5.4 company_id / branch_id

- **Required:** Every row needs company_id (and branch_id where applicable).
- **Source:** Single company migration → one company_id. Multi-tenant → map old tenant_id to new company_id.

---

## 6. Minimum Viable Migration (Phase 1)

### 6.1 Scope

- **Include:** customers, suppliers, products, product_categories, opening_balances
- **Exclude (for later):** purchases, sales, rentals, expenses, payments, full transactional history

### 6.2 MySQL Export (Phase 1)

```bash
# Tables to export
mysql -u USER -p DATABASE -e "
SELECT * FROM customers;
SELECT * FROM suppliers;
SELECT * FROM products;
SELECT * FROM categories;
" > phase1_export.sql
# Or CSV per table
```

### 6.3 Postgres Import Placeholders

```sql
-- 1. Ensure company exists
INSERT INTO companies (id, name, ...) VALUES ('uuid', 'Migrated Company', ...);

-- 2. Ensure branch exists
INSERT INTO branches (id, company_id, name, ...) VALUES ('uuid', 'company_uuid', 'Main', ...);

-- 3. Contacts (customers + suppliers)
INSERT INTO contacts (id, company_id, type, name, email, phone, opening_balance, ...)
SELECT uuid_generate_v4(), 'company_uuid', 'customer', name, email, phone, balance, ...
FROM staging.contacts_customers;

-- 4. Repeat for suppliers
-- 5. Product categories
-- 6. Products
-- 7. Opening balances (ledger entries or contact.current_balance)
```

### 6.4 Phase 2 (Optional Later)

- Purchases + purchase_items
- Sales + sale_items
- Rentals
- Expenses
- Payments
- Journal entries

---

## 7. Commands Summary

### MySQL Export

```bash
# CSV per table
for t in customers suppliers products purchases sales expenses payments; do
  mysql -u USER -p DATABASE -B -e "SELECT * FROM $t" 2>/dev/null | \
  awk -F'\t' 'BEGIN{OFS=","}{for(i=1;i<=NF;i++) gsub(/"/,"\"\"",$i); print "\""$0"\""}' > $t.csv
done

# Row counts
mysql -u USER -p DATABASE -e "
SELECT table_name, table_rows FROM information_schema.tables
WHERE table_schema=DATABASE() AND table_rows>0;"
```

### Postgres Import (Placeholder)

```bash
# Load CSV into staging
psql $DATABASE_URL -c "\copy staging.contacts FROM 'contacts.csv' CSV HEADER"

# Or use COPY with mapping
psql $DATABASE_URL -f deploy/import_staging.sql
```

### Validation

```sql
SELECT 'contacts' AS tbl, count(*) FROM staging.contacts
UNION ALL SELECT 'products', count(*) FROM staging.products;
-- Compare with MySQL row counts
```

---

## 8. Files to Create

| File | Purpose |
|------|---------|
| `deploy/migration_mapping.csv` | Column mapping template |
| `deploy/import_staging.sql` | Staging table creates + COPY placeholders |
| `deploy/export_mysql.sh` | MySQL export script |
| `deploy/validate_totals.sql` | Staging vs source totals |
