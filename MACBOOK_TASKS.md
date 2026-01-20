# 🍎 MACBOOK TASKS - COMPLETE GUIDE
**Date:** January 20, 2026  
**Environment:** MacBook Development Setup

---

## 📋 OVERVIEW

This document contains all tasks and setup instructions for continuing development on MacBook.

---

## 🔧 SETUP INSTRUCTIONS

### 1. Clone Repository
```bash
cd ~/dev
git clone <repository-url>
cd "NEW POSV3"
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Environment Variables
Check `.env.local` file exists and contains:
```env
VITE_SUPABASE_URL=https://wrwljqzckmnmuphwhslt.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SUPABASE_URL=https://wrwljqzckmnmuphwhslt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 4. Start Development Server
```bash
npm run dev
# or
yarn dev
```

---

## 🎯 IMMEDIATE TASKS (Priority Order)

### TASK 1: Verify Demo Account Login ✅
**Status:** Should work, verify on MacBook

**Steps:**
1. Open app in browser
2. Click "Demo Login (Admin)" button
3. Or manually enter:
   - Email: `demo@dincollection.com`
   - Password: `demo123`
4. Verify login successful
5. Check dashboard loads
6. Verify data visible (2 contacts, 1 product)

**Expected Result:**
- ✅ Login successful
- ✅ Dashboard loads
- ✅ Data visible
- ✅ No console errors

---

### TASK 2: Complete Demo Data Seeding
**Status:** ⚠️ **INCOMPLETE** - Only 2 contacts, 1 product exist

**Current State:**
- Demo company exists
- Only minimal data (2 contacts, 1 product)
- No sales, purchases, expenses, etc.

**Required Action:**
1. Review `supabase-extract/migrations/14_demo_dummy_data.sql`
2. Check if function `seed_demo_data` exists in database
3. Execute demo data seeding:
   ```sql
   -- Get demo company, branch, user IDs
   SELECT id FROM companies WHERE is_demo = true;
   SELECT id FROM branches WHERE company_id = '<demo-company-id>';
   SELECT id FROM users WHERE company_id = '<demo-company-id>' AND role = 'admin';
   
   -- Execute seed function
   SELECT seed_demo_data(
     '<demo-company-id>',
     '<demo-branch-id>',
     '<demo-user-id>'
   );
   ```

**Expected Result:**
- ✅ Multiple products (10-20)
- ✅ Multiple contacts (customers, suppliers)
- ✅ Sample sales (5-10)
- ✅ Sample purchases (5-10)
- ✅ Sample expenses (5-10)
- ✅ Realistic data for testing

**Files to Check:**
- `supabase-extract/migrations/14_demo_dummy_data.sql`
- `supabase-extract/migrations/13_create_demo_company.sql`

---

### TASK 3: Verify All Modules Functional
**Status:** ⚠️ **VERIFICATION NEEDED**

**Modules to Test:**

#### 3.1 Products Module
- [ ] View products list
- [ ] Add new product
- [ ] Edit product
- [ ] Delete product
- [ ] Product variations work
- [ ] Product categories work
- [ ] Barcode handling (non-blocking)

#### 3.2 Contacts Module
- [ ] View contacts list
- [ ] Add new contact (customer/supplier)
- [ ] Edit contact
- [ ] Delete contact
- [ ] View ledger
- [ ] Balance calculation correct

#### 3.3 Sales Module
- [ ] View sales list
- [ ] Create new sale
- [ ] Edit sale
- [ ] Delete sale
- [ ] Convert quotation to invoice
- [ ] Receive payment
- [ ] Stock decrement works

#### 3.4 Purchases Module
- [ ] View purchases list
- [ ] Create new purchase
- [ ] Edit purchase
- [ ] Delete purchase
- [ ] Update status (ordered → received)
- [ ] Stock increment works

#### 3.5 Expenses Module
- [ ] View expenses list
- [ ] Create expense
- [ ] Approve/reject expense
- [ ] Mark as paid
- [ ] Accounting entry created

#### 3.6 Accounting Module
- [ ] View journal entries
- [ ] View accounts
- [ ] View ledger
- [ ] Trial balance
- [ ] P&L report

#### 3.7 Reports Module
- [ ] Dashboard reports
- [ ] Sales reports
- [ ] Purchase reports
- [ ] Inventory reports
- [ ] Export functionality (CSV, Excel, PDF)

#### 3.8 Settings Module
- [ ] Company settings save/load
- [ ] Branch management
- [ ] Module toggles work
- [ ] Settings persist on refresh

---

### TASK 4: Database Schema Verification
**Status:** ⚠️ **VERIFICATION NEEDED**

**Check Missing Tables:**
1. Verify if `rentals` table exists
2. Verify if `rental_items` table exists
3. Verify if `studio_orders` table exists
4. Verify if `studio_order_items` table exists
5. Verify if `workers` table exists
6. Verify if `job_cards` table exists

**If Tables Don't Exist:**
- Review `supabase-extract/migrations/03_frontend_driven_schema.sql`
- Check if these tables are needed
- Either create tables or update frontend to handle gracefully

