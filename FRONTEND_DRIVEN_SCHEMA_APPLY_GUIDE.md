# ✅ FRONTEND-DRIVEN SCHEMA - APPLY GUIDE

## Date: 2026-01-20

## 🎯 STATUS

### ✅ COMPLETED:
1. **TASK 1:** Frontend Data Requirements Extraction - ✅ COMPLETE
   - All forms audited
   - All fields documented
   - See: `FRONTEND_DATA_REQUIREMENTS_AUDIT.md`

2. **TASK 2:** Frontend-Driven Database Schema Design - ✅ COMPLETE
   - Complete schema designed based on frontend requirements
   - All 19 tables defined
   - All columns match frontend form fields
   - See: `supabase-extract/migrations/03_frontend_driven_schema.sql`

### ⚠️ PENDING:
3. **TASK 3:** Actual Database Apply - ⚠️ MANUAL STEP REQUIRED
   - Connection timeout via MCP
   - **SOLUTION:** Apply via Supabase SQL Editor

---

## 📋 MANUAL APPLICATION STEPS

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project: `wrwljqzckmnmuphwhslt`
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

### Step 2: Copy SQL Schema
1. Open file: `supabase-extract/migrations/03_frontend_driven_schema.sql`
2. Copy **ENTIRE** file content
3. Paste into Supabase SQL Editor

### Step 3: Execute
1. Click **Run** button (or press `Ctrl+Enter`)
2. Wait for execution (may take 30-60 seconds)
3. Check for success message: `Success. No rows returned`

### Step 4: Verify
Run this verification query in SQL Editor:

```sql
-- Verify all tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'companies', 'branches', 'users', 'roles', 'settings', 'modules_config',
            'contacts', 'products', 'product_categories', 'product_variations',
            'sales', 'sale_items', 'purchases', 'purchase_items',
            'expenses', 'payments', 'accounts', 'ledger_entries', 
            'journal_entries', 'journal_entry_lines'
        ) THEN '✅ REQUIRED'
        ELSE '⚠️ EXTRA'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN table_name IN (
            'companies', 'branches', 'users', 'roles', 'settings', 'modules_config',
            'contacts', 'products', 'product_categories', 'product_variations',
            'sales', 'sale_items', 'purchases', 'purchase_items',
            'expenses', 'payments', 'accounts', 'ledger_entries', 
            'journal_entries', 'journal_entry_lines'
        ) THEN 0
        ELSE 1
    END,
    table_name;
```

**Expected Result:** 20 tables (19 required + 1 for migrations history if using migrations)

---

## 🔍 VERIFICATION QUERIES

### Verify Key Columns Exist:

```sql
-- Products table - verify frontend fields
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN (
    'name', 'sku', 'barcode', 'category_id',
    'cost_price', 'retail_price', 'wholesale_price', 'rental_price_daily',
    'current_stock', 'min_stock', 'max_stock',
    'has_variations', 'is_rentable', 'is_sellable', 'track_stock', 'is_active'
  )
ORDER BY ordinal_position;
```

```sql
-- Contacts table - verify frontend fields
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND column_name IN (
    'type', 'name', 'email', 'phone', 'mobile',
    'address', 'city', 'country',
    'opening_balance', 'credit_limit', 'payment_terms', 'tax_number'
  )
ORDER BY ordinal_position;
```

```sql
-- Sales table - verify frontend fields
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name IN (
    'invoice_date', 'customer_id', 'customer_name',
    'type', 'status', 'payment_status',
    'subtotal', 'discount_amount', 'expenses', 'total',
    'paid_amount', 'due_amount'
  )
ORDER BY ordinal_position;
```

```sql
-- Sale Items - verify packing columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sale_items'
  AND column_name LIKE 'packing%'
ORDER BY ordinal_position;
```

**Expected:** All columns should exist with correct data types.

---

## 📊 SCHEMA SUMMARY

### Tables Created (20 total):

**CORE (6 tables):**
1. ✅ `companies` - Business info (from CreateBusinessForm)
2. ✅ `branches` - Branch locations
3. ✅ `users` - User accounts (from CreateBusinessForm - ownerName)
4. ✅ `roles` - User roles
5. ✅ `settings` - JSONB-based settings (from SettingsPageNew)
6. ✅ `modules_config` - Module toggles (from SettingsPageNew)

**MASTERS (4 tables):**
7. ✅ `contacts` - Customers/Suppliers/Workers (from GlobalDrawer ContactForm)
8. ✅ `products` - Product master (from EnhancedProductForm)
9. ✅ `product_categories` - Categories (from EnhancedProductForm - category/subCategory)
10. ✅ `product_variations` - Variations (from EnhancedProductForm - generatedVariations)

**TRANSACTIONS (6 tables):**
11. ✅ `sales` - Sales/Invoices (from SaleForm)
12. ✅ `sale_items` - Sale line items with packing (from SaleForm - items)
13. ✅ `purchases` - Purchase orders (from PurchaseForm)
14. ✅ `purchase_items` - Purchase line items with packing (from PurchaseForm - items)
15. ✅ `expenses` - Expenses (from ExpenseContext)
16. ✅ `payments` - Payments (from SaleForm/PurchaseForm - partialPayments)

**ACCOUNTING (4 tables):**
17. ✅ `accounts` - Chart of accounts
18. ✅ `ledger_entries` - Accounting ledger
19. ✅ `journal_entries` - Journal entries
20. ✅ `journal_entry_lines` - Journal entry lines

---

## ✅ SUCCESS CRITERIA

After applying schema:

1. ✅ **All 20 tables exist** in database
2. ✅ **All columns match frontend requirements** (verified via queries above)
3. ✅ **All ENUM types created** (contact_type, sale_type, payment_status, etc.)
4. ✅ **All indexes created** (for performance)
5. ✅ **All triggers active** (auto-update updated_at)
6. ✅ **create_business_transaction function exists**

---

## 🚀 NEXT STEPS (After Schema Applied)

### TASK 4: Apply = Verify
Run verification queries above to confirm tables/columns exist.

### TASK 5: Hard Functional Test
1. Create New Business via UI
2. Add Product via UI
3. Add Contact via UI
4. Create Sale via UI
5. Change Settings via UI
6. Hard refresh browser
7. Login again
8. Verify data persists

---

## 📁 FILES CREATED

1. ✅ `FRONTEND_DATA_REQUIREMENTS_AUDIT.md` - Complete frontend audit
2. ✅ `supabase-extract/migrations/03_frontend_driven_schema.sql` - Complete schema SQL
3. ✅ `FRONTEND_DRIVEN_SCHEMA_APPLY_GUIDE.md` - This file

---

## ⚠️ IMPORTANT NOTES

1. **Schema is frontend-driven:** Every column exists because frontend form sends it
2. **No imaginary columns:** All columns are required by frontend
3. **Packing columns included:** `sale_items` and `purchase_items` have packing fields
4. **Settings as JSONB:** Settings stored as JSONB for flexibility
5. **Variations as JSONB:** Product variations store attributes as JSONB

---

**Status:** Schema designed and ready for application  
**Next Action:** Apply via Supabase SQL Editor (manual step due to connection timeout)
