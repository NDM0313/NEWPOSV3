# TRUNCATE PLAN — Production Data Reset

**Generated:** 2025-02-23  
**Status:** PLAN ONLY — DO NOT EXECUTE without explicit approval

---

## ⚠️ WARNING

This document describes the **order and method** for truncating production data.  
**DO NOT EXECUTE** truncate commands until:

1. All audit reports are approved
2. Backup is verified and recent
3. Stakeholder gives explicit approval

---

## 1. Pre-Truncate Checklist

- [ ] Full backup created: `bash deploy/backup-supabase-db.sh 14`
- [ ] Backup file exists and is non-zero: `ls -lh backups/supabase_db_*.dump`
- [ ] TRUNCATE_PLAN reviewed and approved
- [ ] All users notified (downtime expected)

---

## 2. Tables to TRUNCATE (Order Matters)

**Order:** Child tables first, then parents. Respect foreign keys.

### Phase A — Transaction Line Items
```sql
TRUNCATE TABLE sale_return_items CASCADE;
TRUNCATE TABLE purchase_return_items CASCADE;
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE purchase_items CASCADE;
TRUNCATE TABLE journal_entry_lines CASCADE;
TRUNCATE TABLE rental_items CASCADE;
TRUNCATE TABLE expense_items CASCADE;
```

### Phase B — Transactions & Movements
```sql
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE journal_entries CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE sale_returns CASCADE;
TRUNCATE TABLE purchase_returns CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE purchases CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE rentals CASCADE;
TRUNCATE TABLE studio_orders CASCADE;
```

### Phase C — Master Data (Optional — keep if reusing)
```sql
-- Only if full reset:
TRUNCATE TABLE contacts CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE product_variations CASCADE;
TRUNCATE TABLE product_categories CASCADE;
TRUNCATE TABLE brands CASCADE;
TRUNCATE TABLE accounts CASCADE;
```

### Phase D — Config (KEEP)
```sql
-- DO NOT TRUNCATE:
-- companies
-- branches
-- users
-- user_branches
-- roles
-- settings
-- modules_config
-- numbering_rules
-- document_sequences
-- units
```

---

## 3. Foreign Key Safe Method

Use `TRUNCATE ... CASCADE` to handle dependent rows. Alternatively, truncate in reverse dependency order without CASCADE.

**PostgreSQL CASCADE:** Truncates tables that have foreign key references to the truncated table.

---

## 4. Reset Sequences

If using sequences (e.g. for document_sequences):

```sql
-- document_sequences uses current_number; reset per company if needed
UPDATE document_sequences SET current_number = 0 WHERE company_id = 'YOUR_COMPANY_ID';
```

For numbering_rules next numbers:
```sql
UPDATE numbering_rules 
SET sale_next_number = 1, purchase_next_number = 1, pos_next_number = 1, 
    rental_next_number = 1, expense_next_number = 1, product_next_number = 1,
    studio_next_number = 1, payment_next_number = 1
WHERE company_id = 'YOUR_COMPANY_ID';
```

---

## 5. Preserve Super Admin

- **companies:** Keep your company row
- **branches:** Keep your branch(es)
- **users:** Keep admin user(s)
- **user_branches:** Keep user-branch links
- **auth.users:** Supabase Auth — keep admin; optionally remove demo/test users via Auth UI

---

## 6. Execution Script (Template)

**Run on VPS:**
```bash
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^supabase-db$|^db$' | head -1)

# Backup first
cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 14

# Then run truncate (copy SQL to file and execute)
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
BEGIN;
-- Phase A
TRUNCATE TABLE sale_return_items CASCADE;
TRUNCATE TABLE purchase_return_items CASCADE;
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE purchase_items CASCADE;
TRUNCATE TABLE journal_entry_lines CASCADE;
TRUNCATE TABLE rental_items CASCADE;
TRUNCATE TABLE expense_items CASCADE;
-- Phase B
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE journal_entries CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE sale_returns CASCADE;
TRUNCATE TABLE purchase_returns CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE purchases CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE rentals CASCADE;
TRUNCATE TABLE studio_orders CASCADE;
-- Phase C (optional - uncomment for full reset)
-- TRUNCATE TABLE contacts CASCADE;
-- TRUNCATE TABLE products CASCADE;
-- TRUNCATE TABLE product_variations CASCADE;
-- TRUNCATE TABLE product_categories CASCADE;
-- TRUNCATE TABLE brands CASCADE;
-- TRUNCATE TABLE accounts CASCADE;
COMMIT;
EOSQL
```

---

## 7. Post-Truncate

1. Recreate default accounts if truncated (via create_business_transaction or manual)
2. Recreate default Piece unit if units truncated
3. Verify login and basic flows
4. Reset document_sequences / numbering_rules as needed

---

## 8. Rollback

If truncate was mistaken: restore from backup.

```bash
gunzip -c backups/supabase_full_YYYYMMDD_HHMMSS.sql.gz | docker exec -i supabase-db psql -U postgres -d postgres
# OR for .dump format:
docker exec -i supabase-db pg_restore -U postgres -d postgres -c --if-exists < backups/supabase_db_YYYYMMDD_HHMMSS.dump
```

---

**END OF TRUNCATE PLAN — DO NOT EXECUTE WITHOUT APPROVAL**
