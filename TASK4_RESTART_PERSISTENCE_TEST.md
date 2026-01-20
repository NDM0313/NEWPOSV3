# TASK 4: Restart & Persistence Test - VERIFICATION GUIDE ✅

## Date: 2026-01-20

## Summary
This document provides a step-by-step test guide to verify that:
1. Create New Business persists data to database
2. Data persists after app restart/reload
3. System does NOT reset to demo state

## Pre-Test Verification

### ✅ Database Setup Verified

**Transaction Function:**
```sql
-- Verify function exists
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_name = 'create_business_transaction';
-- Expected: Function exists with SECURITY DEFINER
```

**is_demo Flag:**
```sql
-- Verify column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'companies' AND column_name = 'is_demo';
-- Expected: is_demo BOOLEAN DEFAULT false
```

**No Demo Data:**
```sql
-- Verify no demo companies exist
SELECT COUNT(*) as demo_companies
FROM companies
WHERE is_demo = true;
-- Expected: 0
```

## Test Procedure

### TEST 1: Create New Business

**Steps:**
1. Open application in browser
2. Click "Create New Business"
3. Fill form:
   - Business Name: "Test Business Persistence"
   - Owner Name: "Test Owner"
   - Email: "test@persistence.com"
   - Password: "test123456"
4. Click "Create Business"
5. Wait for success message
6. Should auto-login and redirect to dashboard

**Expected Results:**
- ✅ Success message appears
- ✅ Auto-login works
- ✅ Dashboard loads
- ✅ No errors in console

**Database Verification:**
```sql
-- Check company was created
SELECT id, name, email, is_active, is_demo, created_at
FROM companies
WHERE email = 'test@persistence.com';
-- Expected: 1 row, is_demo = false

-- Check branch was created
SELECT b.id, b.name, b.code, b.company_id, c.name as company_name
FROM branches b
JOIN companies c ON b.company_id = c.id
WHERE c.email = 'test@persistence.com';
-- Expected: 1 row (Main Branch)

-- Check user entry was created
SELECT u.id, u.email, u.full_name, u.role, u.company_id, c.name as company_name
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE u.email = 'test@persistence.com';
-- Expected: 1 row, role = 'admin'
```

### TEST 2: Add Some Data

**Steps:**
1. While logged in as test business owner
2. Navigate to Products page
3. Create a new product:
   - Name: "Test Product"
   - SKU: "TEST-001"
   - Price: 1000
   - Stock: 10
4. Save product
5. Navigate to Contacts page
6. Create a new contact:
   - Name: "Test Customer"
   - Type: Customer
   - Email: "customer@test.com"
7. Save contact

**Expected Results:**
- ✅ Product saved successfully
- ✅ Contact saved successfully
- ✅ Data appears in lists

**Database Verification:**
```sql
-- Check product was created
SELECT id, name, sku, company_id, created_at
FROM products
WHERE sku = 'TEST-001';
-- Expected: 1 row, company_id matches test business

-- Check contact was created
SELECT id, name, type, email, company_id, created_at
FROM contacts
WHERE email = 'customer@test.com';
-- Expected: 1 row, company_id matches test business
```

### TEST 3: App Restart / Reload

**Steps:**
1. While logged in with test business
2. **Hard refresh browser:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. OR close browser completely and reopen
4. OR restart dev server (`npm run dev`)
5. Login again with:
   - Email: `test@persistence.com`
   - Password: `test123456`

**Expected Results:**
- ✅ Login successful
- ✅ Dashboard loads
- ✅ **Business data still exists:**
  - Company name visible
  - Product "Test Product" still in list
  - Contact "Test Customer" still in list
- ✅ **System does NOT reset to demo state**
- ✅ No demo data appears

**Database Verification (After Restart):**
```sql
-- Verify business still exists
SELECT id, name, email, is_active, is_demo, created_at
FROM companies
WHERE email = 'test@persistence.com';
-- Expected: Still exists, is_demo = false

-- Verify product still exists
SELECT id, name, sku, company_id
FROM products
WHERE sku = 'TEST-001';
-- Expected: Still exists

-- Verify contact still exists
SELECT id, name, email, company_id
FROM contacts
WHERE email = 'customer@test.com';
-- Expected: Still exists

-- Verify NO demo data was created
SELECT COUNT(*) as demo_companies
FROM companies
WHERE is_demo = true;
-- Expected: 0 (no demo data)
```

### TEST 4: Multiple Restarts

**Steps:**
1. Repeat TEST 3 multiple times (3-5 restarts)
2. Each time, verify data persists

**Expected Results:**
- ✅ Data persists across ALL restarts
- ✅ No data loss
- ✅ No demo data appears
- ✅ System state remains stable

## Success Criteria

### ✅ All Tests Must Pass

1. **Create Business:**
   - ✅ Business created in database
   - ✅ Auto-login works
   - ✅ No errors

2. **Add Data:**
   - ✅ Product created
   - ✅ Contact created
   - ✅ Data visible in UI

3. **Restart:**
   - ✅ Data persists after restart
   - ✅ Business still exists
   - ✅ Products still exist
   - ✅ Contacts still exist
   - ✅ **NO demo data appears**

4. **Multiple Restarts:**
   - ✅ Data persists across multiple restarts
   - ✅ No data loss
   - ✅ System stable

## Failure Scenarios

### ❌ If Test Fails

**Scenario 1: Business Not Created**
- **Check:** Database transaction function exists
- **Check:** Service role key configured
- **Check:** Console errors

**Scenario 2: Data Not Persisting**
- **Check:** Database connection
- **Check:** RLS policies
- **Check:** Transaction function working

**Scenario 3: Demo Data Appears**
- **Check:** No auto-seed logic running
- **Check:** `is_demo` flag working
- **Check:** Hardcoded IDs removed

## Final Verification Query

Run this after completing all tests:

```sql
-- Complete verification
SELECT 
  'Companies' as entity_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_demo = true) as demo_count,
  COUNT(*) FILTER (WHERE is_demo = false OR is_demo IS NULL) as real_count
FROM companies
UNION ALL
SELECT 
  'Products',
  COUNT(*),
  0,
  COUNT(*)
FROM products
UNION ALL
SELECT 
  'Contacts',
  COUNT(*),
  0,
  COUNT(*)
FROM contacts;
```

**Expected:**
- Real companies: 1+ (your test business)
- Demo companies: 0
- Products: 1+ (your test product)
- Contacts: 1+ (your test contact)

## Deliverable

### ✅ Final Confirmation

**After completing all tests, confirm:**

1. ✅ **Create New Business works**
2. ✅ **Data saves to database**
3. ✅ **Data persists after restart**
4. ✅ **System does NOT reset to demo state**
5. ✅ **No demo data appears**

**If all tests pass:**
- ✅ **TASK 4 COMPLETE**
- ✅ **All 4 tasks complete**
- ✅ **System ready for production use**

---

**Status:** ✅ VERIFICATION GUIDE COMPLETE
**Date:** 2026-01-20
**Next Action:** User must perform browser tests to verify
