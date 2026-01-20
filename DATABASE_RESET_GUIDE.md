# 🗄️ DATABASE RESET GUIDE - DEVELOPMENT ENVIRONMENT

**Date**: January 2026  
**Status**: ✅ **READY FOR EXECUTION**  
**Priority**: CRITICAL - Database Foundation Fix

---

## ⚠️ IMPORTANT WARNING

**This is a COMPLETE DATABASE RESET.**

- All existing data will be **DELETED**
- All tables will be **DROPPED and RECREATED**
- Use **ONLY in DEVELOPMENT environment**

**DO NOT run this in PRODUCTION!**

---

## 🎯 OBJECTIVE

Reset the database to a **CLEAN, COMPLETE state** with:
- ✅ All required tables
- ✅ All required columns
- ✅ Proper foreign keys
- ✅ Proper constraints
- ✅ Settings table that PERSISTS data

---

## 📋 EXECUTION STEPS

### **STEP 1: Open Supabase SQL Editor**

1. Go to Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

---

### **STEP 2: Run Database Reset Script**

1. Open file: `supabase-extract/RESET_DATABASE.sql`
2. Copy **ENTIRE contents**
3. Paste in Supabase SQL Editor
4. Click **RUN**

**Expected Result:**
- ✅ All tables dropped
- ✅ All types dropped
- ✅ Verification queries pass

---

### **STEP 3: Run Clean Schema**

1. Open file: `supabase-extract/CLEAN_COMPLETE_SCHEMA.sql`
2. Copy **ENTIRE contents**
3. Paste in Supabase SQL Editor (new query)
4. Click **RUN**

**Expected Result:**
- ✅ All tables created
- ✅ All indexes created
- ✅ All triggers created
- ✅ Success message: "✅ All required tables exist"

---

### **STEP 4: Run RLS Policies (Optional but Recommended)**

1. Open file: `supabase-extract/rls-policies.sql`
2. Copy contents
3. Paste and run in SQL Editor

**Note:** If RLS policies cause issues, you can skip this step for development.

---

### **STEP 5: Run Functions & Triggers (Optional)**

1. Open file: `supabase-extract/functions.sql`
2. Copy contents
3. Paste and run in SQL Editor

**Note:** Functions are optional. System will work without them, but auto-features won't work.

---

### **STEP 6: Verify Database**

Run this verification query:

```sql
-- Check all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'companies', 'branches', 'users', 'contacts', 'products',
  'sales', 'sale_items', 'purchases', 'purchase_items',
  'expenses', 'accounts', 'journal_entries', 'payments',
  'settings', 'modules_config', 'document_sequences'
)
ORDER BY table_name;
```

**Expected:** All 17+ tables should be listed.

---

## ✅ VERIFICATION CHECKLIST

After reset, verify:

- [ ] ✅ All tables exist (run verification query above)
- [ ] ✅ `sale_items` has `packing_type`, `packing_quantity`, `packing_unit`, `packing_details` columns
- [ ] ✅ `purchase_items` has `packing_type`, `packing_quantity`, `packing_unit`, `packing_details` columns
- [ ] ✅ `settings` table has `company_id`, `key`, `value` (JSONB), `category` columns
- [ ] ✅ `modules_config` table has `company_id`, `module_name`, `is_enabled`, `config` columns
- [ ] ✅ All foreign keys are properly set up
- [ ] ✅ All indexes are created

---

## 🔧 TROUBLESHOOTING

### **Error: "relation already exists"**
**Solution:** Run `RESET_DATABASE.sql` first to drop all tables.

### **Error: "type already exists"**
**Solution:** The reset script drops all types. If error persists, manually drop:
```sql
DROP TYPE IF EXISTS expense_category CASCADE;
-- (repeat for all types)
```

### **Error: "foreign key constraint"**
**Solution:** Make sure you run tables in correct order. The CLEAN_COMPLETE_SCHEMA.sql handles this.

### **Error: "permission denied"**
**Solution:** Check RLS policies. For development, you can temporarily disable RLS:
```sql
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE modules_config DISABLE ROW LEVEL SECURITY;
```

---

## 📊 SCHEMA SUMMARY

### **Core Tables (19):**
1. ✅ `companies` - Company information
2. ✅ `branches` - Branch locations
3. ✅ `users` - User accounts
4. ✅ `user_branches` - User-branch assignments
5. ✅ `permissions` - User permissions
6. ✅ `contacts` - Customers/Suppliers/Workers
7. ✅ `product_categories` - Product categories
8. ✅ `products` - Products
9. ✅ `product_variations` - Product variations
10. ✅ `stock_movements` - Stock ledger
11. ✅ `sales` - Sales/Invoices
12. ✅ `sale_items` - Sale line items (WITH PACKING)
13. ✅ `purchases` - Purchase orders
14. ✅ `purchase_items` - Purchase line items (WITH PACKING)
15. ✅ `rentals` - Rental bookings
16. ✅ `rental_items` - Rental items
17. ✅ `studio_orders` - Studio production orders
18. ✅ `studio_order_items` - Studio order items
19. ✅ `workers` - Workers/Staff
20. ✅ `job_cards` - Production job cards
21. ✅ `expenses` - Expenses
22. ✅ `accounts` - Chart of accounts
23. ✅ `journal_entries` - Journal entries
24. ✅ `journal_entry_lines` - Journal entry lines
25. ✅ `payments` - Payments/Receipts
26. ✅ `settings` - **Settings (CRITICAL - MUST PERSIST)**
27. ✅ `modules_config` - Module toggles
28. ✅ `document_sequences` - Auto-numbering
29. ✅ `audit_logs` - Audit trail

---

## 🎯 SUCCESS CRITERIA

After reset, the following MUST work:

1. ✅ **Data Saves** - Creating products/sales/purchases saves to database
2. ✅ **Data Persists** - Page refresh doesn't reset data
3. ✅ **Settings Persist** - Settings save and reload correctly
4. ✅ **No Missing Columns** - No "column does not exist" errors
5. ✅ **No Missing Tables** - No "relation does not exist" errors

---

## 🚀 NEXT STEPS AFTER RESET

1. **Test Settings Persistence:**
   - Open Settings page
   - Change a setting
   - Save
   - Refresh page
   - Verify setting is still changed

2. **Test Data Persistence:**
   - Create a product
   - Refresh page
   - Verify product still exists

3. **Test Packing:**
   - Create a sale with packing data
   - Verify packing columns are populated

4. **Verify No Errors:**
   - Check browser console
   - No 400/406 errors
   - No missing column/table errors

---

## 📝 NOTES

- **Development Only:** This reset is for development environment
- **Backup First:** If you have important data, export it first
- **RLS Policies:** May need adjustment after reset
- **Functions:** Optional but recommended for auto-features

---

**Status**: ✅ **READY FOR EXECUTION**

**Next**: Run `RESET_DATABASE.sql` then `CLEAN_COMPLETE_SCHEMA.sql` in Supabase SQL Editor
