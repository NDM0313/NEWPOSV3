# HARD VERIFICATION TEST - STEP 5

## Date: 2026-01-20

## Purpose
Verify that system state persists after restart and data saves properly to database.

---

## PRE-TEST VERIFICATION

### Database State Check:
```sql
-- Verify tables exist
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
-- Expected: 18

-- Verify transaction function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'create_business_transaction';
-- Expected: 1 row

-- Verify no demo data
SELECT COUNT(*) as demo_count
FROM companies
WHERE is_demo = true;
-- Expected: 0
```

---

## TEST 1: CREATE NEW BUSINESS

### Steps:
1. Open application: `http://localhost:5173`
2. Click **"Create New Business"** button
3. Fill form:
   - **Business Name:** "Test Business Persistence"
   - **Owner Name:** "Test Owner"
   - **Email:** "test@persistence.com"
   - **Password:** "test123456"
4. Click **"Create Business"**
5. Wait for success message
6. Should auto-login and show dashboard

### Expected Results:
- ✅ Success message appears
- ✅ Auto-login works
- ✅ Dashboard loads
- ✅ No console errors

### Database Verification (After Test 1):
```sql
-- Check company was created
SELECT id, name, email, is_active, is_demo, created_at
FROM companies
WHERE email = 'test@persistence.com';
-- Expected: 1 row, is_demo = false

-- Check branch was created
SELECT b.id, b.name, b.code, c.name as company_name
FROM branches b
JOIN companies c ON b.company_id = c.id
WHERE c.email = 'test@persistence.com';
-- Expected: 1 row (Main Branch)

-- Check user entry was created
SELECT u.id, u.email, u.full_name, u.role, c.name as company_name
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE u.email = 'test@persistence.com';
-- Expected: 1 row, role = 'admin'
```

**If all queries return expected results:** ✅ TEST 1 PASSED

---

## TEST 2: ADD CONTACT

### Steps:
1. While logged in as test business owner
2. Navigate to **Contacts** page
3. Click **"Add Contact"** or **"New Contact"**
4. Fill form:
   - **Name:** "Test Customer"
   - **Type:** Customer
   - **Email:** "customer@test.com"
   - **Phone:** "1234567890"
5. Click **"Save"**

### Expected Results:
- ✅ Contact saved successfully
- ✅ Contact appears in list
- ✅ No console errors

### Database Verification (After Test 2):
```sql
-- Check contact was created
SELECT id, name, type, email, company_id, created_at
FROM contacts
WHERE email = 'customer@test.com';
-- Expected: 1 row, company_id matches test business
```

**If query returns expected result:** ✅ TEST 2 PASSED

---

## TEST 3: CHANGE SETTINGS

### Steps:
1. Navigate to **Settings** page
2. Change any setting (e.g., company name, currency)
3. Click **"Save"** or **"Update"**
4. Wait for success message

### Expected Results:
- ✅ Settings saved successfully
- ✅ Success message appears
- ✅ No console errors

### Database Verification (After Test 3):
```sql
-- Check settings were saved
SELECT id, key, value, company_id, updated_at
FROM settings
WHERE company_id = (
  SELECT id FROM companies WHERE email = 'test@persistence.com'
);
-- Expected: At least 1 row with updated_at = recent timestamp
```

**If query returns expected result:** ✅ TEST 3 PASSED

---

## TEST 4: BROWSER HARD REFRESH

### Steps:
1. While logged in with test business
2. **Hard refresh browser:**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
   - OR close browser completely and reopen
3. Login again with:
   - **Email:** `test@persistence.com`
   - **Password:** `test123456`

### Expected Results:
- ✅ Login successful
- ✅ Dashboard loads
- ✅ **Business data still exists:**
  - Company name visible
  - Contact "Test Customer" still in list
  - Settings still saved
- ✅ **System does NOT reset to demo state**
- ✅ No demo data appears

### Database Verification (After Test 4):
```sql
-- Verify business still exists
SELECT id, name, email, is_active, is_demo
FROM companies
WHERE email = 'test@persistence.com';
-- Expected: Still exists, is_demo = false

-- Verify contact still exists
SELECT id, name, email
FROM contacts
WHERE email = 'customer@test.com';
-- Expected: Still exists

-- Verify settings still exist
SELECT COUNT(*) as settings_count
FROM settings
WHERE company_id = (
  SELECT id FROM companies WHERE email = 'test@persistence.com'
);
-- Expected: > 0

-- Verify NO demo data was created
SELECT COUNT(*) as demo_count
FROM companies
WHERE is_demo = true;
-- Expected: 0
```

**If all queries return expected results:** ✅ TEST 4 PASSED

---

## TEST 5: MULTIPLE RESTARTS

### Steps:
1. Repeat TEST 4 multiple times (3-5 restarts)
2. Each time, verify:
   - Business data exists
   - Contact exists
   - Settings exist
   - No demo data

### Expected Results:
- ✅ Data persists across ALL restarts
- ✅ No data loss
- ✅ No demo data appears
- ✅ System state remains stable

**If data persists across all restarts:** ✅ TEST 5 PASSED

---

## FINAL VERIFICATION QUERY

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
  'Contacts',
  COUNT(*),
  0,
  COUNT(*)
FROM contacts
UNION ALL
SELECT 
  'Settings',
  COUNT(*),
  0,
  COUNT(*)
FROM settings;
```

**Expected:**
- Real companies: 1+ (your test business)
- Demo companies: 0
- Contacts: 1+ (your test contact)
- Settings: 1+ (your test settings)

---

## SUCCESS CRITERIA

### ✅ All Tests Must Pass:

1. **TEST 1:** Create Business
   - ✅ Business created in database
   - ✅ Auto-login works
   - ✅ No errors

2. **TEST 2:** Add Contact
   - ✅ Contact created
   - ✅ Data visible in UI

3. **TEST 3:** Change Settings
   - ✅ Settings saved
   - ✅ Data persists

4. **TEST 4:** Browser Hard Refresh
   - ✅ Data persists after restart
   - ✅ Business still exists
   - ✅ Contact still exists
   - ✅ Settings still exist
   - ✅ **NO demo data appears**

5. **TEST 5:** Multiple Restarts
   - ✅ Data persists across multiple restarts
   - ✅ No data loss
   - ✅ System stable

---

## FAILURE SCENARIOS

### ❌ If Test Fails:

**Scenario 1: Business Not Created**
- Check: Database transaction function exists
- Check: Service role key configured
- Check: Console errors
- Check: Network tab for API errors

**Scenario 2: Data Not Persisting**
- Check: Database connection
- Check: Transaction function working
- Check: Browser console for errors
- Check: Network tab for failed requests

**Scenario 3: Demo Data Appears**
- Check: No auto-seed logic running
- Check: `is_demo` flag working
- Check: Hardcoded IDs removed

**Scenario 4: Settings Not Saving**
- Check: Settings service working
- Check: Database write permissions
- Check: RLS policies (if enabled)

---

## REPORT FORMAT

After completing tests, report:

```
TEST 1: Create Business - [PASS/FAIL]
TEST 2: Add Contact - [PASS/FAIL]
TEST 3: Change Settings - [PASS/FAIL]
TEST 4: Browser Hard Refresh - [PASS/FAIL]
TEST 5: Multiple Restarts - [PASS/FAIL]

Overall: [PASS/FAIL]

If FAIL: [Describe specific error/issue]
```

---

**Status:** ✅ TEST GUIDE COMPLETE
**Date:** 2026-01-20
**Next Action:** User must perform browser tests
