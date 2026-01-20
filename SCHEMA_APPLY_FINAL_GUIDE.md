# 🚀 SCHEMA APPLICATION - FINAL GUIDE

## Date: 2026-01-20

## ✅ COMPLETED

1. **.env.local Updated** ✅
   - New project URL configured
   - All keys updated
   - Both Vite and Next.js formats included

2. **Schema File Ready** ✅
   - File: `supabase-extract/migrations/03_frontend_driven_schema.sql`
   - Complete schema (20 tables, all indexes, triggers, functions)
   - All columns match frontend requirements

## ⚠️ AUTOMATED APPLICATION FAILED

**Reason:** Network/DNS resolution issues preventing direct PostgreSQL connection

**Solution:** Manual application via Supabase SQL Editor (recommended method)

---

## 📋 MANUAL APPLICATION STEPS (5 MINUTES)

### Step 1: Open Supabase Dashboard
1. Go to: **https://supabase.com/dashboard**
2. Login with your account
3. Select project: **wrwljqzckmnmuphwhslt**

### Step 2: Open SQL Editor
1. Click **SQL Editor** in left sidebar
2. Click **New Query** button (top right)

### Step 3: Load Schema File
1. Open file: `supabase-extract/migrations/03_frontend_driven_schema.sql`
2. Select ALL content (Ctrl+A)
3. Copy (Ctrl+C)

### Step 4: Paste and Execute
1. Paste into SQL Editor (Ctrl+V)
2. Click **Run** button (or press Ctrl+Enter)
3. Wait 30-60 seconds for execution

### Step 5: Verify Success
- Should see: **"Success. No rows returned"**
- If errors appear, check error message

---

## 🔍 VERIFICATION (After Applying)

Run this query in SQL Editor to verify:

```sql
-- Count all tables
SELECT 
    COUNT(*) as total_tables,
    COUNT(CASE WHEN table_name IN (
        'companies', 'branches', 'users', 'roles', 'settings', 'modules_config',
        'contacts', 'products', 'product_categories', 'product_variations',
        'sales', 'sale_items', 'purchases', 'purchase_items',
        'expenses', 'payments', 'accounts', 'ledger_entries', 
        'journal_entries', 'journal_entry_lines'
    ) THEN 1 END) as required_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

**Expected Result:**
- `total_tables`: 20 (19 required + 1 for migrations if using migrations)
- `required_tables`: 19

---

## ✅ VERIFY KEY COLUMNS

### Products Table:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('name', 'sku', 'barcode', 'cost_price', 'retail_price', 'is_active')
ORDER BY ordinal_position;
```

### Contacts Table:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND column_name IN ('type', 'name', 'email', 'phone', 'country')
ORDER BY ordinal_position;
```

### Sales Table:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name IN ('invoice_date', 'customer_id', 'type', 'payment_status')
ORDER BY ordinal_position;
```

### Packing Columns (Sale Items):
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'sale_items'
  AND column_name LIKE 'packing%'
ORDER BY ordinal_position;
```

**Expected:** All columns should exist with correct data types.

---

## 📊 WHAT WILL BE CREATED

### ENUM Types (9):
- ✅ `contact_type` (customer, supplier, both, worker)
- ✅ `sale_type` (invoice, quotation)
- ✅ `sale_status` (draft, quotation, order, final)
- ✅ `purchase_status` (draft, ordered, received, final)
- ✅ `payment_status` (paid, partial, unpaid)
- ✅ `payment_type` (received, paid)
- ✅ `payment_method_enum` (cash, bank, card, other)
- ✅ `shipping_status` (pending, delivered, processing, cancelled)
- ✅ `expense_status` (pending, approved, rejected, paid)

### Tables (20):
**CORE (6):**
1. ✅ `companies`
2. ✅ `branches`
3. ✅ `users`
4. ✅ `roles`
5. ✅ `settings`
6. ✅ `modules_config`

**MASTERS (4):**
7. ✅ `contacts`
8. ✅ `products`
9. ✅ `product_categories`
10. ✅ `product_variations`

**TRANSACTIONS (6):**
11. ✅ `sales`
12. ✅ `sale_items` (with packing columns)
13. ✅ `purchases`
14. ✅ `purchase_items` (with packing columns)
15. ✅ `expenses`
16. ✅ `payments`

**ACCOUNTING (4):**
17. ✅ `accounts`
18. ✅ `ledger_entries`
19. ✅ `journal_entries`
20. ✅ `journal_entry_lines`

### Additional:
- ✅ All indexes (for performance)
- ✅ All triggers (auto-update updated_at)
- ✅ `create_business_transaction` function

---

## 🚀 AFTER SCHEMA APPLIED

### 1. Restart Dev Server
```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
# or
vite
```

### 2. Test Connection
1. Open app: http://localhost:5173
2. Try creating a new business
3. Verify it works

### 3. Test Data Persistence
1. Create business
2. Add product
3. Add contact
4. Change settings
5. Hard refresh browser (Ctrl+Shift+R)
6. Login again
7. Verify data persists

---

## 📁 FILES READY

1. ✅ `.env.local` - Updated with new credentials
2. ✅ `supabase-extract/migrations/03_frontend_driven_schema.sql` - Complete schema
3. ✅ `SCHEMA_APPLY_FINAL_GUIDE.md` - This file
4. ✅ `apply-schema-direct.ps1` - Automation script (if psql works)

---

## ⚠️ TROUBLESHOOTING

### If schema application fails:

1. **Check Error Message**
   - Read the error in SQL Editor
   - Common issues: syntax errors, missing extensions

2. **Try in Smaller Chunks**
   - Apply ENUM types first
   - Then core tables
   - Then master tables
   - Then transaction tables
   - Then accounting tables
   - Then indexes and triggers

3. **Verify Extension**
   - Make sure `uuid-ossp` extension is enabled
   - Run: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

---

**Status:** ✅ Environment ready | ⚠️ Schema application pending (manual step - 5 minutes)

**Next Action:** Apply schema via Supabase SQL Editor using steps above
