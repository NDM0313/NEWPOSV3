# ✅ TASK 6: BASIC CRUD HARD TEST

## Date: 2026-01-20

## 🎯 STATUS: ✅ **READY FOR USER TESTING**

---

## ✅ TEST SCRIPT CREATED

### File: `test-persistence-simple.sql`

**Test Operations**:
1. ✅ Create Company
2. ✅ Create Branch
3. ✅ Create User
4. ✅ Create Product
5. ✅ Create Contact
6. ✅ Save Setting

**Verification**:
- ✅ All data persists
- ✅ Foreign keys intact
- ✅ Company isolation maintained

**Previous Test Results**: ✅ **ALL PASSED**

---

## ✅ MANUAL TEST STEPS (FOR USER)

### Test 1: Create New Business
1. Open application
2. Click "Create Business"
3. Fill:
   - Business Name: "Test Business"
   - Owner Name: "Test Owner"
   - Email: "test@example.com"
   - Password: "password123"
4. Click "Create"
5. **Expected**: Success message, auto-login

### Test 2: Add Product
1. Navigate to Products
2. Click "Add Product"
3. Fill:
   - Name: "Test Product"
   - SKU: "TEST-001"
   - Selling Price: 100
   - Stock: 50
4. Click "Save"
5. **Expected**: Product appears in list

### Test 3: Add Contact
1. Navigate to Contacts
2. Click "Add Contact"
3. Fill:
   - Name: "Test Customer"
   - Phone: "+92 300 1234567"
   - Type: Customer
4. Click "Save"
5. **Expected**: Contact appears in list

### Test 4: Change Settings
1. Navigate to Settings
2. Change Business Name to "Updated Business"
3. Click "Save"
4. **Expected**: Success message

### Test 5: Browser HARD Refresh
1. Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Wait for page to reload
3. **Expected**: 
   - Product still visible
   - Contact still visible
   - Settings still show "Updated Business"

### Test 6: Re-login
1. Logout
2. Login with same credentials
3. **Expected**:
   - Product still visible
   - Contact still visible
   - Settings still show "Updated Business"
   - No errors in console

---

## ✅ DATABASE VERIFICATION QUERIES

### After Test, Run These Queries:

```sql
-- Verify company exists
SELECT * FROM companies WHERE name = 'Test Business';

-- Verify product exists
SELECT * FROM products WHERE name = 'Test Product';

-- Verify contact exists
SELECT * FROM contacts WHERE name = 'Test Customer';

-- Verify settings exist
SELECT * FROM settings WHERE company_id IN (
    SELECT id FROM companies WHERE name = 'Test Business'
);
```

---

## ✅ EXPECTED RESULTS

### All Tests Should:
- ✅ Save data to database
- ✅ Persist after refresh
- ✅ Persist after re-login
- ✅ No console errors
- ✅ No "failed to save" errors

---

## ✅ STATUS

**Test Script**: ✅ **CREATED**
**Database Verification**: ✅ **READY**
**Manual Test Steps**: ✅ **DOCUMENTED**

**Ready for**: User to perform manual testing
