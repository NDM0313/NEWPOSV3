# 🔧 FRONTEND SCHEMA ALIGNMENT GUIDE

**Date**: January 2026  
**Status**: ✅ **READY FOR VERIFICATION**  
**Purpose**: Align all frontend services with CLEAN_COMPLETE_SCHEMA.sql

---

## 🎯 OBJECTIVE

After database reset, verify that all frontend services match the new schema exactly.

---

## 📋 SCHEMA CHANGES SUMMARY

### **Key Changes in CLEAN_COMPLETE_SCHEMA.sql:**

1. ✅ **Packing Columns Added** to `sale_items` and `purchase_items`
2. ✅ **Settings Table** - Proper structure with JSONB value
3. ✅ **Unique Constraints** - Added to prevent duplicates
4. ✅ **Foreign Keys** - All properly defined
5. ✅ **Indexes** - All performance indexes created

---

## 🔍 VERIFICATION CHECKLIST

### **1. Products Service**
**File:** `src/app/services/productService.ts`

**Verify:**
- [ ] ✅ Query uses `category:product_categories(id, name)` correctly
- [ ] ✅ Query uses `variations:product_variations(*)` correctly
- [ ] ✅ `company_id` filter is used
- [ ] ✅ `is_active` filter is used
- [ ] ✅ Fallback queries handle missing columns gracefully

**Status:** ✅ Already has fallback queries

---

### **2. Sales Service**
**File:** `src/app/services/saleService.ts`

**Verify:**
- [ ] ✅ `sale_items` includes packing columns in insert
- [ ] ✅ Query handles nested relationships gracefully
- [ ] ✅ Fallback queries work if foreign keys fail

**Status:** ✅ Already has fallback queries

---

### **3. Purchases Service**
**File:** `src/app/services/purchaseService.ts`

**Verify:**
- [ ] ✅ `purchase_items` includes packing columns in insert
- [ ] ✅ Query handles nested relationships gracefully
- [ ] ✅ Fallback queries work if foreign keys fail

**Status:** ✅ Already has fallback queries

---

### **4. Settings Service**
**File:** `src/app/services/settingsService.ts`

**Verify:**
- [ ] ✅ `getAllSettings()` loads from `settings` table
- [ ] ✅ `setSetting()` saves to `settings` table with JSONB value
- [ ] ✅ `getModuleConfig()` loads from `modules_config` table
- [ ] ✅ `setModuleEnabled()` saves to `modules_config` table
- [ ] ✅ Error handling returns empty arrays/objects (non-blocking)

**Status:** ✅ Already implemented with error handling

---

### **5. Expenses Service**
**File:** `src/app/services/expenseService.ts`

**Verify:**
- [ ] ✅ Query uses `company_id` and `branch_id` filters
- [ ] ✅ `expense_date` column exists (or fallback to `created_at`)
- [ ] ✅ Error handling for missing columns

**Status:** ✅ Already has error handling

---

### **6. Contacts Service**
**File:** `src/app/services/contactService.ts`

**Verify:**
- [ ] ✅ Query uses `company_id` filter
- [ ] ✅ `type` filter works correctly
- [ ] ✅ `is_active` filter works (or handled gracefully)

**Status:** ✅ Already implemented

---

## 🔧 REQUIRED FIXES

### **Fix 1: Ensure Packing Columns in Service Inserts**

**Files to Check:**
- `src/app/services/saleService.ts` - `createSale()` method
- `src/app/services/purchaseService.ts` - `createPurchase()` method

**Verify these columns are included:**
```typescript
packing_type: string | null
packing_quantity: number | null
packing_unit: string | null
packing_details: any | null
```

---

### **Fix 2: Settings Persistence Verification**

**File:** `src/app/context/SettingsContext.tsx`

**Verify:**
- [ ] ✅ `loadSettings()` is called on mount
- [ ] ✅ `loadSettings()` is called when `companyId` changes
- [ ] ✅ Settings are loaded from database, not local storage
- [ ] ✅ Settings are saved to database on change
- [ ] ✅ Settings persist after page refresh

---

## 📝 TESTING AFTER DATABASE RESET

### **Test 1: Settings Persistence**
1. Open Settings page
2. Change a setting (e.g., company name)
3. Save
4. **Refresh page**
5. ✅ Verify setting is still changed

### **Test 2: Data Persistence**
1. Create a product
2. **Refresh page**
3. ✅ Verify product still exists

### **Test 3: Packing Data**
1. Create a sale with packing data
2. Save
3. View sale details
4. ✅ Verify packing data is displayed

### **Test 4: No Console Errors**
1. Open browser console
2. Navigate through all modules
3. ✅ Verify no 400/406 errors
4. ✅ Verify no "column does not exist" errors
5. ✅ Verify no "relation does not exist" errors

---

## 🚨 CRITICAL VERIFICATION

After database reset, run these SQL queries to verify:

```sql
-- 1. Verify packing columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sale_items' 
AND column_name LIKE 'packing%';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchase_items' 
AND column_name LIKE 'packing%';

-- 2. Verify settings table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'settings'
ORDER BY ordinal_position;

-- 3. Verify all required tables exist
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

---

## ✅ SUCCESS CRITERIA

After database reset and frontend alignment:

1. ✅ **Data Saves** - All CRUD operations save to database
2. ✅ **Data Persists** - Page refresh doesn't reset data
3. ✅ **Settings Persist** - Settings save and reload correctly
4. ✅ **No Missing Columns** - No "column does not exist" errors
5. ✅ **No Missing Tables** - No "relation does not exist" errors
6. ✅ **Packing Works** - Packing data saves and loads correctly

---

**Status**: ✅ **READY FOR DATABASE RESET**

**Next**: Execute database reset, then verify frontend alignment