**SQL to Check:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'rentals', 'rental_items', 
  'studio_orders', 'studio_order_items',
  'workers', 'job_cards'
)
ORDER BY table_name;
```

---

### TASK 5: Core Phase Implementation (If Not Complete)
**Status:** ⚠️ **VERIFICATION NEEDED**

**Check if Core Phase SQL Functions Applied:**

#### 5.1 Chart of Accounts
- [ ] `create_default_accounts` function exists
- [ ] Default accounts created for demo company

#### 5.2 Inventory Movement Engine
- [ ] `stock_movements` table exists
- [ ] `update_product_stock_from_movement` trigger exists
- [ ] Stock updates automatically on movements

#### 5.3 Purchase Transaction with Accounting
- [ ] `create_purchase_with_accounting` function exists
- [ ] Test purchase creation
- [ ] Verify inventory increases
- [ ] Verify accounting entries created

#### 5.4 Sale Transaction with Accounting
- [ ] `create_sale_with_accounting` function exists
- [ ] Test sale creation
- [ ] Verify inventory decreases
- [ ] Verify accounting entries created

#### 5.5 Payment Engine
- [ ] `record_payment_with_accounting` function exists
- [ ] Test payment recording
- [ ] Verify accounting entries created

#### 5.6 Expense Transaction
- [ ] `create_expense_with_accounting` function exists
- [ ] Test expense creation
- [ ] Verify accounting entries created

**Files to Check:**
- `supabase-extract/migrations/04_create_default_accounts.sql`
- `supabase-extract/migrations/05_inventory_movement_engine.sql`
- `supabase-extract/migrations/06_purchase_transaction_with_accounting.sql`
- `supabase-extract/migrations/07_sale_transaction_with_accounting.sql`
- `supabase-extract/migrations/08_payment_engine.sql`
- `supabase-extract/migrations/09_expense_transaction.sql`

**SQL to Check Functions:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'create_default_accounts',
  'create_purchase_with_accounting',
  'create_sale_with_accounting',
  'record_payment_with_accounting',
  'create_expense_with_accounting'
)
ORDER BY routine_name;
```

---

### TASK 6: Frontend Error Handling Review
**Status:** ✅ **PARTIALLY COMPLETE**

**Verify Error Handling:**
- [ ] All services have fallback logic
- [ ] No unhandled promise rejections
- [ ] User-friendly error messages
- [ ] Loading states work correctly
- [ ] Empty states display properly

**Files to Review:**
- All service files in `src/app/services/`
- All context files in `src/app/context/`

---

### TASK 7: Testing & Validation
**Status:** ⚠️ **REQUIRED**

#### 7.1 Data Persistence Test
1. Create new business
2. Add contact
3. Add product
4. Create sale
5. Create purchase
6. Browser hard refresh
7. Re-login
8. **Expected:** All data persists

#### 7.2 Settings Persistence Test
1. Change company settings
2. Change module toggles
3. Browser hard refresh
4. Re-login
5. **Expected:** Settings persist

#### 7.3 Accounting Integration Test
1. Create sale
2. Verify journal entry created
3. Verify inventory decreased
4. Create purchase
5. Verify journal entry created
6. Verify inventory increased
7. **Expected:** All accounting entries correct

#### 7.4 Multi-Company Isolation Test
1. Create second company
2. Add data to second company
3. Login to demo company
4. **Expected:** Only demo company data visible

---

## 🐛 KNOWN ISSUES TO FIX

### Issue 1: Demo Data Incomplete
- **Status:** ⚠️ Only 2 contacts, 1 product
- **Fix:** Execute `seed_demo_data` function
- **Priority:** High

### Issue 2: Missing Tables (Rentals, Studio)
- **Status:** ⚠️ Tables don't exist
- **Fix:** Either create tables or update frontend to handle gracefully
- **Priority:** Medium

### Issue 3: Core Phase Functions May Not Be Applied
- **Status:** ⚠️ Need verification
- **Fix:** Apply migration files 04-09 if not already applied
- **Priority:** High

---

## 📁 IMPORTANT FILES REFERENCE

### Migration Files:
- `supabase-extract/migrations/03_frontend_driven_schema.sql` - Main schema
- `supabase-extract/migrations/04_create_default_accounts.sql` - Chart of accounts
- `supabase-extract/migrations/05_inventory_movement_engine.sql` - Inventory
- `supabase-extract/migrations/06_purchase_transaction_with_accounting.sql` - Purchase
- `supabase-extract/migrations/07_sale_transaction_with_accounting.sql` - Sale
- `supabase-extract/migrations/08_payment_engine.sql` - Payment
- `supabase-extract/migrations/09_expense_transaction.sql` - Expense
- `supabase-extract/migrations/13_create_demo_company.sql` - Demo company
- `supabase-extract/migrations/14_demo_dummy_data.sql` - Demo data

### Documentation:
- `TODAY_WORK_SUMMARY.md` - Today's work summary
- `MACBOOK_TASKS.md` - This file
- `FIELD_MAPPING_VERIFICATION.md` - Field mapping details
- `FRONTEND_DATA_REQUIREMENTS_AUDIT.md` - Frontend requirements

---

## 🔑 DEMO ACCOUNT CREDENTIALS

- **Email:** `demo@dincollection.com`
- **Password:** `demo123`
- **Company:** `Din Collection - Demo`
- **Company ID:** `5aac3c47-af92-44f4-aa7d-4ca5bd4c135b`

---

## 📝 NOTES

1. **Database Connection:** Use Supabase SQL Editor or psql with connection string from `.env.local`
2. **RLS Status:** Currently disabled for testing
3. **Error Handling:** All services have fallback logic for missing tables/columns
4. **Data Migration:** All existing data shifted to demo company

---

## ✅ SUCCESS CRITERIA

- [ ] Demo account login works
- [ ] Demo data is realistic and complete
- [ ] All modules functional
- [ ] All database functions applied
- [ ] No console errors
- [ ] Data persists on refresh
- [ ] Settings persist on refresh
- [ ] Accounting integration works
- [ ] Multi-company isolation works

---

**Last Updated:** January 20, 2026  
**Next Review:** After MacBook setup
